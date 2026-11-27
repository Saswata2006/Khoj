import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mocks (no live DB, no real Cloudinary uploads, no live network/auth calls)
// ---------------------------------------------------------------------------

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
    unoptimized?: boolean;
    fill?: boolean;
    [key: string]: unknown;
  }) => {
    const { src, alt, sizes, className } = props;
    return React.createElement("img", { src, alt, sizes, className });
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/authorization", async () => {
  const { AuthorizationError, isAuthorizationError } = await vi.importActual<
    typeof import("@/lib/authorization")
  >("@/lib/authorization");
  return {
    getCurrentUser: vi.fn(),
    requireUser: vi.fn(),
    requireAdmin: vi.fn(),
    AuthorizationError,
    isAuthorizationError,
  };
});

vi.mock("@/lib/prisma", () => ({
  default: {
    listing: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    claim: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
  },
  prisma: {
    listing: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    claim: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
  },
}));

vi.mock("@/lib/profile", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profile")>(
    "@/lib/profile"
  );
  return {
    ...actual,
    getDashboardSummary: vi.fn(),
  };
});

vi.mock("@/lib/auth-client", () => ({
  sendOtp: vi.fn().mockResolvedValue({ success: true }),
  verifyOtp: vi.fn().mockResolvedValue({ success: true }),
  getSession: vi.fn().mockResolvedValue(null),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";
import { getDashboardSummary } from "@/lib/profile";
import { getOwnedMarketplaceListingForEdit } from "@/lib/services/listings";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_LISTING,
  archiveListingRequest,
  deleteListingImageRequest,
  executeCreateListingWorkflow,
  updateListingRequest,
  validateListingFormValues,
  validateSelectedImageFiles,
  type ListingFormValues,
  type QueuedUploadItem,
} from "@/lib/marketplace-ui";
import { ListingFormFields } from "@/components/marketplace/ListingFormFields";
import { ListingImageUploader } from "@/components/marketplace/ListingImageUploader";
import { CreateListingForm } from "@/components/marketplace/CreateListingForm";
import { EditListingForm } from "@/components/marketplace/EditListingForm";
import CreateListingPage from "@/app/marketplace/create/page";
import EditListingPage from "@/app/marketplace/[id]/edit/page";
import DashboardPage from "@/app/dashboard/page";

// ---------------------------------------------------------------------------
// Test Helpers & Fixtures
// ---------------------------------------------------------------------------

function makeMockSessionUser(overrides?: {
  id?: string;
  name?: string;
  email?: string;
  role?: string | null;
}) {
  const now = new Date("2026-11-28T00:00:00.000Z");
  return {
    id: overrides?.id ?? "usr_1",
    name: overrides?.name ?? "Aarav",
    email: overrides?.email ?? "aarav@example.com",
    emailVerified: true,
    role: overrides?.role ?? "USER",
    image: null,
    location: null,
    hostelBlock: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeValidFormValues(
  overrides?: Partial<ListingFormValues>
): ListingFormValues {
  return {
    title: "Casio fx-991EX Scientific Calculator",
    description:
      "Lightly used engineering calculator with original slide case and manual.",
    category: "ELECTRONICS",
    condition: "LIKE_NEW",
    price: "850",
    location: "North Campus Library",
    ...overrides,
  };
}

function makeFakeFile(
  name: string,
  type: string,
  size: number
): File {
  return {
    name,
    type,
    size,
    lastModified: 1700000000000,
    slice: () => new Blob([new Uint8Array(Math.min(size, 16))], { type }),
    arrayBuffer: async () => new ArrayBuffer(Math.min(size, 16)),
  } as unknown as File;
}

function makeQueuedItem(
  id: string,
  file: File,
  status: QueuedUploadItem["status"] = "queued",
  error?: string
): QueuedUploadItem {
  return {
    id,
    file,
    previewUrl: `blob:mock/${id}`,
    status,
    error,
  };
}

function unwrapSuspenseChild(
  pageElement: React.ReactElement
): React.ReactElement {
  const props = pageElement.props as { children?: React.ReactElement };
  if (!props.children) {
    throw new Error("Expected Suspense wrapper child element");
  }
  return props.children;
}

async function renderServerPageInner(
  pageElement: React.ReactElement
): Promise<string> {
  const child = unwrapSuspenseChild(pageElement);
  const ChildComponent = child.type as (
    p: unknown
  ) => Promise<React.ReactElement>;
  const resolvedTree = await ChildComponent(child.props);
  return renderToStaticMarkup(resolvedTree);
}

// ---------------------------------------------------------------------------
// 1. Listing Form Validation
// ---------------------------------------------------------------------------

describe("Marketplace listing form validation", () => {
  it("accepts valid form inputs and returns normalized data without negotiable flags", () => {
    const result = validateListingFormValues(makeValidFormValues({
      title: "  Hercules Cycle 21-Speed  ",
      price: "4500.50",
      location: "  Hostel 3 Gate  ",
    }));

    expect(result.valid).toBe(true);
    expect(result.fieldErrors).toEqual({});
    expect(result.data).toEqual({
      title: "Hercules Cycle 21-Speed",
      description:
        "Lightly used engineering calculator with original slide case and manual.",
      category: "ELECTRONICS",
      condition: "LIKE_NEW",
      price: 4500.5,
      location: "Hostel 3 Gate",
    });
    expect("isNegotiable" in (result.data ?? {})).toBe(false);
  });

  it("returns field-level errors for missing or invalid inputs", () => {
    const result = validateListingFormValues({
      title: "Hi",
      description: "Too short",
      category: "",
      condition: "INVALID_COND",
      price: "0",
      location: "A",
    });

    expect(result.valid).toBe(false);
    expect(result.fieldErrors.title).toBeTruthy();
    expect(result.fieldErrors.description).toBeTruthy();
    expect(result.fieldErrors.category).toBeTruthy();
    expect(result.fieldErrors.condition).toBeTruthy();
    expect(result.fieldErrors.price).toBeTruthy();
    expect(result.fieldErrors.location).toBeTruthy();
  });

  it("rejects non-numeric and >2-decimal INR prices", () => {
    const nanPrice = validateListingFormValues(
      makeValidFormValues({ price: "" })
    );
    expect(nanPrice.valid).toBe(false);
    expect(nanPrice.fieldErrors.price).toBeTruthy();

    const tooManyDecimals = validateListingFormValues(
      makeValidFormValues({ price: "120.456" })
    );
    expect(tooManyDecimals.valid).toBe(false);
    expect(tooManyDecimals.fieldErrors.price).toContain("decimal");
  });
});

// ---------------------------------------------------------------------------
// 2. Client Image Selection Validation
// ---------------------------------------------------------------------------

describe("Client image selection validation", () => {
  it("accepts JPEG, PNG, and WebP within 3 MiB and remaining slots", () => {
    const files = [
      makeFakeFile("a.jpg", "image/jpeg", 120_000),
      makeFakeFile("b.png", "image/png", 250_000),
      makeFakeFile("c.webp", "image/webp", 500_000),
    ];

    const res = validateSelectedImageFiles(files, 1);
    expect(res.accepted).toHaveLength(3);
    expect(res.errors).toEqual([]);
  });

  it("rejects unsupported formats, empty files, and >3 MiB files", () => {
    const files = [
      makeFakeFile("anim.gif", "image/gif", 10_000),
      makeFakeFile("doc.pdf", "application/pdf", 10_000),
      makeFakeFile("empty.png", "image/png", 0),
      makeFakeFile("huge.webp", "image/webp", MAX_IMAGE_BYTES + 1),
      makeFakeFile("valid.jpg", "image/jpeg", 40_000),
    ];

    const res = validateSelectedImageFiles(files, 0);
    expect(res.accepted).toHaveLength(1);
    expect(res.accepted[0].name).toBe("valid.jpg");
    expect(res.errors).toHaveLength(4);
    expect(res.errors[0]).toContain("JPEG, PNG, or WebP");
    expect(res.errors[2]).toContain("empty");
    expect(res.errors[3]).toContain("3 MiB");
  });

  it("enforces maximum 5 images across existing and queued photos", () => {
    const files = [
      makeFakeFile("1.png", "image/png", 10_000),
      makeFakeFile("2.png", "image/png", 10_000),
    ];

    const partialRes = validateSelectedImageFiles(files, 4);
    expect(partialRes.accepted).toHaveLength(1);
    expect(partialRes.errors).toHaveLength(1);
    expect(partialRes.errors[0]).toContain(String(MAX_IMAGES_PER_LISTING));

    const fullRes = validateSelectedImageFiles(files, 5);
    expect(fullRes.accepted).toHaveLength(0);
    expect(fullRes.errors[0]).toContain("Maximum of 5 images");
  });
});

// ---------------------------------------------------------------------------
// 3. UI Component SSR Rendering Checks
// ---------------------------------------------------------------------------

describe("Marketplace Create & Edit UI components", () => {
  it("renders ListingFormFields with categories, conditions, INR price, and no negotiable toggle", () => {
    const html = renderToStaticMarkup(
      React.createElement(ListingFormFields, {
        values: makeValidFormValues(),
        fieldErrors: { title: "Title is too short." },
        onChange: vi.fn(),
        statusField: { value: "ACTIVE", onChange: vi.fn() },
      })
    );

    expect(html).toContain("Books &amp; Study Material");
    expect(html).toContain("Electronics &amp; Gadgets");
    expect(html).toContain("Brand New");
    expect(html).toContain("Like New");
    expect(html).toContain("Price (INR)");
    expect(html).toContain("Title is too short.");
    expect(html).toContain("Active (Visible on Marketplace)");
    expect(html.toLowerCase()).not.toContain("negotiable");
  });

  it("renders ListingImageUploader states (saved, queued, uploading, failed+retry, errors)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ListingImageUploader, {
        existingImages: [
          {
            id: "img_existing_1",
            imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
            createdAt: "2026-11-28T00:00:00.000Z",
          },
        ],
        queuedImages: [
          makeQueuedItem(
            "q1",
            makeFakeFile("front.jpg", "image/jpeg", 20_480),
            "queued"
          ),
          makeQueuedItem(
            "q2",
            makeFakeFile("side.png", "image/png", 40_960),
            "uploading"
          ),
          makeQueuedItem(
            "q3",
            makeFakeFile("back.webp", "image/webp", 30_720),
            "error",
            "Network timeout"
          ),
        ],
        onAddFiles: vi.fn(),
        onRemoveQueuedImage: vi.fn(),
        onRetryQueuedImage: vi.fn(),
        onDeleteExistingImage: vi.fn(),
        selectionErrors: ['"doc.pdf" is not supported.'],
        deleteError: "Unable to delete image.",
      })
    );

    expect(html).toContain("4 / 5");
    expect(html).toContain("Uploaded");
    expect(html).toContain("Ready to upload");
    expect(html).toContain("Uploading...");
    expect(html).toContain("Upload failed");
    expect(html).toContain("Network timeout");
    expect(html).toContain("Retry Upload");
    expect(html).toContain("doc.pdf");
    expect(html).toContain("Unable to delete image.");
  });

  it("renders CreateListingForm with honest Active listing visibility disclosure", () => {
    const html = renderToStaticMarkup(React.createElement(CreateListingForm));
    expect(html).toContain("Sell an item on Khoj");
    expect(html).toContain("Publish Listing");
    expect(html).toContain("Active");
    expect(html).toContain("no draft mode");
    expect(html.toLowerCase()).not.toContain("negotiable");
  });

  it("renders EditListingForm pre-filled with listing values and Remove Listing action", () => {
    const html = renderToStaticMarkup(
      React.createElement(EditListingForm, {
        listing: {
          id: "cm1abc1234567890",
          title: "Engineering Drawing Kit",
          description: "Complete drafter and compass box barely used.",
          type: "SALE",
          category: "STATIONERY",
          condition: "GOOD",
          price: 450,
          location: "Main Gate",
          status: "ACTIVE",
          createdAt: "2026-11-28T00:00:00.000Z",
          updatedAt: "2026-11-28T00:00:00.000Z",
          images: [
            {
              id: "cm1img1",
              imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/kit.jpg",
              createdAt: "2026-11-28T00:00:00.000Z",
            },
          ],
        },
      })
    );

    expect(html).toContain("Edit listing");
    expect(html).toContain("Engineering Drawing Kit");
    expect(html).toContain("450");
    expect(html).toContain("Main Gate");
    expect(html).toContain("Save Changes");
    expect(html).toContain("Remove Listing");
    expect(html).toContain("1 / 5");
  });
});

