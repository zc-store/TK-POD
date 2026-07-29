import mongoose, { Schema, Document } from 'mongoose';

export interface IPattern extends Document {
  name: string;
  theme: string;
  colors: string[];
  sizes: string[];
  image_urls: Record<string, string>;
  design思路?: string;
  printingNotes?: string;
  created_at: Date;
}

const PatternSchema: Schema = new Schema({
  name: { type: String, required: true },
  theme: { type: String, required: true },
  colors: [{ type: String }],
  sizes: [{ type: String }],
  image_urls: { type: Schema.Types.Mixed },
  design思路: { type: String },
  printingNotes: { type: String },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<IPattern>('Pattern', PatternSchema);