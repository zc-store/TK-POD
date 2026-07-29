import mongoose, { Schema, Document } from 'mongoose';

export interface PriceSettings {
  shipping_fee: number;
  platform_commission_rate: number;
  packaging_fee: number;
  tax_rate: number;
  profit_rate: number;
}

export interface AiImageConfig {
  api_provider: 'jimeng' | 'openai' | 'stability';
  api_key: string;
  api_secret: string;
  image_size: string;
}

export interface NewsApiConfig {
  api_provider: 'deepseek';
  api_key: string;
  api_url: string;
}

export interface TiktokShopConfig {
  api_key: string;
  api_secret: string;
  service_id: string;
  region: string;
  redirect_uri: string;
  access_token: string;
  refresh_token: string;
  token_expire_at: string;
  shop_id: string;
  shop_cipher: string;
  shop_name: string;
  seller_name: string;
  user_type: number;
  granted_scopes: string[];
  last_auth_time: string;
  warehouse_id: string;
  warehouse_name: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  schedule: string;
}

export interface IConfig extends Document {
  price_settings: PriceSettings;
  ai_image: AiImageConfig;
  news_api: NewsApiConfig;
  tiktok_shop: TiktokShopConfig;
  scheduler: SchedulerConfig;
  updated_at: Date;
}

const PriceSettingsSchema: Schema = new Schema({
  shipping_fee: { type: Number, default: 5.0 },
  platform_commission_rate: { type: Number, default: 0.15 },
  packaging_fee: { type: Number, default: 2.0 },
  tax_rate: { type: Number, default: 0.08 },
  profit_rate: { type: Number, default: 0.30 },
});

const AiImageConfigSchema: Schema = new Schema({
  api_provider: { type: String, default: 'jimeng' },
  api_key: { type: String, default: '' },
  api_secret: { type: String, default: '' },
  image_size: { type: String, default: '1024x1024' },
});

const NewsApiConfigSchema: Schema = new Schema({
  api_provider: { type: String, default: 'deepseek' },
  api_key: { type: String, default: '' },
  api_url: { type: String, default: 'https://api.deepseek.com/v1/chat/completions' },
});

const TiktokShopConfigSchema: Schema = new Schema({
  api_key: { type: String, default: '' },
  api_secret: { type: String, default: '' },
  service_id: { type: String, default: '' },
  region: { type: String, default: 'US' },
  redirect_uri: { type: String, default: '' },
  access_token: { type: String, default: '' },
  refresh_token: { type: String, default: '' },
  token_expire_at: { type: String, default: '' },
  shop_id: { type: String, default: '' },
  shop_cipher: { type: String, default: '' },
  shop_name: { type: String, default: '' },
  seller_name: { type: String, default: '' },
  user_type: { type: Number, default: 0 },
  granted_scopes: { type: [String], default: [] },
  last_auth_time: { type: String, default: '' },
  warehouse_id: { type: String, default: '' },
  warehouse_name: { type: String, default: '' },
});

const SchedulerConfigSchema: Schema = new Schema({
  enabled: { type: Boolean, default: true },
  schedule: { type: String, default: '0 9 * * *' },
});

const ConfigSchema: Schema = new Schema({
  price_settings: PriceSettingsSchema,
  ai_image: AiImageConfigSchema,
  news_api: NewsApiConfigSchema,
  tiktok_shop: TiktokShopConfigSchema,
  scheduler: SchedulerConfigSchema,
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.model<IConfig>('Config', ConfigSchema);