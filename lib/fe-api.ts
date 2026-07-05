import type {
  DocumentsResponse,
  FavoritesResponse,
  SortOption,
  UpcomingResponse,
  Favorite,
} from "@/types/document";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Yêu cầu thất bại (${res.status})`, res.status);
  }

  return res.json() as Promise<T>;
}

export interface GetDocumentsParams {
  category?: string;
  sort?: SortOption;
  search?: string;
  limit?: number;
  cursor?: string | null;
}

export function getDocuments(params: GetDocumentsParams = {}): Promise<DocumentsResponse> {
  const search = new URLSearchParams();
  if (params.category && params.category !== "ALL") search.set("category", params.category);
  if (params.sort) search.set("sort", params.sort);
  if (params.search) search.set("search", params.search);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return request<DocumentsResponse>(`/api/documents${qs ? `?${qs}` : ""}`);
}

export function getUpcoming(): Promise<UpcomingResponse> {
  return request<UpcomingResponse>("/api/documents/upcoming");
}

export function getFavorites(userId: string): Promise<FavoritesResponse> {
  return request<FavoritesResponse>(`/api/favorites?user_id=${encodeURIComponent(userId)}`);
}

export function addFavorite(userId: string, docId: string, note?: string): Promise<{ message: string; data: Favorite }> {
  return request(`/api/favorites`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, doc_id: docId, note }),
  });
}

export function removeFavorite(userId: string, docId: string): Promise<{ message: string }> {
  return request(`/api/favorites/${encodeURIComponent(docId)}?user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export function updateFavoriteNote(
  userId: string,
  docId: string,
  note: string
): Promise<{ message: string; data: Favorite }> {
  return request(`/api/favorites/${encodeURIComponent(docId)}?user_id=${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}
