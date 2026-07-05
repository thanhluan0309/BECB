export const CATEGORIES = [
  "BHXH",
  "BHYT",
  "BHTN",
  "LUONG",
  "THUE",
  "LAODONG",
  "OTHER",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const IMPACTS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Impact = (typeof IMPACTS)[number];

export interface Highlight {
  label: string;
  value: string;
}

export interface LawDocument {
  _id: string;
  doc_id: string;
  title: string;
  category: Category;
  summary: string;
  highlights: Highlight[];
  source_url: string;
  source_name: string;
  effective_date: string | null;
  impact: Impact;
  published_at: string;
  scraped_at: string;
  is_new: boolean;
  raw_content?: string;
}

export interface Favorite {
  _id: string;
  user_id: string;
  doc_id: string;
  note: string;
  saved_at: string;
  document: LawDocument;
}

export interface DocumentsResponse {
  data: LawDocument[];
  next_cursor: string | null;
  total: number;
}

export interface UpcomingGroup {
  year_month: string;
  documents: LawDocument[];
}

export interface UpcomingResponse {
  data: UpcomingGroup[];
  total: number;
}

export interface FavoritesResponse {
  data: Favorite[];
  total: number;
}

export type SortOption = "newest" | "effective" | "impact";
