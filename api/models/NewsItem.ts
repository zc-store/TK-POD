import mongoose, { Schema, Document } from 'mongoose';

export interface ExtractedInfo {
  themes: string[];
  colors: string[];
  elements: string[];
  styles: string[];
}

export interface INewsItem extends Document {
  title: string;
  summary: string;
  source: string;
  category: string;
  keywords: string[];
  publish_date: Date;
  url?: string;
  extracted_info?: ExtractedInfo;
  created_at: Date;
}

const ExtractedInfoSchema: Schema = new Schema({
  themes: [{ type: String }],
  colors: [{ type: String }],
  elements: [{ type: String }],
  styles: [{ type: String }],
});

const NewsItemSchema: Schema = new Schema({
  title: { type: String, required: true },
  summary: { type: String, required: true },
  source: { type: String, required: true },
  category: { type: String, required: true },
  keywords: [{ type: String }],
  publish_date: { type: Date, required: true },
  url: { type: String },
  extracted_info: ExtractedInfoSchema,
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<INewsItem>('NewsItem', NewsItemSchema);