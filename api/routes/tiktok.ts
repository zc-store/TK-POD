import { Router, Request, Response } from 'express';
import axios from 'axios';
import TiktokService from '../services/tiktok';
import Config from '../models/Config';

const router = Router();

// 辅助函数：获取TikTok配置（数据库优先，环境变量作为后备）
async function getTiktokConfig() {
  const config = await Config.findOne();
  const tiktokShop = config?.toObject().tiktok_shop || {};
  
  return {
    api_key: tiktokShop.api_key || process.env.TIKTOK_SHOP_API_KEY || '',
    api_secret: tiktokShop.api_secret || process.env.TIKTOK_SHOP_API_SECRET || '',
    service_id: tiktokShop.service_id || '',
    region: tiktokShop.region || process.env.TIKTOK_SHOP_REGION || 'US',
    redirect_uri: tiktokShop.redirect_uri || process.env.TIKTOK_SHOP_REDIRECT_URI || '',
    access_token: tiktokShop.access_token || process.env.TIKTOK_SHOP_ACCESS_TOKEN || '',
    refresh_token: tiktokShop.refresh_token || process.env.TIKTOK_SHOP_REFRESH_TOKEN || '',
    token_expire_at: tiktokShop.token_expire_at || process.env.TIKTOK_SHOP_TOKEN_EXPIRE_AT || '',
    shop_id: tiktokShop.shop_id || process.env.TIKTOK_SHOP_ID || '',
    shop_cipher: tiktokShop.shop_cipher || process.env.TIKTOK_SHOP_CIPHER || '',
    shop_name: tiktokShop.shop_name || process.env.TIKTOK_SHOP_NAME || '',
    seller_name: tiktokShop.seller_name || process.env.TIKTOK_SHOP_SELLER_NAME || '',
    user_type: tiktokShop.user_type || 0,
    granted_scopes: tiktokShop.granted_scopes || [],
    last_auth_time: tiktokShop.last_auth_time || '',
    warehouse_id: tiktokShop.warehouse_id || process.env.TIKTOK_SHOP_WAREHOUSE_ID || '',
    warehouse_name: tiktokShop.warehouse_name || process.env.TIKTOK_SHOP_WAREHOUSE_NAME || '',
  };
}

