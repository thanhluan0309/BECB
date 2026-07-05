"use client";

import useSWR from "swr";
import { toast } from "sonner";
import { getFavorites, addFavorite, removeFavorite, updateFavoriteNote, ApiError } from "@/lib/fe-api";
import type { Favorite, FavoritesResponse } from "@/types/document";

/** Shared favorites state (SWR cache keyed by user_id) for star buttons, header badge, and the "Đã lưu" tab. */
export function useFavorites(userId: string | null) {
  const key = userId ? ["favorites", userId] : null;
  const { data, error, isLoading, mutate } = useSWR<FavoritesResponse>(key, () => getFavorites(userId as string));

  const favorites: Favorite[] = data?.data ?? [];
  const favoriteDocIds = new Set(favorites.map((f) => f.doc_id));

  async function toggleFavorite(docId: string) {
    if (!userId) return;
    const isCurrentlyFavorited = favoriteDocIds.has(docId);
    try {
      if (isCurrentlyFavorited) {
        await removeFavorite(userId, docId);
        toast.success("Đã bỏ lưu");
      } else {
        await addFavorite(userId, docId);
        toast.success("Đã lưu vào mục yêu thích");
      }
      mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Có lỗi xảy ra, thử lại sau");
    }
  }

  async function saveNote(docId: string, note: string) {
    if (!userId) return;
    try {
      await updateFavoriteNote(userId, docId, note);
      toast.success("Đã cập nhật ghi chú");
      mutate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Có lỗi xảy ra, thử lại sau");
    }
  }

  return {
    favorites,
    favoriteDocIds,
    isFavorited: (docId: string) => favoriteDocIds.has(docId),
    total: data?.total ?? 0,
    isLoading,
    error,
    toggleFavorite,
    saveNote,
    mutate,
  };
}
