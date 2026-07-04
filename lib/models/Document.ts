import { Schema, model, models, type Document as MongooseDocument, type Model } from "mongoose";

export const CATEGORIES = ["BHXH", "BHYT", "BHTN", "LUONG", "THUE", "LAODONG", "OTHER"] as const;
export const IMPACTS = ["HIGH", "MEDIUM", "LOW"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Impact = (typeof IMPACTS)[number];

export interface Highlight {
  label: string;
  value: string;
}

export interface ILawDocument extends MongooseDocument {
  doc_id: string;
  title: string;
  category: Category;
  summary: string;
  highlights: Highlight[];
  source_url: string;
  source_name: string;
  effective_date?: Date;
  impact: Impact;
  published_at: Date;
  scraped_at: Date;
  is_new: boolean;
  raw_content: string;
}

const HighlightSchema = new Schema<Highlight>(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const DocumentSchema = new Schema<ILawDocument>({
  doc_id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, enum: CATEGORIES, default: "OTHER" },
  summary: { type: String, default: "" },
  highlights: { type: [HighlightSchema], default: [] },
  source_url: { type: String, required: true },
  source_name: { type: String, default: "" },
  effective_date: { type: Date },
  impact: { type: String, enum: IMPACTS, default: "MEDIUM" },
  published_at: { type: Date, required: true, index: true },
  scraped_at: { type: Date, default: Date.now },
  is_new: { type: Boolean, default: true, index: true },
  raw_content: { type: String, default: "" },
});

DocumentSchema.index({ category: 1, published_at: -1 });
DocumentSchema.index({ effective_date: 1 });
DocumentSchema.index({ title: "text", summary: "text" });

const LawDocument: Model<ILawDocument> =
  models.Document || model<ILawDocument>("Document", DocumentSchema);

export default LawDocument;
