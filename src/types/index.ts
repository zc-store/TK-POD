export interface Config {
  price_settings: {
    shipping_fee: number;
    platform_commission_rate: number;
    packaging_fee: number;
    tax_rate: number;
    profit_rate: number;
  };
  ai_image: {
    api_provider: 'jimeng' | 'openai' | 'stability';
    api_key: string;
    api_secret: string;
    image_size: string;
  };
  news_api: {
    api_provider: 'deepseek';
    api_key: string;
    api_url: string;
  };
  deepseek: {
    api_key: string;
  };
  tiktok_shop: {
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
    token_info?: {
      is_seller_token: boolean;
      token_type: string;
      token_prefix: string;
      is_expired: boolean;
      expire_time: string;
      expires_in: number | null;
    };
  };
  baidu_ai: {
    app_id: string;
    api_key: string;
    secret_key: string;
  };
  scheduler: {
    enabled: boolean;
    schedule: string;
  };
}

export interface ExtractedInfo {
  themes: string[];
  colors: string[];
  elements: string[];
  styles: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  keywords: string[];
  publish_date: string;
  url?: string;
  extracted_info?: ExtractedInfo;
}

export interface Pattern {
  id: string;
  _id?: string;
  name: string;
  theme: string;
  colors: string[];
  sizes: string[];
  image_urls: Record<string, string>;
  design思路?: string;
  printingNotes?: string;
  created_at: string;
}

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

export interface GeneratedImage {
  prompt_index: number;
  prompt_type: string;
  image_url: string;
  generated_at: string;
  batch_id?: string;
  local_path?: string;
}

export interface Product {
  id: string;
  _id?: string;
  sku: string;
  name: string;
  title_en: string;
  description_en: string;
  pattern_id: string;
  pattern_name: string;
  carpet_type?: string;
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
  generated_images: GeneratedImage[];
  status: 'draft' | 'pending' | 'publishing' | 'published' | 'failed';
  created_at: string;
}

export interface PublishTask {
  id: string;
  product_id: string;
  product_name: string;
  status: 'pending' | 'publishing' | 'success' | 'failed';
  error_message?: string;
  published_at?: string;
  created_at: string;
}

export interface DashboardStats {
  total_products: number;
  published_products: number;
  pending_products: number;
  total_patterns: number;
  recent_news_count: number;
  today_publish_count: number;
}

export type PageType = 'dashboard' | 'config' | 'news' | 'patterns' | 'products' | 'publish' | 'cron';
