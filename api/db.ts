import mongoose from 'mongoose';
import './models/Config.js';

let isConnected = false;

const connectDB = async (): Promise<void> => {
  if (isConnected) {
    console.log('MongoDB is already connected');
    return;
  }

  try {
    const uri = process.env.MONGODB_URI || '';
    const dbName = process.env.MONGODB_DB_NAME || 'smart_listing';
    
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
    });
    
    isConnected = true;
    console.log('MongoDB connected successfully');
    
    // 初始化Config文档（如果不存在）
    await initializeConfig();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Database connection failed - API will work without persistent storage');
  }
};

// 初始化Config文档
const initializeConfig = async (): Promise<void> => {
  try {
    const Config = mongoose.model('Config');
    const existingConfig = await Config.findOne();
    
    if (!existingConfig) {
      console.log('No Config document found, creating default...');
      
      const defaultConfig = new Config({
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
          api_url: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
        },
        tiktok_shop: {
          api_key: process.env.TIKTOK_SHOP_API_KEY || '',
          api_secret: process.env.TIKTOK_SHOP_API_SECRET || '',
          service_id: '',
          region: process.env.TIKTOK_SHOP_REGION || 'US',
          redirect_uri: process.env.TIKTOK_SHOP_REDIRECT_URI || '',
          access_token: process.env.TIKTOK_SHOP_ACCESS_TOKEN || '',
          refresh_token: process.env.TIKTOK_SHOP_REFRESH_TOKEN || '',
          token_expire_at: process.env.TIKTOK_SHOP_TOKEN_EXPIRE_AT || '',
          shop_id: process.env.TIKTOK_SHOP_ID || '',
          shop_cipher: process.env.TIKTOK_SHOP_CIPHER || '',
          shop_name: process.env.TIKTOK_SHOP_NAME || '',
          seller_name: process.env.TIKTOK_SHOP_SELLER_NAME || '',
          user_type: 0,
          granted_scopes: [],
          last_auth_time: '',
          warehouse_id: process.env.TIKTOK_SHOP_WAREHOUSE_ID || '',
          warehouse_name: process.env.TIKTOK_SHOP_WAREHOUSE_NAME || '',
        },
        scheduler: {
          enabled: true,
          schedule: '0 9 * * *',
        },
      });
      
      await defaultConfig.save();
      console.log('Config document created successfully');
    } else {
      // 如果Config文档存在但tiktok_shop的值为空，从环境变量填充
      const tiktokShop = existingConfig.tiktok_shop || {};
      const hasEmptyTiktokConfig = !tiktokShop.api_key && !tiktokShop.api_secret;
      
      if (hasEmptyTiktokConfig) {
        console.log('Config document exists but TikTok config is empty, filling from environment...');
        
        existingConfig.tiktok_shop = {
          ...tiktokShop,
          api_key: process.env.TIKTOK_SHOP_API_KEY || '',
          api_secret: process.env.TIKTOK_SHOP_API_SECRET || '',
          region: process.env.TIKTOK_SHOP_REGION || 'US',
          redirect_uri: process.env.TIKTOK_SHOP_REDIRECT_URI || '',
          access_token: process.env.TIKTOK_SHOP_ACCESS_TOKEN || '',
          refresh_token: process.env.TIKTOK_SHOP_REFRESH_TOKEN || '',
          token_expire_at: process.env.TIKTOK_SHOP_TOKEN_EXPIRE_AT || '',
          shop_id: process.env.TIKTOK_SHOP_ID || '',
          shop_cipher: process.env.TIKTOK_SHOP_CIPHER || '',
          shop_name: process.env.TIKTOK_SHOP_NAME || '',
          seller_name: process.env.TIKTOK_SHOP_SELLER_NAME || '',
          warehouse_id: process.env.TIKTOK_SHOP_WAREHOUSE_ID || '',
          warehouse_name: process.env.TIKTOK_SHOP_WAREHOUSE_NAME || '',
        };
        
        await existingConfig.save();
        console.log('Config document updated with environment variables');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Config:', error);
  }
};

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('MongoDB connected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('MongoDB reconnected');
});

export { isConnected };
export default connectDB;