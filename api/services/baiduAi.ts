import axios from 'axios';
import FormData from 'form-data';

interface BaiduAiConfig {
  apiKey: string;
  secretKey: string;
}

interface ImageEnlargeResult {
  success: boolean;
  image_url?: string;
  error?: string;
}

class BaiduAiService {
  private apiKey: string;
  private secretKey: string;
  private accessToken: string = '';
  private tokenExpireTime: number = 0;

  constructor(config: BaiduAiConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpireTime > now) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://aip.baidubce.com/oauth/2.0/token',
        null,
        {
          params: {
            grant_type: 'client_credentials',
            client_id: this.apiKey,
            client_secret: this.secretKey,
          },
          timeout: 30000,
        }
      );

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        this.tokenExpireTime = now + (response.data.expires_in || 30 * 60) * 1000;
        return this.accessToken;
      }

      throw new Error('Failed to get access token');
    } catch (error) {
      const err = error as Error & { response?: { data?: { error_description?: string } } };
      console.error('Baidu AI access token error:', err.message);
      throw new Error(`获取access_token失败: ${err.response?.data?.error_description || err.message}`);
    }
  }

  private async downloadImageToBase64(imageUrl: string): Promise<string> {
    try {
      console.log('Downloading image:', imageUrl);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': new URL(imageUrl).origin,
          'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0',
        },
        maxRedirects: 10,
        validateStatus: (status) => status < 500,
      });

      console.log('Image download status:', response.status);
      console.log('Response headers:', JSON.stringify(response.headers));

      if (response.status === 403) {
        throw new Error(`403 Forbidden - Server rejected the request`);
      }

      const buffer = Buffer.from(response.data, 'binary');
      return buffer.toString('base64');
    } catch (error) {
      const err = error as Error & { response?: { data?: { toString?: () => string }; headers?: Record<string, string> } };
      console.error('Failed to download image:', err.message);
      console.error('Response data:', err.response?.data?.toString?.());
      console.error('Response headers:', err.response?.headers);
      throw new Error(`下载图片失败: ${err.message}`);
    }
  }

  async imageEnlarge(imageUrl: string, imageBase64?: string): Promise<ImageEnlargeResult> {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = imageBase64 || await this.downloadImageToBase64(imageUrl);

      const formData = new FormData();
      formData.append('image', base64Image);

      const response = await axios.post(
        'https://aip.baidubce.com/rest/2.0/image-process/v1/image_quality_enhance',
        formData,
        {
          params: {
            access_token: accessToken,
          },
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000,
        }
      );

      const data = response.data;

      if (data.error_code) {
        return {
          success: false,
          error: `API错误 ${data.error_code}: ${data.error_msg}`,
        };
      }

      if (data.image) {
        return {
          success: true,
          image_url: `data:image/png;base64,${data.image}`,
        };
      }

      return {
        success: false,
        error: '未返回处理后的图片',
      };
    } catch (error) {
      const err = error as Error & { response?: { data?: { error_msg?: string } } };
      console.error('Baidu AI image enlarge error:', err.message);
      return {
        success: false,
        error: `图片放大失败: ${err.response?.data?.error_msg || err.message}`,
      };
    }
  }

  async imageSuperResolution(imageUrl: string, scale: number = 2, imageBase64?: string): Promise<ImageEnlargeResult> {
    try {
      const accessToken = await this.getAccessToken();
      const base64Image = imageBase64 || await this.downloadImageToBase64(imageUrl);

      const formData = new FormData();
      formData.append('image', base64Image);
      formData.append('scale', scale.toString());

      const response = await axios.post(
        'https://aip.baidubce.com/rest/2.0/image-process/v1/super_resolution',
        formData,
        {
          params: {
            access_token: accessToken,
          },
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000,
        }
      );

      const data = response.data;

      if (data.error_code) {
        return {
          success: false,
          error: `API错误 ${data.error_code}: ${data.error_msg}`,
        };
      }

      if (data.image) {
        return {
          success: true,
          image_url: `data:image/png;base64,${data.image}`,
        };
      }

      return {
        success: false,
        error: '未返回处理后的图片',
      };
    } catch (error) {
      const err = error as Error & { response?: { data?: { error_msg?: string } } };
      console.error('Baidu AI super resolution error:', err.message);
      return {
        success: false,
        error: `图片超分辨率失败: ${err.response?.data?.error_msg || err.message}`,
      };
    }
  }
}

export default BaiduAiService;