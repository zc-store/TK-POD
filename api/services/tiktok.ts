import axios from 'axios';
import crypto from 'crypto';

interface TiktokConfig {
  apiKey: string;
  apiSecret: string;
  serviceId?: string;
  region: string;
  redirectUri: string;
}

interface TokenResult {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface PublishResult {
  success: boolean;
  product_id?: string;
  error?: string;
}

interface UploadImageResult {
  success: boolean;
  img_id?: string;
  image_url?: string;
  error?: string;
}

interface Category {
  category_id: string;
  name: string;
  parent_id?: string;
  children?: Category[];
}

interface CategoryResult {
  success: boolean;
  categories?: Category[];
  error?: string;
}

class TiktokService {
  private apiKey: string;
  private apiSecret: string;
  private serviceId?: string;
  private region: string;
  private redirectUri: string;
  private baseUrl = 'https://open-api.tiktokglobalshop.com';

  constructor(config: TiktokConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.serviceId = config.serviceId;
    this.region = config.region;
    this.redirectUri = config.redirectUri;
  }

  getAuthorizationUrl(state?: string): string {
    const isUS = this.region === 'US';
    const authUrl = isUS 
      ? 'https://services.tiktokshops.us/open/authorize'
      : 'https://services.tiktokshop.com/open/authorize';
    
    const params = new URLSearchParams({
      app_key: this.apiKey,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'seller.product.basic,seller.product.write,seller.shop.info,seller.global_product.write,seller.authorization.info',
      state: state || 'smart_listing',
    });
    
    if (this.serviceId) {
      params.append('service_id', this.serviceId);
    }
    
    return `${authUrl}?${params.toString()}`;
  }

  async exchangeToken(code: string): Promise<TokenResult & { seller_name?: string; user_type?: number; granted_scopes?: string[] }> {
    try {
      const params = new URLSearchParams({
        app_key: this.apiKey,
        app_secret: this.apiSecret,
        auth_code: code,
        grant_type: 'authorized_code',
      });

      const response = await axios.get(
        `https://auth.tiktok-shops.com/api/v2/token/get?${params.toString()}`,
        {
          timeout: 30000,
        }
      );

      console.log('[TikTok] exchangeToken full response:', JSON.stringify(response.data));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Token exchange failed',
        };
      }

      const data = response.data.data;
      console.log('[TikTok] exchangeToken data:', JSON.stringify(data));
      console.log('[TikTok] exchangeToken access_token:', data.access_token);
      console.log('[TikTok] exchangeToken refresh_token:', data.refresh_token);
      console.log('[TikTok] exchangeToken seller_name:', data.seller_name);
      console.log('[TikTok] exchangeToken user_type:', data.user_type);
      console.log('[TikTok] exchangeToken granted_scopes:', data.granted_scopes);

      return {
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.access_token_expire_in,
        seller_name: data.seller_name,
        user_type: data.user_type,
        granted_scopes: data.granted_scopes,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    try {
      const response = await axios.get(
        `https://auth.tiktok-shops.com/api/v2/token/refresh?${new URLSearchParams({
          app_key: this.apiKey,
          app_secret: this.apiSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        })}`,
        {
          timeout: 30000,
        }
      );

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Token refresh failed',
        };
      }

      return {
        success: true,
        access_token: response.data.data.access_token,
        refresh_token: response.data.data.refresh_token,
        expires_in: response.data.data.access_token_expire_in,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getWarehouses(accessToken: string, shopCipher?: string): Promise<{ success: boolean; warehouses?: { warehouse_id: string }[]; error?: string }> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
      };

      if (shopCipher) {
        params.shop_cipher = shopCipher;
      }

      const signature = this.signRequest(params, '/logistics/202309/warehouses');
      const fullUrl = `${this.baseUrl}/logistics/202309/warehouses?${new URLSearchParams({ ...params, sign: signature })}`;

      console.log('[TikTok] getWarehouses - full URL:', fullUrl);

      const response = await axios.get(fullUrl, {
        headers: {
          'x-tts-access-token': accessToken,
        },
        timeout: 30000,
      });

