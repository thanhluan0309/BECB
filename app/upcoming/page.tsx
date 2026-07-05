"use client";

import useSWR from "swr";
import { CalendarClock } from "lucide-react";
import { DocumentCard } from "@/components/DocumentCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorites";
import { useUserId } from "@/hooks/useUserId";
import { getUpcoming } from "@/lib/fe-api";
import { daysUntil, formatMonthVN } from "@/lib/format";
import { cn } from "@/lib/utils";

function CountdownBadge({ effectiveDate }: { effectiveDate: string | null }) {
  if (!effectiveDate) return null;
  const days = daysUntil(effectiveDate);
  const label = `Còn ${days} ngày`;

  if (days < 7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        🔴 {label}
      </span>
    );
  }
  if (days < 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
        🟠 {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      ⚪ {label}
    </span>
  );
}

export default function UpcomingPage() {
  const userId = useUserId();
  const { isFavorited, toggleFavorite } = useFavorites(userId);
  const { data, error, isLoading } = useSWR("upcoming", getUpcoming);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold">Sắp hiệu lực</h1>
        <p className="text-sm text-muted-foreground">Các văn bản sắp có hiệu lực, theo tháng</p>
      </div>

      {error && (
        <EmptyState
          icon={CalendarClock}
          title="Không thể tải dữ liệu"
          description="Đã có lỗi xảy ra. Vui lòng thử lại."
          action={
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Thử lại
            </Button>
          }
        />
      )}

      {!error && isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-40 w-full rounded-xl")} />
          ))}
        </div>
      )}

      {!error && !isLoading && (data?.data.length ?? 0) === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="Chưa có văn bản nào sắp hiệu lực"
          description="Quay lại sau để xem các cập nhật mới."
        />
      )}

      {!error &&
        data?.data.map((group) => (
          <section key={group.year_month} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{formatMonthVN(group.year_month)}</h2>
            <div className="flex flex-col gap-4">
              {group.documents.map((doc) => (
                <DocumentCard
                  key={doc.doc_id}
                  document={doc}
                  isFavorited={isFavorited(doc.doc_id)}
                  onToggleFavorite={() => toggleFavorite(doc.doc_id)}
                  countdownBadge={<CountdownBadge effectiveDate={doc.effective_date} />}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
