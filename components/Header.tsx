"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Moon, Scale, Search, Star, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUserId } from "@/hooks/useUserId";
import { useFavorites } from "@/hooks/useFavorites";
import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const userId = useUserId();
  const { total: favoritesTotal } = useFavorites(userId);
  const { documents } = useDocuments({ sort: "newest", limit: 5 });
  const hasNew = documents.some((d) => d.is_new);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [search, setSearch] = useState("");

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = search.trim();
    router.push(query ? `/?search=${encodeURIComponent(query)}` : "/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <Scale className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">C&B Law Radar</span>
        </Link>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm văn bản..."
            className="pl-8"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/" aria-label="Thông báo">
              <Bell className="h-5 w-5" />
              {hasNew && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>
          </Button>

          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/favorites" aria-label="Đã lưu">
              <Star className="h-5 w-5" />
              {favoritesTotal > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {favoritesTotal > 99 ? "99+" : favoritesTotal}
                </span>
              )}
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Chuyển giao diện sáng/tối"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className={cn("h-5 w-5", !mounted && "opacity-0")} />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