      console.log('[TikTok] getWarehouses - response:', JSON.stringify(response.data));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Failed to get warehouses',
        };
      }

      const warehouses = response.data.data?.warehouses || [];
      console.log('[TikTok] getWarehouses - first warehouse:', JSON.stringify(warehouses[0] || {}));
      console.log('[TikTok] getWarehouses - warehouse keys:', warehouses.length > 0 ? Object.keys(warehouses[0]) : []);

      return {
        success: true,
        warehouses: warehouses.map((w: Record<string, unknown>) => ({
          warehouse_id: w.id || w.warehouse_id,
          name: w.name || '',
          type: w.type || '',
          is_default: w.is_default || false,
          effect_status: w.effect_status || '',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private signRequest(params: Record<string, string>, path?: string, body?: string): string {
    const sortedKeys = Object.keys(params).filter(key => key !== 'sign' && key !== 'access_token').sort();
    let stringToSign = '';
    sortedKeys.forEach(key => {
      stringToSign += `${key}${params[key]}`;
    });
    if (path) {
      stringToSign = path + stringToSign;
    }
    if (body) {
      stringToSign += body;
    }
    stringToSign = this.apiSecret + stringToSign + this.apiSecret;
    
    console.log('[TikTok] signRequest - stringToSign:', stringToSign);
    console.log('[TikTok] signRequest - params:', JSON.stringify(params));
    console.log('[TikTok] signRequest - path:', path);
    console.log('[TikTok] signRequest - body:', body ? body.substring(0, 100) + '...' : null);
    
    return crypto.createHmac('sha256', this.apiSecret).update(stringToSign).digest('hex');
  }

  async publishProduct(
    accessToken: string,
    productData: {
      name: string;
      description: string;
      category_id: string;
      images: string[];
      price: number;
      currency: string;
      inventory: number;
      sku: string;
      shop_id?: string;
      shop_cipher?: string;
      warehouse_id?: string;
      variants?: {
        size: string;
        price: number;
        inventory: number;
        sku: string;
      }[];
    }
  ): Promise<PublishResult> {
    try {
      let warehouseId = productData.warehouse_id;
      if (!warehouseId) {
        const warehouseResult = await this.getWarehouses(accessToken, productData.shop_cipher);
        if (warehouseResult.success && warehouseResult.warehouses && warehouseResult.warehouses.length > 0) {
          const salesWarehouses = warehouseResult.warehouses.filter((w: { type?: string; effect_status?: string }) => w.type === 'SALES_WAREHOUSE' && w.effect_status === 'ENABLED');
          if (salesWarehouses.length > 0) {
            warehouseId = salesWarehouses[salesWarehouses.length - 1].warehouse_id;
            console.log('[TikTok] publishProduct - Using sales warehouse:', warehouseId, 'total sales warehouses:', salesWarehouses.length);
          } else {
            warehouseId = warehouseResult.warehouses[0].warehouse_id;
            console.log('[TikTok] publishProduct - No sales warehouse found, using first:', warehouseId);
          }
        } else {
          console.warn('[TikTok] publishProduct - No warehouse found, using default');
          warehouseId = '0';
        }
      }

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
      };

      if (productData.shop_cipher) {
        params.shop_cipher = productData.shop_cipher;
      } else if (productData.shop_id) {
        params.shop_id = productData.shop_id;
      }

      const payload: Record<string, unknown> = {
        title: productData.name,
        description: productData.description,
        category_id: productData.category_id,
        main_images: productData.images.map((img: string) => ({ uri: img })),
        price: {
          amount: productData.price.toString(),
          currency: productData.currency,
        },
        skus: [
          {
            seller_sku: productData.sku,
            inventory: [
              {
                quantity: productData.inventory,
                warehouse_id: warehouseId,
              },
            ],
            price: {
              amount: productData.price.toString(),
              currency: productData.currency,
            },
          },
        ],
        package_weight: {
          value: '0.5',
          unit: 'KILOGRAM',
        },
        package_dimensions: {
          length: '20',
          width: '15',
          height: '5',
          unit: 'CENTIMETER',
        },
        category_version: 'v2',
      };

      if (productData.variants && productData.variants.length > 1) {
        payload.skus = productData.variants.map((v) => ({
          seller_sku: v.sku,
          sales_attributes: [
            {
              name: 'Size',
              value_name: v.size,
            },
          ],
          inventory: [
            {
              quantity: v.inventory,
              warehouse_id: warehouseId,
            },
          ],
          price: {
            amount: v.price.toString(),
            currency: productData.currency,
          },
        }));
      }

      const payloadJson = JSON.stringify(payload);
      const signature = this.signRequest(params, '/product/202309/products', payloadJson);

      const fullUrl = `${this.baseUrl}/product/202309/products?${new URLSearchParams({ ...params, sign: signature })}`;
      console.log('[TikTok] publishProduct - full URL:', fullUrl);
      console.log('[TikTok] publishProduct - accessToken prefix:', accessToken.substring(0, 5));
      console.log('[TikTok] publishProduct - payload:', JSON.stringify(payload).substring(0, 500));
      
      const response = await axios.post(
        fullUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': accessToken,
          },
          timeout: 60000,
        }
      );
      
      console.log('[TikTok] publishProduct - response:', JSON.stringify(response.data));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Product creation failed',
        };
      }

      return {
        success: true,
        product_id: response.data.data.product_id,
      };
      
    } catch (error) {
      const err = error as Error & { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      console.log('[TikTok] publishProduct error:', errorMessage);
      console.log('[TikTok] publishProduct error response:', JSON.stringify(err.response?.data));
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async checkProductListing(
    accessToken: string,
    productData: {
      name: string;
      description: string;
      category_id: string;
      images: string[];
      price: number;
      currency: string;
      inventory: number;
      sku: string;
      shop_id?: string;
      shop_cipher?: string;
      warehouse_id?: string;
      variants?: {
        size: string;
        price: number;
        inventory: number;
        sku: string;
      }[];
    }
  ): Promise<{
    success: boolean;
    valid?: boolean;
    issues?: any[];
    error?: string;
  }> {
    try {
      let warehouseId = productData.warehouse_id;
      if (!warehouseId) {
        const warehouseResult = await this.getWarehouses(accessToken, productData.shop_cipher);
        if (warehouseResult.success && warehouseResult.warehouses && warehouseResult.warehouses.length > 0) {
          const salesWarehouse = warehouseResult.warehouses.find((w: { type?: string }) => w.type === 'SALES_WAREHOUSE');
          if (salesWarehouse) {
            warehouseId = salesWarehouse.warehouse_id;
          } else {
            warehouseId = warehouseResult.warehouses[0].warehouse_id;
          }
        } else {
          warehouseId = '0';
        }
      }

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
      };

      if (productData.shop_cipher) {
        params.shop_cipher = productData.shop_cipher;
      } else if (productData.shop_id) {
        params.shop_id = productData.shop_id;
      }

      const payload: Record<string, unknown> = {
        title: productData.name,
        description: productData.description,
        category_id: productData.category_id,
        main_images: productData.images.map((img: string) => ({ uri: img })),
        price: {
          amount: productData.price.toString(),
          currency: productData.currency,
        },
        skus: [
          {
            seller_sku: productData.sku,
            inventory: [
              {
                quantity: productData.inventory,
                warehouse_id: warehouseId,
              },
            ],
            price: {
              amount: productData.price.toString(),
              currency: productData.currency,
            },
          },
        ],
        package_weight: {
          value: '0.5',
          unit: 'KILOGRAM',
        },
        package_dimensions: {
          length: '20',
          width: '15',
          height: '5',
          unit: 'CENTIMETER',
        },
        category_version: 'v2',
      };

      if (productData.variants && productData.variants.length > 1) {
        payload.skus = productData.variants.map((v) => ({
          seller_sku: v.sku,
          sales_attributes: [
            {
              name: 'Size',
              value_name: v.size,
            },
          ],
          inventory: [
            {
              quantity: v.inventory,
              warehouse_id: warehouseId,
            },
          ],
          price: {
            amount: v.price.toString(),
            currency: productData.currency,
          },
        }));
      }

      const payloadJson = JSON.stringify(payload);
      const signature = this.signRequest(params, '/product/202309/products/check', payloadJson);

      const fullUrl = `${this.baseUrl}/product/202309/products/check?${new URLSearchParams({ ...params, sign: signature })}`;
      console.log('[TikTok] checkProductListing - full URL:', fullUrl);
      
      const response = await axios.post(
        fullUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': accessToken,
          },
          timeout: 60000,
        }
      );
      
      console.log('[TikTok] checkProductListing - response:', JSON.stringify(response.data));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Product check failed',
        };
      }

      return {
        success: true,
        valid: response.data.data?.valid,
        issues: response.data.data?.issues,
      };
      
    } catch (error) {
      const err = error as Error & { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
      console.log('[TikTok] checkProductListing error:', errorMessage);
      console.log('[TikTok] checkProductListing error response:', JSON.stringify(err.response?.data));
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async uploadProductImage(
    accessToken: string,
    imageData: Buffer,
    useCase: 'MAIN_IMAGE' | 'ATTRIBUTE_IMAGE' | 'DESCRIPTION_IMAGE' = 'MAIN_IMAGE',
    shopId?: string
  ): Promise<UploadImageResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
      };
      
      if (shopId) {
        params.shop_id = shopId;
      }

      const signature = this.signRequest(params, '/product/202309/images/upload');
      
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('data', imageData, { filename: 'image.jpg', contentType: 'image/jpeg' });
      formData.append('use_case', useCase);
      
      const fullUrl = `${this.baseUrl}/product/202309/images/upload?${new URLSearchParams({ ...params, sign: signature })}`;
      console.log('[TikTok] uploadProductImage - full URL:', fullUrl);
      console.log('[TikTok] uploadProductImage - accessToken prefix:', accessToken.substring(0, 5));
      console.log('[TikTok] uploadProductImage - shop_id:', shopId);
      
      const response = await axios.post(
        fullUrl,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-tts-access-token': accessToken,
          },
          timeout: 60000,
        }
      );

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Image upload failed',
        };
      }

      return {
        success: true,
        img_id: response.data.data.uri,
        image_url: response.data.data.url,
      };
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.log('[TikTok] uploadProductImage error:', errorMessage);
      console.log('[TikTok] uploadProductImage error response:', JSON.stringify(error.response?.data));
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async uploadProductImageByUrl(
    accessToken: string,
    imageUrl: string,
    useCase: 'MAIN_IMAGE' | 'ATTRIBUTE_IMAGE' | 'DESCRIPTION_IMAGE' = 'MAIN_IMAGE',
    shopId?: string
  ): Promise<UploadImageResult> {
    try {
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      
      const bufferData = Buffer.from(imageResponse.data);
      
      return this.uploadProductImage(accessToken, bufferData, useCase, shopId);
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download image',
      };
    }
  }

  async getCategories(accessToken: string, shopCipher?: string, categoryVersion?: string): Promise<CategoryResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
      };

      if (shopCipher) {
        params.shop_cipher = shopCipher;
      }

      if (categoryVersion) {
        params.category_version = categoryVersion;
      }

      const signature = this.signRequest(params, '/product/202309/categories');
      
      const response = await axios.get(
        `${this.baseUrl}/product/202309/categories?${new URLSearchParams({ ...params, sign: signature })}`,
        {
          headers: {
            'x-tts-access-token': accessToken,
          },
          timeout: 30000,
        }
      );

      console.log('[TikTok] getCategories - response:', JSON.stringify(response.data).substring(0, 2000));
      console.log('[TikTok] getCategories - data keys:', Object.keys(response.data.data || {}));
      if (response.data.data?.categories && response.data.data.categories.length > 0) {
        console.log('[TikTok] getCategories - first category:', JSON.stringify(response.data.data.categories[0]));
      }

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Failed to get categories',
        };
      }

      const categories = response.data.data.categories || [];
      const normalizedCategories = categories.map((cat: any) => ({
        category_id: cat.id || cat.category_id || '',
        name: cat.local_name || cat.name || cat.category_name || '',
        parent_id: cat.parent_id || cat.parent_category_id || '',
        is_leaf: cat.is_leaf || cat.leaf || false,
        children: cat.children || [],
        permission_statuses: cat.permission_statuses || [],
      }));

      return {
        success: true,
        categories: normalizedCategories,
      };
      
    } catch (error: any) {
      console.log('[TikTok] getCategories error:', error.response?.data || error.message);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async recommendCategory(
    accessToken: string,
    productName: string,
    description?: string,
    shopCipher?: string
  ): Promise<CategoryResult> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
        product_name: productName,
      };

      if (shopCipher) {
        params.shop_cipher = shopCipher;
      }

      const signature = this.signRequest(params, '/product/202309/categories/recommend');
      
      const response = await axios.get(
        `${this.baseUrl}/product/202309/categories/recommend?${new URLSearchParams({ ...params, sign: signature })}`,
        {
          headers: {
            'x-tts-access-token': accessToken,
          },
          timeout: 30000,
        }
      );

      console.log('[TikTok] recommendCategory - response:', JSON.stringify(response.data));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Failed to recommend category',
        };
      }

      return {
        success: true,
        categories: response.data.data.categories,
      };
      
    } catch (error: any) {
      console.log('[TikTok] recommendCategory error:', error.response?.data || error.message);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCategoryAttributes(
    accessToken: string,
    categoryId: string,
    shopCipher?: string,
    categoryVersion?: string
  ): Promise<{
    success: boolean;
    attributes?: any[];
    error?: string;
  }> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
        category_id: categoryId,
      };

      if (shopCipher) {
        params.shop_cipher = shopCipher;
      }

      if (categoryVersion) {
        params.category_version = categoryVersion;
      }

      const signature = this.signRequest(params, '/product/202309/categories/attributes');
      
      const response = await axios.get(
        `${this.baseUrl}/product/202309/categories/attributes?${new URLSearchParams({ ...params, sign: signature })}`,
        {
          headers: {
            'x-tts-access-token': accessToken,
          },
          timeout: 30000,
        }
      );

      console.log('[TikTok] getCategoryAttributes - response:', JSON.stringify(response.data).substring(0, 1000));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Failed to get category attributes',
        };
      }

      return {
        success: true,
        attributes: response.data.data.attributes,
      };
      
    } catch (error: any) {
      console.log('[TikTok] getCategoryAttributes error:', error.response?.data || error.message);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAuthorizedShops(accessToken: string): Promise<{
    success: boolean;
    shops?: { shop_id: string; shop_name: string; shop_cipher?: string }[];
    error?: string;
  }> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        app_key: this.apiKey,
        timestamp,
      };

      const signature = this.signRequest(params, '/authorization/202309/shops');
      
      console.log('[TikTok] getAuthorizedShops - baseUrl:', this.baseUrl);
      console.log('[TikTok] getAuthorizedShops - accessToken prefix:', accessToken.substring(0, 5));
      console.log('[TikTok] getAuthorizedShops - region:', this.region);
      
      const response = await axios.get(
        `${this.baseUrl}/authorization/202309/shops?${new URLSearchParams({ ...params, sign: signature })}`,
        {
          headers: {
            'x-tts-access-token': accessToken,
          },
          timeout: 30000,
        }
      );

      console.log('[TikTok] getAuthorizedShops response:', JSON.stringify(response.data));

      if (response.data.code !== 0) {
        return {
          success: false,
          error: response.data.message || 'Failed to get shops',
        };
      }

      return {
        success: true,
        shops: response.data.data.shops.map((shop: any) => ({
          shop_id: shop.id,
          shop_name: shop.name,
          shop_cipher: shop.cipher || '',
        })),
      };
      
    } catch (error: any) {
      console.log('[TikTok] getAuthorizedShops error:', error.response?.data || error.message);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSellerToken(accessToken: string, shopId: string): Promise<{
    success: boolean;
    seller_token?: string;
    error?: string;
  }> {
    try {
      console.log('[TikTok] getSellerToken - accessToken:', accessToken.substring(0, 10), '...');
      console.log('[TikTok] getSellerToken - shopId:', shopId);
      
      if (accessToken.startsWith('TTP_')) {
        return {
          success: true,
          seller_token: accessToken,
        };
      }

      return {
        success: false,
        error: 'Cannot get seller token: access_token is not a TTP token',
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default TiktokService;