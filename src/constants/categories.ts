import { Category, Condition, ListingType, ListingStatus } from "@prisma/client";

export interface CategoryMetadata {
  value: Category;
  label: string;
  icon: string;
  description: string;
  exampleItems: string[];
}

export const CATEGORIES: Record<Category, CategoryMetadata> = {
  BOOKS: {
    value: "BOOKS",
    label: "Books & Study Material",
    icon: "BookOpen",
    description: "Academic textbooks, reference manuals, course notes, and novels",
    exampleItems: ["Engineering Mathematics", "Data Structures Notes", "GATE Prep", "Novels"],
  },
  ELECTRONICS: {
    value: "ELECTRONICS",
    label: "Electronics & Gadgets",
    icon: "Laptop",
    description: "Laptops, monitors, chargers, headphones, calculators, and peripherals",
    exampleItems: ["Scientific Calculator", "USB-C Hub", "Bluetooth Headphones", "Monitor Stand"],
  },
  CYCLES: {
    value: "CYCLES",
    label: "Cycles & Bicycles",
    icon: "Bike",
    description: "Campus commuter bicycles, gear cycles, U-locks, and riding accessories",
    exampleItems: ["Geared Bicycle", "Single-speed Cycle", "Heavy-duty Lock", "Air Pump"],
  },
  ACCESSORIES: {
    value: "ACCESSORIES",
    label: "Accessories & Bags",
    icon: "Watch",
    description: "Backpacks, umbrellas, water bottles, spectacles, and personal gear",
    exampleItems: ["College Backpack", "Umbrella", "Insulated Flask", "ID Card Lanyard"],
  },
  STATIONERY: {
    value: "STATIONERY",
    label: "Stationery & Tools",
    icon: "PenTool",
    description: "Drafting instruments, lab kits, pens, notebooks, and design equipment",
    exampleItems: ["Mini Drafter", "Lab Coat", "Dissection Kit", "Notebook Pack"],
  },
  CLOTHING: {
    value: "CLOTHING",
    label: "Clothing & Apparel",
    icon: "Shirt",
    description: "College hoodies, sports jerseys, team wear, and formal outfits",
    exampleItems: ["Fest Hoodie", "Campus Jersey", "Winter Jacket", "Lab Apron"],
  },
  OTHER: {
    value: "OTHER",
    label: "Other Essentials",
    icon: "Package",
    description: "Room utilities, mattresses, storage containers, and miscellaneous items",
    exampleItems: ["Room Mattress", "Study Table", "Storage Crates", "Clothes Drying Stand"],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const LISTING_TYPES: Record<ListingType, { label: string; description: string; badgeVariant: "default" | "destructive" | "secondary" }> = {
  SALE: {
    label: "Buy & Sell",
    description: "Items available for sale from campus peers at student prices",
    badgeVariant: "default",
  },
  LOST: {
    label: "Lost Item",
    description: "Items misplaced around campus waiting to be recovered",
    badgeVariant: "destructive",
  },
  FOUND: {
    label: "Found Item",
    description: "Items spotted or recovered by fellow students and held safely",
    badgeVariant: "secondary",
  },
};

export const CONDITIONS: Record<Condition, { label: string; description: string }> = {
  NEW: { label: "Brand New", description: "Unopened or unused with original tags" },
  LIKE_NEW: { label: "Like New", description: "Minimal usage, excellent cosmetic shape" },
  GOOD: { label: "Good", description: "Normal signs of campus use, fully functional" },
  FAIR: { label: "Fair", description: "Noticeable wear or minor flaws, but functional" },
};

export const LISTING_STATUSES: Record<ListingStatus, { label: string }> = {
  ACTIVE: { label: "Active" },
  SOLD: { label: "Sold" },
  RESOLVED: { label: "Resolved" },
  REMOVED: { label: "Removed" },
};

export function getCategoryMetadata(category: Category): CategoryMetadata {
  return CATEGORIES[category] ?? CATEGORIES.OTHER;
}

export function isValidCategory(key: string): key is Category {
  return key in CATEGORIES;
}
