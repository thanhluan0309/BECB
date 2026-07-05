"use client";

import { cn } from "@/lib/utils";

export interface FilterChipItem {
  value: string;
  label: string;
}

export function FilterChips({
  items,
  value,
  onChange,
  className,
}: {
  items: FilterChipItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-none", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
