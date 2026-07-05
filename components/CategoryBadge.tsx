import { cn } from "@/lib/utils";
import type { Category } from "@/types/document";

export const CATEGORY_LABELS: Record<Category, string> = {
  BHXH: "BHXH",
  BHYT: "BHYT",
  BHTN: "BHTN",
  LUONG: "Lương",
  THUE: "Thuế TNCN",
  LAODONG: "Lao động",
  OTHER: "Khác",
};

const CATEGORY_STYLES: Record<Category, string> = {
  BHXH: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  BHYT: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  BHTN: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  LUONG: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  THUE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  LAODONG: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        CATEGORY_STYLES[category],
        className
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
