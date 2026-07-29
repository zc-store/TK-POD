import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';

interface JimengConfig {
  apiKey: string;
  apiSecret: string;
}

interface ImageGenerationResult {
  success: boolean;
  imageUrls?: string[];
  error?: string;
}

class JimengService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://visual.volcengineapi.com';
  private host = 'visual.volcengineapi.com';
  private region = 'cn-north-1';
  private service = 'cv';
  private reqKeyT2I = 'jimeng_t2i_v40';
  private reqKeyI2I = 'jimeng_seedream46_cvtob';

  constructor(config: JimengConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  private getDate(): { date: string; dateStamp: string } {
    const now = new Date();
    const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = date.substring(0, 8);
    return { date, dateStamp };
  }

  private uriEscape(str: string): string {
    try {
      return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
      });
    } catch (e) {
      return '';
    }
  }

  private hmac(secret: Buffer | string, s: string): Buffer {
    return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
  }

  private hash(s: string): string {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  }

  private queryParamsToString(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map((key) => {
        const val = params[key];
        if (typeof val === 'undefined' || val === null) {
          return undefined;
        }
        const escapedKey = this.uriEscape(key);
        if (!escapedKey) {
          return undefined;
        }
        return `${escapedKey}=${this.uriEscape(val)}`;
      })
      .filter((v) => v)
      .join('&');
  }

  private sign(params: {
    headers: Record<string, string>;
    query: Record<string, string>;
    method: string;
    pathName: string;
    bodySha: string;
  }): string {
    const { headers, query, method, pathName, bodySha } = params;
    const datetime = headers["X-Date"];
    const date = datetime.substring(0, 8);

    const canonicalHeaders = `host:${this.host}\nx-date:${datetime}`;
    const signedHeaders = 'host;x-date';

    const queryString = this.queryParamsToString(query) || '';
    
    const canonicalRequest = [
      method.toUpperCase(),
      pathName,
      queryString,
      `${canonicalHeaders}\n`,
      signedHeaders,
      bodySha,
    ].join('\n');

    const credentialScope = [date, this.region, this.service, "request"].join('/');
    const canonicalRequestHash = this.hash(canonicalRequest);
    const stringToSign = ["HMAC-SHA256", datetime, credentialScope, canonicalRequestHash].join('\n');

    console.log('[Jimeng Sign] === 签名调试信息 ===');
    console.log('[Jimeng Sign]   datetime:', datetime);
    console.log('[Jimeng Sign]   date:', date);
    console.log('[Jimeng Sign]   region:', this.region);
    console.log('[Jimeng Sign]   service:', this.service);
    console.log('[Jimeng Sign]   method:', method.toUpperCase());
    console.log('[Jimeng Sign]   pathName:', pathName);
    console.log('[Jimeng Sign]   queryString:', queryString);
    console.log('[Jimeng Sign]   canonicalHeaders:', JSON.stringify(canonicalHeaders));
    console.log('[Jimeng Sign]   signedHeaders:', signedHeaders);
    console.log('[Jimeng Sign]   bodySha:', bodySha);
    console.log('[Jimeng Sign]   canonicalRequest:\n', JSON.stringify(canonicalRequest));
    console.log('[Jimeng Sign]   canonicalRequestHash:', canonicalRequestHash);
    console.log('[Jimeng Sign]   credentialScope:', credentialScope);
    console.log('[Jimeng Sign]   stringToSign:\n', JSON.stringify(stringToSign));

    const kDate = this.hmac(this.apiSecret, date);
    const kRegion = this.hmac(kDate, this.region);
    const kService = this.hmac(kRegion, this.service);
    const kSigning = this.hmac(kService, "request");
    const signature = this.hmac(kSigning, stringToSign).toString('hex');

    const authorization = [
      "HMAC-SHA256",
      `Credential=${this.apiKey}/${credentialScope},`,
      `SignedHeaders=${signedHeaders},`,
      `Signature=${signature}`,
    ].join(' ');

    console.log('[Jimeng Sign]   authorization:', authorization);
    console.log('[Jimeng Sign] === 签名调试结束 ===');

    return authorization;
  }

  private getBodySha(body: string): string {
    return crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  }

  private async getTaskResult(taskId: string, reqKey: string): Promise<ImageGenerationResult> {
    const params: Record<string, string> = {
      Action: 'CVSync2AsyncGetResult',
      Version: '2022-08-31',
    };

    const body = JSON.stringify({
      req_key: reqKey,
      task_id: taskId,
    });

    const url = `${this.baseUrl}?${this.queryParamsToString(params)}`;

    let attempts = 0;
    const maxAttempts = 30;
    const interval = 3000;

    while (attempts < maxAttempts) {
      try {
        const date = this.getDate().date;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Date': date,
        };

        const bodySha = this.getBodySha(body);
        const authorization = this.sign({
          headers,
          query: params,
          method: 'POST',
          pathName: '/',
          bodySha,
        });

        const response = await axios.post(url, body, {
          headers: {
            ...headers,
            'Authorization': authorization,
          },
          timeout: 60000,
        });

        if (response.data.code === 10000) {
          const data = response.data.data;
          console.log(`[Jimeng] Task ${taskId} status: ${data.status}`);
          if (data.status === 'done') {
            if (data.result && data.result.urls && data.result.urls.length > 0) {
              return {
                success: true,
                imageUrls: data.result.urls,
              };
            } else if (data.binary_data_base64 && data.binary_data_base64.length > 0) {
              const imageUrls: string[] = [];
              for (const base64Data of data.binary_data_base64) {
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `jimeng_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
                const filePath = `./images/${filename}`;
                await fs.promises.writeFile(filePath, buffer);
                const fullPath = `http://localhost:3001/images/${filename}`;
                imageUrls.push(fullPath);
              }
              console.log(`[Jimeng] Task ${taskId} completed with base64 images, saved to:`, imageUrls);
              return {
                success: true,
                imageUrls,
              };
            } else {
              console.error(`[Jimeng] Task ${taskId} completed but no images found in response`);
              return {
                success: false,
                error: 'Task completed but no images found',
              };
            }
          } else if (data.status === 'not_found' || data.status === 'expired') {
            console.error(`[Jimeng] Task ${taskId} not found or expired`);
            return {
              success: false,
              error: `Task ${data.status}`,
            };
          } else if (['in_queue', 'generating', 'processing'].includes(data.status)) {
            console.log(`[Jimeng] Task ${taskId} is still ${data.status}, attempt ${attempts + 1}/${maxAttempts}`);
          } else {
            console.error(`[Jimeng] Task failed with status: ${data.status}, data:`, data);
            return {
              success: false,
              error: `Task failed with status: ${data.status}`,
            };
          }
        } else {
          console.error(`[Jimeng] API error: ${response.data.message}`);
          return {
            success: false,
            error: response.data.message || 'API error',
          };
        }
      } catch (error) {
        const err = error as Error & { response?: { status?: number; data?: { message?: string } } };
        const status = err.response?.status;
        
        console.error(`[Jimeng] Error getting task result:`, error);
        
        if (status === 500) {
          console.error('[Jimeng] Server error (500), aborting task');
          return {
            success: false,
            error: 'Server error: 500',
          };
        }
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    return {
      success: false,
      error: 'Task timed out',
    };
  }

  async generateImage(prompt: string, aspectRatio: string = '1:1'): Promise<ImageGenerationResult> {
    console.log('====================================');
    console.log('[Jimeng T2I] === 开始生成图片 ===');
    console.log('[Jimeng T2I] 参数信息:');
    console.log('[Jimeng T2I]   prompt:', prompt.length > 500 ? `${prompt.substring(0, 500)}...(共${prompt.length}字符)` : prompt);
    console.log('[Jimeng T2I]   aspectRatio:', aspectRatio);
    console.log('[Jimeng T2I]   apiKey配置:', this.apiKey ? `已配置(${this.apiKey.substring(0, 8)}...)` : '未配置');
    console.log('[Jimeng T2I]   apiSecret配置:', this.apiSecret ? `已配置(${this.apiSecret.substring(0, 8)}...)` : '未配置');
    
    try {
      const ratioParts = aspectRatio.split(':');
      const ratioWidth = parseInt(ratioParts[0]);
      const ratioHeight = parseInt(ratioParts[1]);

      const validSizes = [
        { width: 1024, height: 1024 },
        { width: 1024, height: 1536 },
        { width: 1536, height: 1024 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1024, height: 2048 },
        { width: 2048, height: 1024 },
      ];

      let bestMatch = validSizes[0];
      let minDiff = Infinity;
      const targetRatio = ratioWidth / ratioHeight;

      for (const size of validSizes) {
        const sizeRatio = size.width / size.height;
        const diff = Math.abs(sizeRatio - targetRatio);
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = size;
        }
      }

      const width = bestMatch.width;
      const height = bestMatch.height;
      
      console.log('[Jimeng T2I] 计算尺寸:', { width, height, aspectRatio });
      
      const params: Record<string, string> = {
        Action: 'CVSync2AsyncSubmitTask',
        Version: '2022-08-31',
      };

      const body = JSON.stringify({
        req_key: this.reqKeyT2I,
        prompt,
        width,
        height,
        force_single: true,
      });

      const date = this.getDate().date;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Date': date,
      };

      const bodySha = this.getBodySha(body);
      const authorization = this.sign({
        headers,
        query: params,
        method: 'POST',
        pathName: '/',
        bodySha,
      });

      const url = `${this.baseUrl}?${this.queryParamsToString(params)}`;
      
      console.log('[Jimeng T2I] 请求URL:', url);
      console.log('[Jimeng T2I] 请求头:', { ...headers, Authorization: authorization });
      console.log('[Jimeng T2I] 请求体长度:', body.length, '字符');
      
      const startTime = Date.now();
      const response = await axios.post(
        url,
        body,
        {
          headers: {
            ...headers,
            'Authorization': authorization,
          },
          timeout: 120000,
        }
      );
      const endTime = Date.now();

      console.log('[Jimeng T2I] 响应耗时:', (endTime - startTime), 'ms');
      console.log('[Jimeng T2I] 响应状态码:', response.status);
      console.log('[Jimeng T2I] 响应数据:', JSON.stringify(response.data));

      if (response.data.code !== 10000) {
        console.error('[Jimeng T2I] API调用失败:', { 
          code: response.data.code, 
          message: response.data.message,
          request_id: response.data.request_id 
        });
        return {
          success: false,
          error: `Code ${response.data.code}: ${response.data.message || 'API error'}`,
        };
      }

      const taskId = response.data.data?.task_id;
      
      if (!taskId) {
        console.error('[Jimeng T2I] 未返回任务ID:', response.data);
        return {
          success: false,
          error: 'No task ID returned',
        };
      }

      console.log('[Jimeng T2I] 任务ID:', taskId);
      console.log('[Jimeng T2I] 开始轮询任务结果...');
      
      const result = await this.getTaskResult(taskId, this.reqKeyT2I);
      
      if (result.success) {
        console.log('[Jimeng T2I] === 图片生成成功 ===');
        console.log('[Jimeng T2I] 返回图片数量:', result.imageUrls?.length);
        console.log('[Jimeng T2I] 图片URL:', result.imageUrls?.slice(0, 2));
      } else {
        console.error('[Jimeng T2I] === 图片生成失败 ===');
        console.error('[Jimeng T2I] 失败原因:', result.error);
      }
      
      console.log('====================================');
      return result;
      
    } catch (error) {
      const err = error as Error & { response?: { status?: number; data?: { message?: string } } };
      const status = err.response?.status;
      const data = err.response?.data;
      console.error('====================================');
      console.error('[Jimeng T2I] === 请求异常 ===');
      console.error('[Jimeng T2I] 异常类型:', err.name);
      console.error('[Jimeng T2I] HTTP状态码:', status);
      console.error('[Jimeng T2I] 响应数据:', JSON.stringify(data));
      console.error('[Jimeng T2I] 错误信息:', err.message);
      console.error('[Jimeng T2I] 错误堆栈:', err.stack);
      console.error('====================================');
      return {
        success: false,
        error: `Status ${status}: ${data?.message || err.message || 'Unknown error'}`,
      };
    }
  }

  async generateImageWithReference(
    prompt: string,
    imageUrl: string,
    scale: number = 50,
    aspectRatio: string = '1:1'
  ): Promise<ImageGenerationResult> {
    console.log('====================================');
    console.log('[Jimeng I2I] === 开始图生图 ===');
    console.log('[Jimeng I2I] 参数信息:');
    console.log('[Jimeng I2I]   prompt:', prompt.length > 500 ? `${prompt.substring(0, 500)}...(共${prompt.length}字符)` : prompt);
    console.log('[Jimeng I2I]   imageUrl:', imageUrl.length > 100 ? `${imageUrl.substring(0, 100)}...(共${imageUrl.length}字符)` : imageUrl);
    console.log('[Jimeng I2I]   scale:', scale);
    console.log('[Jimeng I2I]   aspectRatio:', aspectRatio);
    console.log('[Jimeng I2I]   apiKey配置:', this.apiKey ? `已配置(${this.apiKey.substring(0, 8)}...)` : '未配置');
    console.log('[Jimeng I2I]   apiSecret配置:', this.apiSecret ? `已配置(${this.apiSecret.substring(0, 8)}...)` : '未配置');
    
    try {
      const ratioParts = aspectRatio.split(':');
      const ratioWidth = parseInt(ratioParts[0]);
      const ratioHeight = parseInt(ratioParts[1]);

      const validSizes = [
        { width: 1024, height: 1024 },
        { width: 1024, height: 1536 },
        { width: 1536, height: 1024 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1024, height: 2048 },
        { width: 2048, height: 1024 },
      ];

      let bestMatch = validSizes[0];
      let minDiff = Infinity;
      const targetRatio = ratioWidth / ratioHeight;

      for (const size of validSizes) {
        const sizeRatio = size.width / size.height;
        const diff = Math.abs(sizeRatio - targetRatio);
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = size;
        }
      }

      const width = bestMatch.width;
      const height = bestMatch.height;
      
      console.log('[Jimeng I2I] 计算尺寸:', { width, height, aspectRatio });
      
      const params: Record<string, string> = {
        Action: 'CVSync2AsyncSubmitTask',
        Version: '2022-08-31',
      };

      const requestBody: Record<string, unknown> = {
        req_key: this.reqKeyI2I,
        prompt,
        width,
        height,
        scale,
        force_single: true,
      };

      // 检查是否是本地URL（localhost或127.0.0.1），如果是则读取本地文件转为base64
      const isLocalUrl = imageUrl.startsWith('http://localhost') || 
                         imageUrl.startsWith('http://127.0.0.1') ||
                         imageUrl.startsWith('http://0.0.0.0');
      
      if (isLocalUrl) {
        console.log('[Jimeng I2I] 使用方式: 本地URL -> base64');
        console.log('[Jimeng I2I] 本地URL:', imageUrl);
        
        const fs = await import('fs');
        const path = await import('path');
        
        // 将URL转换为本地文件路径
        const urlPath = new URL(imageUrl).pathname;
        const localFilePath = path.join(process.cwd(), 'public', urlPath);
        
        console.log('[Jimeng I2I] 本地文件路径:', localFilePath);
        
        if (!fs.existsSync(localFilePath)) {
          console.error('[Jimeng I2I] 本地文件不存在:', localFilePath);
          return {
            success: false,
            error: `Local file not found: ${localFilePath}`,
          };
        }
        
        const fileBuffer = fs.readFileSync(localFilePath);
        const base64Data = fileBuffer.toString('base64');
        requestBody.image_base64 = base64Data;
        console.log('[Jimeng I2I] Base64数据长度:', base64Data.length, '字符');
      } else if (imageUrl.startsWith('http')) {
        requestBody.image_urls = [imageUrl];
        console.log('[Jimeng I2I] 使用方式: image_urls (HTTP URL)');
      } else if (imageUrl.startsWith('data:image')) {
        requestBody.image_base64 = imageUrl.split(',')[1];
        console.log('[Jimeng I2I] 使用方式: image_base64 (data:image格式)');
      } else {
        console.log('[Jimeng I2I] 使用方式: 本地文件读取');
        console.log('[Jimeng I2I] 本地文件路径:', imageUrl);
        const fs = await import('fs');
        
        if (!fs.existsSync(imageUrl)) {
          console.error('[Jimeng I2I] 本地文件不存在:', imageUrl);
          return {
            success: false,
            error: `Local file not found: ${imageUrl}`,
          };
        }
        
        const fileBuffer = fs.readFileSync(imageUrl);
        const base64Data = fileBuffer.toString('base64');
        requestBody.image_base64 = base64Data;
        console.log('[Jimeng I2I] Base64数据长度:', base64Data.length, '字符');
      }

      const body = JSON.stringify(requestBody);
      console.log('[Jimeng I2I] 请求体长度:', body.length, '字符');

      const date = this.getDate().date;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Date': date,
      };

      const bodySha = this.getBodySha(body);
      const authorization = this.sign({
        headers,
        query: params,
        method: 'POST',
        pathName: '/',
        bodySha,
      });

      const url = `${this.baseUrl}?${this.queryParamsToString(params)}`;
      
      console.log('[Jimeng I2I] 请求URL:', url);
      console.log('[Jimeng I2I] 请求头:', { ...headers, Authorization: authorization });
      
      const startTime = Date.now();
      const response = await axios.post(
        url,
        body,
        {
          headers: {
            ...headers,
            'Authorization': authorization,
          },
          timeout: 120000,
        }
      );
      const endTime = Date.now();

      console.log('[Jimeng I2I] 响应耗时:', (endTime - startTime), 'ms');
      console.log('[Jimeng I2I] 响应状态码:', response.status);
      console.log('[Jimeng I2I] 响应数据:', JSON.stringify(response.data));

      if (response.data.code !== 10000) {
        console.error('[Jimeng I2I] API调用失败:', { 
          code: response.data.code, 
          message: response.data.message,
          request_id: response.data.request_id 
        });
        return {
          success: false,
          error: `Code ${response.data.code}: ${response.data.message || 'API error'}`,
        };
      }

      const taskId = response.data.data?.task_id;
      
      if (!taskId) {
        console.error('[Jimeng I2I] 未返回任务ID:', response.data);
        return {
          success: false,
          error: 'No task ID returned',
        };
      }

      console.log('[Jimeng I2I] 任务ID:', taskId);
      console.log('[Jimeng I2I] 开始轮询任务结果...');
      
      const result = await this.getTaskResult(taskId, this.reqKeyI2I);
      
      if (result.success) {
        console.log('[Jimeng I2I] === 图片生成成功 ===');
        console.log('[Jimeng I2I] 返回图片数量:', result.imageUrls?.length);
        console.log('[Jimeng I2I] 图片URL:', result.imageUrls?.slice(0, 2));
      } else {
        console.error('[Jimeng I2I] === 图片生成失败 ===');
        console.error('[Jimeng I2I] 失败原因:', result.error);
      }
      
      console.log('====================================');
      return result;
      
    } catch (error) {
      const err = error as Error & { response?: { status?: number; data?: { message?: string } } };
      const status = err.response?.status;
      const data = err.response?.data;
      console.error('====================================');
      console.error('[Jimeng I2I] === 请求异常 ===');
      console.error('[Jimeng I2I] 异常类型:', err.name);
      console.error('[Jimeng I2I] HTTP状态码:', status);
      console.error('[Jimeng I2I] 响应数据:', JSON.stringify(data));
      console.error('[Jimeng I2I] 错误信息:', err.message);
      console.error('[Jimeng I2I] 错误堆栈:', err.stack);
      console.error('[Jimeng I2I] 参考图片URL:', imageUrl);
      console.error('====================================');
      return {
        success: false,
        error: `Status ${status}: ${data?.message || err.message || 'Unknown error'}`,
      };
    }
  }
}

export default JimengService;
