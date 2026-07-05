"use client";

import { ExternalLink, FileText, Share2, Star } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ImpactDot } from "@/components/ImpactDot";
import { HighlightBox } from "@/components/HighlightBox";
import { formatRelativeVN } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LawDocument } from "@/types/document";

export function DocumentCard({
  document,
  isFavorited,
  onToggleFavorite,
  countdownBadge,
  className,
}: {
  document: LawDocument;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  countdownBadge?: React.ReactNode;
  className?: string;
}) {
  function handleShare() {
    navigator.clipboard
      .writeText(document.source_url)
      .then(() => toast.success("Đã sao chép liên kết"))
      .catch(() => toast.error("Không thể sao chép liên kết"));
  }

  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={document.category} />
            {document.is_new && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary animate-pulse-dot">
                MỚI
              </span>
            )}
            <ImpactDot impact={document.impact} />
            {countdownBadge}
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={isFavorited ? "Bỏ lưu" : "Lưu"}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
          >
            <Star className={cn("h-5 w-5", isFavorited && "fill-accent text-accent")} />
          </button>
        </div>

        <div>
          <h3 className="line-clamp-2 text-lg font-bold leading-snug">{document.title}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{document.summary}</p>
        </div>

        <HighlightBox highlights={document.highlights} effectiveDate={document.effective_date} />

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <a
            href={document.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
          >
            {document.source_name}
            <ExternalLink className="h-3 w-3" />
          </a>
          <span>•</span>
          <span>{formatRelativeVN(document.published_at)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button variant={isFavorited ? "secondary" : "outline"} size="sm" onClick={onToggleFavorite}>
            <Star className={cn("h-4 w-4", isFavorited && "fill-accent text-accent")} />
            {isFavorited ? "Đã lưu" : "Lưu"}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={document.source_url} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4" />
              Xem văn bản gốc
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            Chia sẻ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
