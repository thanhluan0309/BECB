import { format, formatDistanceToNow, differenceInCalendarDays, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";

/** "01/07/2026" */
export function formatDateVN(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy");
}

/** "Tháng 7/2026" from a "2026-07" year_month key. */
export function formatMonthVN(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `Tháng ${parseInt(month, 10)}/${year}`;
}

/** "3 giờ trước", "Hôm qua", ... */
export function formatRelativeVN(date: string | Date): string {
  const d = new Date(date);
  if (isYesterday(d)) return "Hôm qua";
  return formatDistanceToNow(d, { addSuffix: true, locale: vi });
}

/** "2.530.000 đồng" */
export function formatCurrencyVN(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đồng`;
}

/** Days remaining until a future date, floor-rounded; negative if past. */
export function daysUntil(date: string | Date): number {
  return differenceInCalendarDays(new Date(date), new Date());
}
