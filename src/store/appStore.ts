import { create } from 'zustand';
import { Config, NewsItem, Pattern, Product, PublishTask, DashboardStats, PageType } from '../types';

interface AppStore {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  config: Config;
  setConfig: (config: Partial<Config>) => void;
  
  news: NewsItem[];
  setNews: (news: NewsItem[]) => void;
  addNews: (item: NewsItem) => void;
  
  patterns: Pattern[];
  setPatterns: (patterns: Pattern[]) => void;
  addPattern: (pattern: Pattern) => void;
  removePattern: (id: string) => void;
  
  tempPatternData: Pattern | null;
  setTempPatternData: (data: Pattern | null) => void;
  
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  removeProduct: (id: string) => void;
  editProduct: (id: string, updates: Partial<Product>) => void;
  
  publishTasks: PublishTask[];
  setPublishTasks: (tasks: PublishTask[]) => void;
  addPublishTask: (task: PublishTask) => void;
  updatePublishTask: (id: string, status: PublishTask['status'], error?: string) => void;
  
  stats: DashboardStats;
  setStats: (stats: DashboardStats) => void;
  
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const defaultConfig: Config = {
  price_settings: {
    shipping_fee: 5.0,
    platform_commission_rate: 0.15,
    packaging_fee: 2.0,
    tax_rate: 0.08,
    profit_rate: 0.30,
  },
  ai_image: {
    api_provider: 'jimeng',
    api_key: process.env.JIMENG_API_KEY || '',
    api_secret: process.env.JIMENG_API_SECRET || '',
    image_size: '1024x1024',
  },
  news_api: {
    api_provider: 'deepseek',
    api_key: process.env.DEEPSEEK_API_KEY || '',
    api_url: 'https://api.deepseek.com/v1/chat/completions',
  },
  deepseek: {
    api_key: process.env.DEEPSEEK_API_KEY || '',
  },
  tiktok_shop: {
    api_key: process.env.TIKTOK_SHOP_API_KEY || '',
    api_secret: process.env.TIKTOK_SHOP_API_SECRET || '',
    service_id: '',
    region: 'US',
    redirect_uri: '',
    access_token: '',
    refresh_token: '',
    token_expire_at: '',
    shop_id: '',
    shop_cipher: '',
    shop_name: '',
    seller_name: '',
    user_type: 0,
    granted_scopes: [],
    last_auth_time: '',
    warehouse_id: '',
    warehouse_name: '',
  },
  baidu_ai: {
    app_id: process.env.BAIDU_AI_APPID || '',
    api_key: process.env.BAIDU_AI_API_KEY || '',
    secret_key: process.env.BAIDU_AI_SECRET_KEY || '',
  },
  scheduler: {
    enabled: true,
    schedule: '0 9 * * *',
  },
};

const defaultStats: DashboardStats = {
  total_products: 0,
  published_products: 0,
  pending_products: 0,
  total_patterns: 0,
  recent_news_count: 0,
  today_publish_count: 0,
};

export const useAppStore = create<AppStore>((set) => ({
  currentPage: 'dashboard',
  sidebarCollapsed: false,
  
  setCurrentPage: (page) => set({ currentPage: page }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  config: defaultConfig,
  setConfig: (newConfig) => set((state) => ({
    config: { 
      ...state.config, 
      ...newConfig,
      tiktok_shop: { ...state.config.tiktok_shop, ...newConfig.tiktok_shop },
    },
  })),
  
  news: [],
  setNews: (news) => set({ news }),
  addNews: (item) => set((state) => ({ news: [...state.news, item] })),
  
  patterns: [],
  setPatterns: (patterns) => set({ patterns }),
  addPattern: (pattern) => set((state) => ({ patterns: [...state.patterns, pattern] })),
  removePattern: (id) => set((state) => ({ patterns: state.patterns.filter(p => p.id !== id) })),
  
  tempPatternData: null,
  setTempPatternData: (data) => set({ tempPatternData: data }),
  
  products: [],
  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  removeProduct: (id) => set((state) => ({ products: state.products.filter(p => (p.id !== id) && (p._id !== id)) })),
  editProduct: (id, updates) => set((state) => ({ 
    products: state.products.map(p => (p.id === id || p._id === id) ? { ...p, ...updates } : p) 
  })),
  
  publishTasks: [],
  setPublishTasks: (tasks) => set({ publishTasks: tasks }),
  addPublishTask: (task) => set((state) => ({ publishTasks: [...state.publishTasks, task] })),
  updatePublishTask: (id, status, error) => set((state) => ({
    publishTasks: state.publishTasks.map(t => 
      t.id === id ? { ...t, status, error_message: error, published_at: status === 'success' ? new Date().toISOString() : t.published_at } : t
    ),
  })),
  
  stats: defaultStats,
  setStats: (stats) => set({ stats }),
  
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
