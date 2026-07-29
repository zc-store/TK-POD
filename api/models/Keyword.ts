import mongoose, { Schema, Document } from 'mongoose';

export interface IKeyword extends Document {
  name: string;
  category: 'style' | 'theme' | 'color' | 'texture';
  created_at: Date;
}

const KeywordSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['style', 'theme', 'color', 'texture'],
  },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<IKeyword>('Keyword', KeywordSchema);
