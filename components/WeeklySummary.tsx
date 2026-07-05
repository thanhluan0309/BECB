"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WeeklySummary() {
  const [open, setOpen] = useState(true);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold">📊 Tuần này có gì?</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          Tổng hợp các thay đổi nổi bật trong tuần sẽ sớm xuất hiện ở đây — theo dõi các tin mới nhất
          bên dưới trong lúc chờ nhé.
        </div>
      )}
    </Card>
  );
}