router.get('/authorize-url', async (req: Request, res: Response) => {
  try {
    const { api_key, api_secret, service_id, region, redirect_uri } = await getTiktokConfig();

    if (!api_key || !api_secret) {
      return res.status(400).json({ success: false, error: 'TikTok Shop API key or secret not configured' });
    }

    if (!redirect_uri) {
      return res.status(400).json({ success: false, error: 'TikTok Shop redirect URI not configured' });
    }

    const tiktok = new TiktokService({ apiKey: api_key, apiSecret: api_secret, serviceId: service_id, region, redirectUri: redirect_uri });
    const url = tiktok.getAuthorizationUrl('smart_listing');

    res.status(200).json({ success: true, data: { url } });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.getCategories(
      tiktokConfig.access_token,
      tiktokConfig.shop_cipher,
      'v2'
    );

    if (result.success) {
      res.status(200).json({ success: true, data: result.categories });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/categories/recommend', async (req: Request, res: Response) => {
  try {
    const productName = req.query.product_name as string;
    if (!productName) {
      return res.status(400).json({ success: false, error: 'product_name is required' });
    }

    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.recommendCategory(
      tiktokConfig.access_token,
      productName,
      '',
      tiktokConfig.shop_cipher
    );

    if (result.success) {
      res.status(200).json({ success: true, data: result.categories });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/categories/raw', async (req: Request, res: Response) => {
  try {
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found' });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      app_key: tiktokConfig.api_key,
      timestamp,
      shop_cipher: tiktokConfig.shop_cipher,
      category_version: 'v2',
    };

    const signature = '';
    
    const response = await axios.get(
      `https://open-api.tiktokglobalshop.com/product/202309/categories?${new URLSearchParams({ ...params, sign: signature })}`,
      {
        headers: {
          'x-tts-access-token': tiktokConfig.access_token,
        },
        timeout: 30000,
      }
    );

    const rawCategories = response.data.data?.categories || [];
    const firstCategory = rawCategories[0] || {};
    const categoryKeys = Object.keys(firstCategory);
    
    const leafCategories = rawCategories.filter((cat: Record<string, unknown>) => cat.is_leaf || cat.leaf);
    
    const rugLike = rawCategories.filter((cat: Record<string, unknown>) => {
      const name = String(cat.name || cat.category_name || cat.display_name || cat.local_name || '');
      return name.toLowerCase().includes('rug') || name.toLowerCase().includes('carpet') || name.toLowerCase().includes('mat');
    }).slice(0, 20);

    res.status(200).json({ 
      success: true, 
      total: rawCategories.length,
      leaf_count: leafCategories.length,
      first_category_keys: categoryKeys,
      first_category: firstCategory,
      rug_like_categories: rugLike,
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      response: (error as { response?: { data?: unknown } })?.response?.data
    });
  }
});

router.get('/categories/attributes', async (req: Request, res: Response) => {
  try {
    const categoryId = req.query.category_id as string;
    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'category_id is required' });
    }

    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.getCategoryAttributes(
      tiktokConfig.access_token,
      categoryId,
      tiktokConfig.shop_cipher,
      'v2'
    );

    if (result.success) {
      res.status(200).json({ success: true, data: result.attributes });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    
    console.log('[TikTok GET Callback] Received request:', { code: code ? '***' : null });
    
    if (!code) {
      console.error('[TikTok GET Callback] Error: Authorization code is required');
      return res.redirect('/?auth=failed');
    }

    const tiktokConfig = await getTiktokConfig();

    console.log('[TikTok GET Callback] Using config:', { apiKey: tiktokConfig.api_key, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.exchangeToken(code);

    console.log('[TikTok GET Callback] Exchange token result:', { 
      success: result.success, 
      error: result.error,
      access_token: result.access_token ? result.access_token.substring(0, 20) + '...' : null,
      refresh_token: result.refresh_token ? result.refresh_token.substring(0, 20) + '...' : null,
      expires_in: result.expires_in,
      seller_name: result.seller_name,
      user_type: result.user_type,
    });

    if (!result.success) {
      return res.redirect('http://localhost:5173/?auth=failed&error=' + encodeURIComponent(result.error || 'Unknown error'));
    }

    const appToken = result.access_token || '';
    
    let shopId = '';
    let shopCipher = '';
    let shopName = '';
    let sellerToken = '';
    
    try {
      const shopsResult = await tiktok.getAuthorizedShops(appToken);
      console.log('[TikTok GET Callback] Get shops result:', shopsResult);
      
      if (shopsResult.success && shopsResult.shops && shopsResult.shops.length > 0) {
        shopId = shopsResult.shops[0].shop_id;
        shopCipher = shopsResult.shops[0].shop_cipher || '';
        shopName = shopsResult.shops[0].shop_name || '';
        console.log('[TikTok GET Callback] Found shop:', shopId, 'name:', shopName, 'cipher:', shopCipher);
        
        if (shopCipher.startsWith('TTP_')) {
          sellerToken = shopCipher;
          console.log('[TikTok GET Callback] Using shop_cipher as seller token:', sellerToken.substring(0, 20) + '...');
        }
      }
    } catch (error) {
      console.error('[TikTok GET Callback] Error getting shops:', error);
    }

    const expireAt = result.expires_in 
      ? new Date(Date.now() + result.expires_in * 1000).toISOString() 
      : '';

    let dbConfig = await Config.findOne();
    if (!dbConfig) {
      dbConfig = new Config();
    }

    dbConfig.tiktok_shop.access_token = result.access_token || '';
    dbConfig.tiktok_shop.refresh_token = result.refresh_token || '';
    dbConfig.tiktok_shop.token_expire_at = expireAt;
    dbConfig.tiktok_shop.shop_id = shopId;
    dbConfig.tiktok_shop.shop_cipher = shopCipher;
    dbConfig.tiktok_shop.shop_name = shopName;
    dbConfig.tiktok_shop.seller_name = result.seller_name || '';
    dbConfig.tiktok_shop.user_type = result.user_type || 0;
    dbConfig.tiktok_shop.granted_scopes = result.granted_scopes || [];
    dbConfig.tiktok_shop.last_auth_time = new Date().toISOString();
    await dbConfig.save();
    
    console.log('[TikTok GET Callback] Saved access_token type:', dbConfig.tiktok_shop.access_token.startsWith('TTP') ? 'TTP/seller_token' : 'ROW/app_token');

    console.log('[TikTok GET Callback] Successfully saved to database');

    res.redirect('http://localhost:5173/?auth=success');
    
  } catch (error) {
    console.error('[TikTok GET Callback] Exception:', error);
    res.redirect('http://localhost:5173/?auth=failed&error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
});

router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    
    console.log('[TikTok Callback] Received request:', { code: code ? '***' : null });
    
    if (!code) {
      console.error('[TikTok Callback] Error: Authorization code is required');
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }

    const tiktokConfig = await getTiktokConfig();

    console.log('[TikTok Callback] Using config:', { apiKey: tiktokConfig.api_key, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.exchangeToken(code);

    console.log('[TikTok Callback] Exchange token result:', { 
      success: result.success, 
      error: result.error,
      seller_name: result.seller_name,
      user_type: result.user_type,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const appToken = result.access_token || '';
    
    let shopId = '';
    let shopCipher = '';
    let shopName = '';
    let sellerToken = '';
    
    try {
      const shopsResult = await tiktok.getAuthorizedShops(appToken);
      console.log('[TikTok Callback] Get shops result:', shopsResult);
      
      if (shopsResult.success && shopsResult.shops && shopsResult.shops.length > 0) {
        shopId = shopsResult.shops[0].shop_id;
        shopCipher = shopsResult.shops[0].shop_cipher || '';
        shopName = shopsResult.shops[0].shop_name || '';
        console.log('[TikTok Callback] Found shop:', shopId, 'name:', shopName, 'cipher:', shopCipher);
        
        if (shopCipher.startsWith('TTP_')) {
          sellerToken = shopCipher;
          console.log('[TikTok Callback] Using shop_cipher as seller token:', sellerToken.substring(0, 20) + '...');
        }
      }
    } catch (error) {
      console.error('[TikTok Callback] Error getting shops:', error);
    }

    const expireAt = result.expires_in 
      ? new Date(Date.now() + result.expires_in * 1000).toISOString() 
      : '';

    let dbConfig = await Config.findOne();
    if (!dbConfig) {
      dbConfig = new Config();
    }

    dbConfig.tiktok_shop.access_token = result.access_token || '';
    dbConfig.tiktok_shop.refresh_token = result.refresh_token || '';
    dbConfig.tiktok_shop.token_expire_at = expireAt;
    dbConfig.tiktok_shop.shop_id = shopId;
    dbConfig.tiktok_shop.shop_cipher = shopCipher;
    dbConfig.tiktok_shop.shop_name = shopName;
    dbConfig.tiktok_shop.seller_name = result.seller_name || '';
    dbConfig.tiktok_shop.user_type = result.user_type || 0;
    dbConfig.tiktok_shop.granted_scopes = result.granted_scopes || [];
    dbConfig.tiktok_shop.last_auth_time = new Date().toISOString();
    await dbConfig.save();

    console.log('[TikTok Callback] Successfully saved to database');

    res.status(200).json({ success: true, data: {
      access_token: sellerToken || result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      shop_id: shopId,
      shop_name: shopName,
      seller_name: result.seller_name,
    } });
    
  } catch (error) {
    console.error('[TikTok Callback] Exception:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/config', async (req: Request, res: Response) => {
  try {
    const { tiktok_shop } = req.body;
    
    let config = await Config.findOne();
    if (!config) {
      config = new Config();
    }

    if (tiktok_shop) {
      const original = { ...config.tiktok_shop };
      
      config.tiktok_shop = {
        ...config.tiktok_shop,
        ...tiktok_shop,
      };
      
      if (!tiktok_shop.access_token && original.access_token) {
        config.tiktok_shop.access_token = original.access_token;
      }
      if (!tiktok_shop.refresh_token && original.refresh_token) {
        config.tiktok_shop.refresh_token = original.refresh_token;
      }
      if (!tiktok_shop.token_expire_at && original.token_expire_at) {
        config.tiktok_shop.token_expire_at = original.token_expire_at;
      }
      if (!tiktok_shop.shop_id && original.shop_id) {
        config.tiktok_shop.shop_id = original.shop_id;
      }
      if (!tiktok_shop.shop_cipher && original.shop_cipher) {
        config.tiktok_shop.shop_cipher = original.shop_cipher;
      }
      if (!tiktok_shop.shop_name && original.shop_name) {
        config.tiktok_shop.shop_name = original.shop_name;
      }
      if (!tiktok_shop.seller_name && original.seller_name) {
        config.tiktok_shop.seller_name = original.seller_name;
      }
    }

    await config.save();

    res.status(200).json({ success: true, data: config.tiktok_shop });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await Config.findOne();
    
    // 从数据库获取配置，如果没有则使用空对象
    const tiktokShop = config?.toObject().tiktok_shop || {};
    
    // 从环境变量获取授权相关配置作为后备
    const accessToken = tiktokShop.access_token || process.env.TIKTOK_SHOP_ACCESS_TOKEN || '';
    const refreshToken = tiktokShop.refresh_token || process.env.TIKTOK_SHOP_REFRESH_TOKEN || '';
    const tokenExpireAt = tiktokShop.token_expire_at || process.env.TIKTOK_SHOP_TOKEN_EXPIRE_AT || '';
    const shopId = tiktokShop.shop_id || process.env.TIKTOK_SHOP_ID || '';
    const shopCipher = tiktokShop.shop_cipher || process.env.TIKTOK_SHOP_CIPHER || '';
    const shopName = tiktokShop.shop_name || process.env.TIKTOK_SHOP_NAME || '';
    const sellerName = tiktokShop.seller_name || process.env.TIKTOK_SHOP_SELLER_NAME || '';
    const warehouseId = tiktokShop.warehouse_id || process.env.TIKTOK_SHOP_WAREHOUSE_ID || '';
    const warehouseName = tiktokShop.warehouse_name || process.env.TIKTOK_SHOP_WAREHOUSE_NAME || '';

    const tokenInfo = accessToken
      ? {
          is_seller_token: accessToken.startsWith('TTP_'),
          token_type: accessToken.startsWith('TTP_') ? 'Seller Token' : 'App Token',
          token_prefix: accessToken.substring(0, 10) + '...',
          is_expired: tokenExpireAt && new Date(tokenExpireAt) < new Date(),
          expire_time: tokenExpireAt,
          expires_in: tokenExpireAt 
            ? Math.max(0, Math.floor((new Date(tokenExpireAt).getTime() - Date.now()) / 1000 / 60)) 
            : null,
        }
      : null;

    const result = {
      api_key: tiktokShop.api_key || process.env.TIKTOK_SHOP_API_KEY || '',
      api_secret: tiktokShop.api_secret || process.env.TIKTOK_SHOP_API_SECRET || '',
      service_id: tiktokShop.service_id || '',
      region: tiktokShop.region || process.env.TIKTOK_SHOP_REGION || 'US',
      redirect_uri: tiktokShop.redirect_uri || process.env.TIKTOK_SHOP_REDIRECT_URI || '',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expire_at: tokenExpireAt,
      shop_id: shopId,
      shop_cipher: shopCipher,
      shop_name: shopName,
      seller_name: sellerName,
      user_type: tiktokShop.user_type || 0,
      granted_scopes: tiktokShop.granted_scopes || [],
      last_auth_time: tiktokShop.last_auth_time || '',
      warehouse_id: warehouseId,
      warehouse_name: warehouseName,
      token_info: tokenInfo,
    };

    res.status(200).json({ success: true, data: result });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.refresh_token) {
      return res.status(400).json({ success: false, error: 'Refresh token not found. Please re-authorize.' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.refreshToken(tiktokConfig.refresh_token);

    console.log('[TikTok Refresh Token] Result:', { success: result.success, error: result.error });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Save updated tokens to database
    let dbConfig = await Config.findOne();
    if (!dbConfig) {
      dbConfig = new Config();
    }
    const expireAt = result.expires_in 
      ? new Date(Date.now() + result.expires_in * 1000).toISOString() 
      : '';

    dbConfig.tiktok_shop.access_token = result.access_token || '';
    dbConfig.tiktok_shop.refresh_token = result.refresh_token || tiktokConfig.refresh_token;
    dbConfig.tiktok_shop.token_expire_at = expireAt;
    await dbConfig.save();

    res.status(200).json({ 
      success: true, 
      data: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        token_type: result.access_token?.startsWith('TTP_') ? 'Seller Token' : 'App Token',
      } 
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/warehouses', async (req: Request, res: Response) => {
  try {
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found. Please authorize first.' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.getWarehouses(
      tiktokConfig.access_token,
      tiktokConfig.shop_cipher
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, data: result.warehouses });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/shops', async (req: Request, res: Response) => {
  try {
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found. Please authorize first.' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.getAuthorizedShops(tiktokConfig.access_token);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, data: result.shops });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/categories/recommend', async (req: Request, res: Response) => {
  try {
    const { product_name, description } = req.body;
    
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found. Please authorize first.' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.recommendCategory(tiktokConfig.access_token, product_name, description, tiktokConfig.shop_cipher);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, data: result.categories });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/publish', async (req: Request, res: Response) => {
  try {
    const tiktokConfig = await getTiktokConfig();
    if (!tiktokConfig.access_token) {
      return res.status(400).json({ success: false, error: 'Access token not found. Please authorize first.' });
    }

    const tiktok = new TiktokService({ apiKey: tiktokConfig.api_key, apiSecret: tiktokConfig.api_secret, region: tiktokConfig.region, redirectUri: tiktokConfig.redirect_uri });
    const result = await tiktok.publishProduct(
      tiktokConfig.access_token,
      {
        name: 'Test Product',
        description: 'Test description',
        category_id: '1',
        images: [],
        price: 39.99,
        currency: 'USD',
        inventory: 100,
        sku: 'TEST001',
        shop_cipher: tiktokConfig.shop_cipher,
        warehouse_id: tiktokConfig.warehouse_id,
      }
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, data: { product_id: result.product_id } });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;