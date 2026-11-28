"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { buildMarketplaceHref, normalizeSearchTextInput } from "@/lib/marketplace-search";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/validators/listing";
import { Button } from "@/components/ui/button";

export function HeroSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeSearchTextInput(query);
    router.push(buildMarketplaceHref({ q: normalized, page: 1 }));
  };

  return (
    <form
      action="/marketplace"
      method="GET"
      role="search"
      aria-label="Search Khoj marketplace from homepage"
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-2 rounded-xl border border-[#27272A] bg-[#111113]/95 p-1.5 shadow-lg transition-colors focus-within:border-[#10B981] focus-within:ring-2 focus-within:ring-[#10B981]/20 hover:border-[#3F3F46]"
    >
      <div className="flex flex-1 min-w-0 items-center gap-2.5 pl-2.5">
        <Search className="h-4 w-4 shrink-0 text-[#71717A]" aria-hidden="true" />
        <input
          type="search"
          name="q"
          value={query}
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search textbooks, calculators, monitors, cycles..."
          aria-label="Search marketplace items"
          className="h-9 w-full min-w-0 bg-transparent text-sm text-[#FAFAFA] placeholder:text-[#71717A] outline-none"
        />
      </div>
      <Button
        type="submit"
        variant="accent"
        size="default"
        className="shrink-0 px-4"
      >
        <span>Search</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </form>
  );
}
