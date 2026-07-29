import { Router, Request, Response } from 'express';
import BaiduAiService from '../services/baiduAi';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGE_DIR = path.join(__dirname, '../../public/images');

if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

router.get('/proxy', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: '缺少url参数' });
    }

    console.log('Proxy image request:', url);

    const response = await axios.get(decodeURIComponent(url), {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(decodeURIComponent(url)).origin,
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
      },
      maxRedirects: 10,
      validateStatus: (status) => status < 500,
    });

    console.log('Proxy response status:', response.status);

    if (response.status === 403) {
      console.error('Proxy 403 error, trying with different headers');
      throw new Error('403 Forbidden');
    }

    const contentType = (response.headers['content-type'] as string) || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.send(response.data);
  } catch (error) {
    const err = error as any;
    console.error('Proxy error:', err.message);
    console.error('Response data:', err.response?.data?.toString?.());
    console.error('Response headers:', err.response?.headers);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/enhance', async (req: Request, res: Response) => {
  try {
    const { image_url, image_base64 } = req.body;

    if (!image_url && !image_base64) {
      return res.status(400).json({ success: false, error: '缺少image_url或image_base64参数' });
    }

    const apiKey = process.env.BAIDU_AI_API_KEY || '';
    const secretKey = process.env.BAIDU_AI_SECRET_KEY || '';

    if (!apiKey || !secretKey) {
      return res.status(400).json({ success: false, error: '百度AI API密钥未配置' });
    }

    const baiduAi = new BaiduAiService({ apiKey, secretKey });
    const result = await baiduAi.imageEnlarge(image_url, image_base64);

    if (result.success && result.image_url) {
      const base64Data = result.image_url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const timestamp = Date.now();
      const filename = `enhanced-${timestamp}.png`;
      const filePath = path.join(IMAGE_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      result.image_url = `/images/${filename}`;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/super-resolution', async (req: Request, res: Response) => {
  try {
    const { image_url, image_base64, scale = 2 } = req.body;

    if (!image_url && !image_base64) {
      return res.status(400).json({ success: false, error: '缺少image_url或image_base64参数' });
    }

    const apiKey = process.env.BAIDU_AI_API_KEY || '';
    const secretKey = process.env.BAIDU_AI_SECRET_KEY || '';

    if (!apiKey || !secretKey) {
      return res.status(400).json({ success: false, error: '百度AI API密钥未配置' });
    }

    const baiduAi = new BaiduAiService({ apiKey, secretKey });
    const result = await baiduAi.imageSuperResolution(image_url, scale, image_base64);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;