import { Schema, model, models, type Document as MongooseDocument, type Model } from "mongoose";

export interface IFavorite extends MongooseDocument {
  user_id: string;
  doc_id: string;
  note: string;
  saved_at: Date;
}

const FavoriteSchema = new Schema<IFavorite>({
  user_id: { type: String, required: true, index: true },
  doc_id: { type: String, required: true, index: true },
  note: { type: String, default: "" },
  saved_at: { type: Date, default: Date.now },
});

FavoriteSchema.index({ user_id: 1, doc_id: 1 }, { unique: true });

const Favorite: Model<IFavorite> = models.Favorite || model<IFavorite>("Favorite", FavoriteSchema);

export default Favorite;
