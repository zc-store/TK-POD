import mongoose, { Schema, Document } from 'mongoose';

export interface PriceBreakdown {
  cost: number;
  shipping: number;
  commission: number;
  packaging: number;
  tax: number;
  profit: number;
}

export interface ProductVariant {
  size_cm: string;
  production_size_cm: string;
  cost_price: number;
  selling_price: number;
  price_breakdown: PriceBreakdown;
  weight: number;
  packaging_weight: number;
  packaging_size: string;
  inventory: number;
}

export interface IProduct extends Document {
  sku: string;
  name: string;
  title_en: string;
  description_en: string;
  pattern_id: string;
  pattern_name: string;
  carpet_type: string;
  material: string;
  image_url: string;
  images: string[];
  category: string;
  tiktok_category_id: string;
  tiktok_category_name: string;
  attributes: Record<string, string>;
  variants: ProductVariant[];
  product_details: string;
  product_highlights: string[];
  image_prompts: { type: string; positive_prompt: string; negative_prompt: string; aspect_ratio: string }[];
  generated_images: { prompt_index: number; prompt_type: string; image_url: string; generated_at: Date; local_path?: string }[];
  status: 'draft' | 'pending' | 'publishing' | 'published' | 'failed';
  created_at: Date;
}

const PriceBreakdownSchema: Schema = new Schema({
  cost: { type: Number, required: true },
  shipping: { type: Number, required: true },
  commission: { type: Number, required: true },
  packaging: { type: Number, required: true },
  tax: { type: Number, required: true },
  profit: { type: Number, required: true },
});

const ProductVariantSchema: Schema = new Schema({
  size_cm: { type: String, required: true },
  production_size_cm: { type: String, required: true },
  cost_price: { type: Number, required: true },
  selling_price: { type: Number, required: true },
  price_breakdown: PriceBreakdownSchema,
  weight: { type: Number, default: 0 },
  packaging_weight: { type: Number, default: 0 },
  packaging_size: { type: String, default: '' },
  inventory: { type: Number, default: 100 },
});

const ProductSchema: Schema = new Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  title_en: { type: String },
  description_en: { type: String },
  pattern_id: { type: String, required: true },
  pattern_name: { type: String, required: true },
  carpet_type: { type: String },
  material: { type: String, required: true },
  image_url: { type: String, required: true },
  images: [{ type: String }],
  category: { type: String },
  tiktok_category_id: { type: String, default: '' },
  tiktok_category_name: { type: String, default: '' },
  attributes: { type: Schema.Types.Mixed },
  variants: [ProductVariantSchema],
  product_details: { type: String, default: '' },
  product_highlights: [{ type: String }],
  image_prompts: [{
    type: { type: String },
    positive_prompt: { type: String },
    negative_prompt: { type: String },
    aspect_ratio: { type: String },
  }],
  generated_images: [{
    prompt_index: { type: Number },
    prompt_type: { type: String },
    image_url: { type: String },
    generated_at: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['draft', 'pending', 'publishing', 'published', 'failed'], default: 'draft' },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<IProduct>('Product', ProductSchema);