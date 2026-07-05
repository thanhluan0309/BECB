"use client";

import { useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import { getDocuments, type GetDocumentsParams } from "@/lib/fe-api";
import type { DocumentsResponse, LawDocument, SortOption } from "@/types/document";

interface UseDocumentsOptions {
  category?: string;
  sort?: SortOption;
  search?: string;
  limit?: number;
}

function fetcher(key: string): Promise<DocumentsResponse> {
  const params = JSON.parse(key) as GetDocumentsParams;
  return getDocuments(params);
}

/** Feed of documents with cursor-based infinite scroll (Tab 1 "Tin mới"). */
export function useDocuments(options: UseDocumentsOptions = {}) {
  const { category, sort = "newest", search, limit = 20 } = options;

  const getKey = (pageIndex: number, previousPageData: DocumentsResponse | null) => {
    if (previousPageData && previousPageData.next_cursor === null) return null;
    const cursor = pageIndex === 0 ? null : previousPageData?.next_cursor ?? null;
    return JSON.stringify({ category, sort, search, limit, cursor });
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<DocumentsResponse>(
    getKey,
    fetcher,
    { revalidateFirstPage: false }
  );

  // Filters changed → restart pagination from page 1 instead of stacking
  // stale pages under a mismatched key sequence.
  useEffect(() => {
    setSize(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort, search]);

  const documents: LawDocument[] = data ? data.flatMap((page) => page.data) : [];
  const total = data?.[0]?.total ?? 0;
  const isReachingEnd = data ? data[data.length - 1]?.next_cursor === null : false;
  const isLoadingMore = isLoading || (size > 0 && !!data && typeof data[size - 1] === "undefined");

  return {
    documents,
    total,
    error,
    isLoading,
    isLoadingMore,
    isValidating,
    isReachingEnd,
    loadMore: () => setSize(size + 1),
    mutate,
  };
}
