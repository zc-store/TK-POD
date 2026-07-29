import mongoose, { Schema, Document } from 'mongoose';

export interface IPublishTask extends Document {
  product_id: string;
  product_name: string;
  status: 'pending' | 'publishing' | 'success' | 'failed';
  error_message?: string;
  published_at?: Date;
  created_at: Date;
}

const PublishTaskSchema: Schema = new Schema({
  product_id: { type: String, required: true },
  product_name: { type: String, required: true },
  status: { type: String, enum: ['pending', 'publishing', 'success', 'failed'], default: 'pending' },
  error_message: { type: String },
  published_at: { type: Date },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<IPublishTask>('PublishTask', PublishTaskSchema);