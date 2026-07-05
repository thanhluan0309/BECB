"use client";

import { Calendar, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDateVN } from "@/lib/format";
import type { Highlight } from "@/types/document";

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Đã sao chép"))
    .catch(() => toast.error("Không thể sao chép"));
}

function HighlightRow({ icon, text, copyText }: { icon?: React.ReactNode; text: string; copyText: string }) {
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(copyText)}
      className="group/item flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/30"
    >
      {icon}
      <span className="truncate">{text}</span>
      <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-60" />
    </button>
  );
}

export function HighlightBox({
  highlights,
  effectiveDate,
}: {
  highlights: Highlight[];
  effectiveDate?: string | null;
}) {
  if (!effectiveDate && highlights.length === 0) return null;

  return (
    <div className="border-l-4 border-amber-500 bg-amber-50 rounded-r-md py-1.5 pr-2 dark:bg-amber-950/30">
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
        {effectiveDate && (
          <HighlightRow
            icon={<Calendar className="h-3.5 w-3.5 shrink-0" />}
            text={`Hiệu lực: ${formatDateVN(effectiveDate)}`}
            copyText={`Hiệu lực: ${formatDateVN(effectiveDate)}`}
          />
        )}
        {highlights.map((h, i) => (
          <HighlightRow key={i} text={`${h.label}: ${h.value}`} copyText={`${h.label}: ${h.value}`} />
        ))}
      </div>
    </div>
  );
}
