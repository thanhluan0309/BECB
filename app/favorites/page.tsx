"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download, Star } from "lucide-react";
import { toast } from "sonner";
import { DocumentCard } from "@/components/DocumentCard";
import { EmptyState } from "@/components/EmptyState";
import { FilterChips } from "@/components/FilterChips";
import { CATEGORY_LABELS } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFavorites } from "@/hooks/useFavorites";
import { useUserId } from "@/hooks/useUserId";
import { formatDateVN } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Favorite } from "@/types/document";

const CATEGORY_FILTER_ITEMS = [
  { value: "ALL", label: "Tất cả" },
  { value: "BHXH", label: "BHXH" },
  { value: "BHYT", label: "BHYT" },
  { value: "BHTN", label: "BHTN" },
  { value: "LUONG", label: "Lương" },
  { value: "THUE", label: "Thuế TNCN" },
  { value: "LAODONG", label: "Lao động" },
  { value: "OTHER", label: "Khác" },
];

function buildMarkdown(favorites: Favorite[]): string {
  const sections = favorites.map(({ document: d, note }) => {
    const lines = [
      `## ${d.title}`,
      "",
      d.summary,
      "",
      `- Danh mục: ${CATEGORY_LABELS[d.category]}`,
      d.effective_date ? `- Hiệu lực: ${formatDateVN(d.effective_date)}` : null,
      `- Nguồn: ${d.source_url}`,
      note ? `- Ghi chú: ${note}` : null,
    ].filter((line): line is string => line !== null);
    return lines.join("\n");
  });
  return `# Danh sách đã lưu — C&B Law Radar\n\n${sections.join("\n\n---\n\n")}`;
}

function NoteEditor({ favorite, onSave }: { favorite: Favorite; onSave: (note: string) => void }) {
  const [value, setValue] = useState(favorite.note);
  const [dirty, setDirty] = useState(false);

  return (
    <textarea
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setDirty(true);
      }}
      onBlur={() => {
        if (dirty) {
          onSave(value);
          setDirty(false);
        }
      }}
      placeholder="Thêm ghi chú riêng của bạn..."
      rows={2}
      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}

function UnsaveButton({ title, onConfirm }: { title: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="no-print shrink-0">
          Bỏ lưu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bỏ lưu văn bản này?</DialogTitle>
          <DialogDescription>
            &quot;{title}&quot; sẽ được xóa khỏi mục đã lưu. Bạn có thể lưu lại bất cứ lúc nào.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            Bỏ lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategorySection({
  category,
  favorites,
  onToggleFavorite,
  onSaveNote,
}: {
  category: Category;
  favorites: Favorite[];
  onToggleFavorite: (docId: string) => void;
  onSaveNote: (docId: string, note: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="no-print flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-left"
      >
        <span className="font-semibold">
          {CATEGORY_LABELS[category]}{" "}
          <span className="font-normal text-muted-foreground">({favorites.length})</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-4">
          {favorites.map((favorite) => (
            <div key={favorite._id} className="flex flex-col gap-2">
              <DocumentCard
                document={favorite.document}
                isFavorited
                onToggleFavorite={() => onToggleFavorite(favorite.doc_id)}
              />
              <div className="flex items-start gap-2 px-1">
                <div className="flex-1">
                  <NoteEditor favorite={favorite} onSave={(note) => onSaveNote(favorite.doc_id, note)} />
                </div>
                <UnsaveButton title={favorite.document.title} onConfirm={() => onToggleFavorite(favorite.doc_id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function FavoritesPage() {
  const userId = useUserId();
  const { favorites, isLoading, error, toggleFavorite, saveNote } = useFavorites(userId);
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const filtered =
    categoryFilter === "ALL" ? favorites : favorites.filter((f) => f.document.category === categoryFilter);

  const grouped = useMemo(() => {
    const map = new Map<Category, Favorite[]>();
    for (const favorite of filtered) {
      const list = map.get(favorite.document.category) ?? [];
      list.push(favorite);
      map.set(favorite.document.category, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function handleCopyMarkdown() {
    if (favorites.length === 0) {
      toast.error("Chưa có văn bản nào để xuất");
      return;
    }
    navigator.clipboard
      .writeText(buildMarkdown(favorites))
      .then(() => toast.success("Đã sao chép dạng Markdown"))
      .catch(() => toast.error("Không thể sao chép"));
  }

  function handleDownloadPdf() {
    if (favorites.length === 0) {
      toast.error("Chưa có văn bản nào để xuất");
      return;
    }
    // No PDF lib in the dependency set — the browser's native print dialog
    // lets the user "Save as PDF", scoped to just this content via @media
    // print rules (header/.no-print elements are hidden in globals.css).
    window.print();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Đã lưu</h1>
          <p className="text-sm text-muted-foreground">{favorites.length} văn bản đã lưu</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="no-print">
              <Download className="h-4 w-4" />
              Xuất
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopyMarkdown}>Sao chép dạng Markdown</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}>Tải xuống PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FilterChips
        items={CATEGORY_FILTER_ITEMS}
        value={categoryFilter}
        onChange={setCategoryFilter}
        className="no-print"
      />

      {error && (
        <EmptyState icon={Star} title="Không thể tải dữ liệu" description="Đã có lỗi xảy ra. Vui lòng thử lại." />
      )}

      {!error && isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!error && !isLoading && favorites.length === 0 && (
        <EmptyState icon={Star} title="Chưa lưu bài viết nào" description="Nhấn ⭐ ở bất kỳ tin nào để lưu lại." />
      )}

      {!error && !isLoading && favorites.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Star} title="Không có văn bản nào trong danh mục này" />
      )}

      {grouped.map(([category, items]) => (
        <CategorySection
          key={category}
          category={category}
          favorites={items}
          onToggleFavorite={toggleFavorite}
          onSaveNote={saveNote}
        />
      ))}
    </div>
  );
}
