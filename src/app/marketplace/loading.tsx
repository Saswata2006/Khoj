import { Skeleton } from "@/components/ui/skeleton";

export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen bg-background p-6 sm:p-10 max-w-7xl mx-auto space-y-8">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
