import { z } from "zod";

export const createFavoriteSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  doc_id: z.string().min(1, "doc_id is required"),
  note: z.string().optional().default(""),
});

export type CreateFavoriteInput = z.infer<typeof createFavoriteSchema>;

export const updateFavoriteSchema = z.object({
  note: z.string(),
});

export type UpdateFavoriteInput = z.infer<typeof updateFavoriteSchema>;
