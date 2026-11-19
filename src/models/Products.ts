import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  title: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  images: string[];
  image?: string;
  sizes: string[];
  discountPercentage?: number;
  saleEndDate?: Date | null;
  createdAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    images: { type: [String], required: true },
    image: { type: String },
    sizes: { type: [String], default: [] },
    discountPercentage: { type: Number, default: 0 },
    saleEndDate: { type: Date, default: null },
  },
  { timestamps: true, collection: "products" }
);

// Dev mein schema change hone par purana compiled model hata do; production mein reuse karo.
if (process.env.NODE_ENV !== "production" && mongoose.models.Product) {
  delete mongoose.models.Product;
}

const Product =
  (mongoose.models.Product as mongoose.Model<IProduct>) ||
  mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
