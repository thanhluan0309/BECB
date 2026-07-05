import { cn } from "@/lib/utils";
import type { Impact } from "@/types/document";

const IMPACT_STYLES: Record<Impact, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-green-500",
};

const IMPACT_LABELS: Record<Impact, string> = {
  HIGH: "Tác động cao",
  MEDIUM: "Tác động trung bình",
  LOW: "Tác động thấp",
};

export function ImpactDot({ impact, className }: { impact: Impact; className?: string }) {
  return (
    <span
      title={IMPACT_LABELS[impact]}
      className={cn("inline-block h-2.5 w-2.5 rounded-full", IMPACT_STYLES[impact], className)}
    />
  );
}