// ---------------------------------------------------------------------------
// 4. Workflow Orchestration, Concurrency, Partial Failure Retry & API Errors
// ---------------------------------------------------------------------------

describe("Marketplace Create & Edit client workflows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("creates listing first then uploads queued images with bounded concurrency (max 2)", async () => {
    let activeUploads = 0;
    let maxObservedUploads = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/listings") {
        return new Response(
          JSON.stringify({
            listing: {
              id: "cm1created123456",
              title: "Casio fx-991EX Scientific Calculator",
              description:
                "Lightly used engineering calculator with original slide case and manual.",
              type: "SALE",
              category: "ELECTRONICS",
              condition: "LIKE_NEW",
              price: 850,
              location: "North Campus Library",
              status: "ACTIVE",
              createdAt: "2026-11-28T00:00:00.000Z",
              updatedAt: "2026-11-28T00:00:00.000Z",
              images: [],
            },
          }),
          { status: 201 }
        );
      }

      activeUploads++;
      maxObservedUploads = Math.max(maxObservedUploads, activeUploads);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeUploads--;

      return new Response(
        JSON.stringify({
          image: {
            id: `img_${Math.random()}`,
            imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/x.png",
            createdAt: "2026-11-28T00:00:00.000Z",
          },
        }),
        { status: 201 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const savedSpy = vi.fn();
    const succeeded: string[] = [];

    const queue = [
      makeQueuedItem("q1", makeFakeFile("1.png", "image/png", 1024)),
      makeQueuedItem("q2", makeFakeFile("2.png", "image/png", 1024)),
      makeQueuedItem("q3", makeFakeFile("3.png", "image/png", 1024)),
      makeQueuedItem("q4", makeFakeFile("4.png", "image/png", 1024)),
    ];

    const res = await executeCreateListingWorkflow({
      values: makeValidFormValues(),
      existingListingId: null,
      lastSavedSnapshot: null,
      queuedImages: queue,
      onListingSaved: savedSpy,
      uploadCallbacks: {
        onItemSuccess: (qId) => succeeded.push(qId),
      },
      concurrency: 2,
    });

    expect(res.ok).toBe(true);
    expect(res.listingId).toBe("cm1created123456");
    expect(res.uploadedCount).toBe(4);
    expect(res.failedCount).toBe(0);
    expect(maxObservedUploads).toBeLessThanOrEqual(2);
    expect(savedSpy).toHaveBeenCalledTimes(1);
    expect(succeeded).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("prevents duplicate listing creation when retrying after partial image failure", async () => {
    let uploadAttempt = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/listings" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            listing: {
              id: "cm1nodup12345678",
              title: "Casio fx-991EX Scientific Calculator",
              description:
                "Lightly used engineering calculator with original slide case and manual.",
              type: "SALE",
              category: "ELECTRONICS",
              condition: "LIKE_NEW",
              price: 850,
              location: "North Campus Library",
              status: "ACTIVE",
              createdAt: "2026-11-28T00:00:00.000Z",
              updatedAt: "2026-11-28T00:00:00.000Z",
              images: [],
            },
          }),
          { status: 201 }
        );
      }

      if (url === "/api/listings/cm1nodup12345678/images") {
        uploadAttempt++;
        if (uploadAttempt === 2) {
          return new Response(
            JSON.stringify({ error: "Temporary Cloudinary outage." }),
            { status: 500 }
          );
        }
        return new Response(
          JSON.stringify({
            image: {
              id: `img_${uploadAttempt}`,
              imageUrl: "https://res.cloudinary.com/demo/image/upload/v1/ok.png",
              createdAt: "2026-11-28T00:00:00.000Z",
            },
          }),
          { status: 201 }
        );
      }

      throw new Error(`Unexpected call: ${url} ${init?.method}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    let preservedListingId: string | null = null;
    let preservedSnapshot: string | null = null;
    const values = makeValidFormValues();

    const firstQueue = [
      makeQueuedItem("q1", makeFakeFile("1.png", "image/png", 1024)),
      makeQueuedItem("q2", makeFakeFile("2.png", "image/png", 1024)),
    ];

    const firstAttempt = await executeCreateListingWorkflow({
      values,
      existingListingId: preservedListingId,
      lastSavedSnapshot: preservedSnapshot,
      queuedImages: firstQueue,
      onListingSaved: (listing, snap) => {
        preservedListingId = listing.id;
        preservedSnapshot = snap;
      },
      concurrency: 1,
    });

    expect(firstAttempt.ok).toBe(false);
    expect(firstAttempt.stage).toBe("images");
    expect(preservedListingId).toBe("cm1nodup12345678");
    expect(firstAttempt.uploadedCount).toBe(1);
    expect(firstAttempt.failedCount).toBe(1);

    // Retry ONLY the remaining failed item with preserved listing ID
    const retryQueue = [
      makeQueuedItem(
        "q2",
        makeFakeFile("2.png", "image/png", 1024),
        "error",
        "Temporary Cloudinary outage."
      ),
    ];

    const retryAttempt = await executeCreateListingWorkflow({
      values,
      existingListingId: preservedListingId,
      lastSavedSnapshot: preservedSnapshot,
      queuedImages: retryQueue,
      onListingSaved: (listing, snap) => {
        preservedListingId = listing.id;
        preservedSnapshot = snap;
      },
      concurrency: 1,
    });

    expect(retryAttempt.ok).toBe(true);
    expect(retryAttempt.stage).toBe("done");
    expect(retryAttempt.uploadedCount).toBe(1);

    // Verify POST /api/listings was called ONLY ONCE across both runs
    const postCreateCalls = fetchMock.mock.calls.filter(
      ([u, i]) => u === "/api/listings" && i?.method === "POST"
    );
    expect(postCreateCalls).toHaveLength(1);
  });

  it("handles update, delete image, archive listing, and API error responses cleanly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Listing is SOLD and locked.",
          }),
          { status: 409 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ deleted: true, imageId: "cm1img_del" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            listing: { id: "cm1abc1234567890", status: "REMOVED" },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const patchErr = await updateListingRequest("cm1abc1234567890", {
      title: "Updated Title",
    });
    expect(patchErr).toEqual({
      ok: false,
      status: 409,
      error: "Listing is SOLD and locked.",
    });

    const delImgOk = await deleteListingImageRequest(
      "cm1abc1234567890",
      "cm1img_del"
    );
    expect(delImgOk).toEqual({ ok: true, imageId: "cm1img_del" });

    const archiveOk = await archiveListingRequest("cm1abc1234567890");
    expect(archiveOk.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Protected Server Routes & Edit Authorization
// ---------------------------------------------------------------------------

describe("Protected marketplace UI routes & ownership checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated visitors on /marketplace/create to /login?redirectTo=/marketplace/create", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    await expect(
      renderServerPageInner(CreateListingPage())
    ).rejects.toThrow("NEXT_REDIRECT:/login?redirectTo=/marketplace/create");
  });

  it("renders CreateListingPage for authenticated user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(makeMockSessionUser());

    const html = await renderServerPageInner(CreateListingPage());
    expect(html).toContain("Sell an item on Khoj");
    expect(html).toContain("Publish Listing");
  });

  it("redirects unauthenticated visitors on /marketplace/[id]/edit before querying listing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    await expect(
      renderServerPageInner(
        EditListingPage({
          params: Promise.resolve({ id: "cm1abc1234567890" }),
        })
      )
    ).rejects.toThrow(
      "NEXT_REDIRECT:/login?redirectTo=%2Fmarketplace%2Fcm1abc1234567890%2Fedit"
    );

    expect(prisma.listing.findUnique).not.toHaveBeenCalled();
  });

  it("renders Access Denied (403) when non-owner visits /marketplace/[id]/edit", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      makeMockSessionUser({
        id: "usr_attacker",
        name: "Attacker",
        email: "attacker@example.com",
      })
    );
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1abc1234567890",
      userId: "usr_owner",
      type: "SALE",
      status: "ACTIVE",
      title: "Owned Book",
      description: "Clean textbook",
      category: "BOOKS",
      condition: "GOOD",
      price: "250",
      location: "Library",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "usr_owner", name: "Owner", image: null },
      images: [],
    } as never);

    const html = await renderServerPageInner(
      EditListingPage({
        params: Promise.resolve({ id: "cm1abc1234567890" }),
      })
    );

    expect(html).toContain("Access Denied (403)");
    expect(html).not.toContain("Owned Book");
  });

  it("renders 404 UI for nonexistent listing and 409 lock UI for SOLD listing", async () => {
    // 1. Not found
    vi.mocked(getCurrentUser).mockResolvedValueOnce(makeMockSessionUser());
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce(null);

    const notFoundHtml = await renderServerPageInner(
      EditListingPage({
        params: Promise.resolve({ id: "cm1missing123456" }),
      })
    );
    expect(notFoundHtml).toContain("Listing Not Found (404)");

    // 2. Non-editable SOLD listing
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      makeMockSessionUser({
        id: "usr_owner",
        name: "Owner",
        email: "owner@example.com",
      })
    );
    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1sold123456789",
      userId: "usr_owner",
      type: "SALE",
      status: "SOLD",
      title: "Sold Desk Lamp",
      description: "Lamp description",
      category: "OTHER",
      condition: "GOOD",
      price: "300",
      location: "Hostel 2",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "usr_owner", name: "Owner", image: null },
      images: [],
    } as never);

    const lockedHtml = await renderServerPageInner(
      EditListingPage({
        params: Promise.resolve({ id: "cm1sold123456789" }),
      })
    );
    expect(lockedHtml).toContain("Editing Locked (SOLD)");
  });

  it("enforces getOwnedMarketplaceListingForEdit status matrix directly", async () => {
    expect(
      await getOwnedMarketplaceListingForEdit("bad", "usr_1")
    ).toEqual({ status: "not_found" });

    vi.mocked(prisma.listing.findUnique).mockResolvedValueOnce({
      id: "cm1lost123456789",
      userId: "usr_1",
      type: "LOST",
      status: "ACTIVE",
    } as never);
    expect(
      await getOwnedMarketplaceListingForEdit("cm1lost123456789", "usr_1")
    ).toEqual({ status: "not_found" });
  });

  it("renders Dashboard with Sell an Item / Create Listing shortcut to /marketplace/create", async () => {
    const now = new Date("2026-11-28T00:00:00.000Z");
    vi.mocked(getCurrentUser).mockResolvedValueOnce(
      makeMockSessionUser({
        id: "usr_1",
        name: "Riya Das",
        email: "riya@example.com",
      })
    );
    vi.mocked(getDashboardSummary).mockResolvedValueOnce({
      profile: {
        id: "usr_1",
        name: "Riya Das",
        email: "riya@example.com",
        emailVerified: true,
        image: null,
        location: "North Campus",
        hostelBlock: null,
        role: "USER",
        createdAt: now,
        updatedAt: now,
      },
      completion: {
        isComplete: true,
        completedCount: 2,
        totalCount: 2,
        missingFields: [],
      },
      counts: {
        listings: 2,
        claims: 0,
        contactRequests: 0,
      },
    });

    const html = await renderServerPageInner(DashboardPage());
    expect(html).toContain('href="/marketplace"');
    expect(html).toContain('href="/marketplace/create"');
    expect(html).toContain('href="/dashboard/listings"');
    expect(html).toContain("Sell an Item");
    expect(html).toContain("Manage My Listings");
    expect(html).toContain("2 listings in your account");
    expect(html).not.toContain('href="/marketplace/me"');
  });
});
