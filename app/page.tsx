"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Inbox } from "lucide-react";
import { WeeklySummary } from "@/components/WeeklySummary";
import { FilterChips } from "@/components/FilterChips";
import { DocumentCard } from "@/components/DocumentCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDocuments } from "@/hooks/useDocuments";
import { useFavorites } from "@/hooks/useFavorites";
import { useUserId } from "@/hooks/useUserId";
import type { SortOption } from "@/types/document";

const CATEGORY_ITEMS = [
  { value: "ALL", label: "Tất cả" },
  { value: "BHXH", label: "BHXH" },
  { value: "BHYT", label: "BHYT" },
  { value: "BHTN", label: "BHTN" },
  { value: "LUONG", label: "Lương" },
  { value: "THUE", label: "Thuế TNCN" },
  { value: "LAODONG", label: "Lao động" },
];

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Mới nhất",
  effective: "Sắp hiệu lực",
  impact: "Impact cao",
};

function DocumentCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-16 w-full rounded-md" />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeFeed />
    </Suspense>
  );
}

function HomeFeed() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";

  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState<SortOption>("newest");

  const userId = useUserId();
  const { isFavorited, toggleFavorite } = useFavorites(userId);
  const { documents, isLoading, isLoadingMore, isReachingEnd, loadMore, error } = useDocuments({
    category,
    sort,
    search,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || isReachingEnd) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isReachingEnd, isLoadingMore, loadMore]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <WeeklySummary />

      <div className="sticky top-16 z-30 -mx-4 space-y-3 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <FilterChips items={CATEGORY_ITEMS} value={category} onChange={setCategory} />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {search ? `Kết quả cho "${search}"` : "Tin tức mới nhất"}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {SORT_LABELS[sort]}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <DropdownMenuItem key={option} onClick={() => setSort(option)}>
                  {SORT_LABELS[option]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <EmptyState
          icon={Inbox}
          title="Không thể tải dữ liệu"
          description="Đã có lỗi xảy ra khi tải tin tức. Vui lòng thử lại."
          action={
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Thử lại
            </Button>
          }
        />
      )}

      {!error && isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <DocumentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!error && !isLoading && documents.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Không tìm thấy tin tức nào"
          description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm khác."
        />
      )}

      {!error && documents.length > 0 && (
        <div className="flex flex-col gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.doc_id}
              document={doc}
              isFavorited={isFavorited(doc.doc_id)}
              onToggleFavorite={() => toggleFavorite(doc.doc_id)}
            />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {isLoadingMore && <DocumentCardSkeleton />}
        </div>
      )}
    </div>
  );
}
