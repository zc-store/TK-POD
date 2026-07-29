import { Router, Request, Response } from 'express';
import Pattern from '../models/Pattern';
import Keyword from '../models/Keyword';
import JimengService from '../services/jimeng';
import PatternAgent from '../services/patternAgent';
import { isConnected } from '../db';
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

async function downloadAndSaveImage(url: string, filename: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const filePath = path.join(IMAGE_DIR, filename);
    fs.writeFileSync(filePath, response.data);
    return `/images/${filename}`;
  } catch (error) {
    console.error('Failed to download and save image:', error);
    throw new Error('图片保存失败');
  }
}

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(200).json({ success: true, data: [] });
    }
    const patterns = await Pattern.find().sort({ created_at: -1 });
    res.status(200).json({ success: true, data: patterns });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { name, theme, colors, sizes, imageSize = '1024x1024' } = req.body;
    
    const apiKey = process.env.JIMENG_API_KEY || '';
    const apiSecret = process.env.JIMENG_API_SECRET || '';
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, error: '即梦API key or secret not configured' });
    }

    const jimeng = new JimengService({ apiKey, apiSecret });
    
    const imageUrls: Record<string, string> = {};
    const timestamp = Date.now();
    
    for (const size of sizes) {
      const prompt = `设计一个${theme}主题的地毯印花图案，尺寸${size}，颜色：${colors.join(', ')}，现代简约风格，高分辨率高清印刷原图，无缝平铺图案，适合数码印花工艺，粗线条清晰轮廓，纯色块平涂，无渐变无模糊，适合大批量生产印刷`;
      const result = await jimeng.generateImage(prompt, imageSize);
      
      if (result.success && result.imageUrls && result.imageUrls.length > 0) {
        const originalUrl = result.imageUrls[0];
        const filename = `pattern-${timestamp}-${size.replace('x', '-')}.png`;
        const localPath = await downloadAndSaveImage(originalUrl, filename);
        imageUrls[size] = localPath;
      } else {
        return res.status(500).json({ success: false, error: `Failed to generate image for size ${size}: ${result.error}` });
      }
    }

    const patternData = {
      _id: Date.now().toString(),
      name,
      theme,
      colors,
      sizes,
      image_urls: imageUrls,
      created_at: new Date(),
    };

    if (isConnected) {
      await Pattern.create({
        name,
        theme,
        colors,
        sizes,
        image_urls: imageUrls,
      });
    }

    res.status(200).json({ success: true, data: patternData });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/generate-from-news', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      themes, 
      colors, 
      elements, 
      styles, 
      sizes = ['37x47cm', '43x53cm'], 
      imageSize = '1024x1024' 
    } = req.body;
    
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    const jimengApiKey = process.env.JIMENG_API_KEY || '';
    const jimengApiSecret = process.env.JIMENG_API_SECRET || '';
    
    if (!deepseekApiKey) {
      return res.status(400).json({ success: false, error: 'DeepSeek API key not configured' });
    }
    
    if (!jimengApiKey || !jimengApiSecret) {
      return res.status(400).json({ success: false, error: '即梦API key or secret not configured' });
    }

    const agent = new PatternAgent({ deepseekApiKey });
    const jimeng = new JimengService({ apiKey: jimengApiKey, apiSecret: jimengApiSecret });
    
    console.log('Calling PatternAgent to generate prompt...');
    
    const agentResult = await agent.generatePrompt({
      themes,
      colors,
      elements,
      styles,
    });
    
    if (!agentResult.success) {
      return res.status(500).json({ success: false, error: agentResult.error || 'Agent生成提示词失败' });
    }
    
    console.log('Agent generated prompt:', agentResult.prompt);
    
    const imageUrls: Record<string, string> = {};
    const timestamp = Date.now();
    
    for (const size of sizes) {
      const prompt = `${agentResult.prompt}，尺寸${size}`;
      const result = await jimeng.generateImage(prompt, imageSize);
      
      if (result.success && result.imageUrls && result.imageUrls.length > 0) {
        const originalUrl = result.imageUrls[0];
        const filename = `pattern-${timestamp}-${size.replace('x', '-')}.png`;
        const localPath = await downloadAndSaveImage(originalUrl, filename);
        imageUrls[size] = localPath;
      } else {
        return res.status(500).json({ success: false, error: `Failed to generate image for size ${size}: ${result.error}` });
      }
    }

    const patternData = {
      _id: Date.now().toString(),
      name,
      theme: themes.join(' '),
      colors,
      sizes,
      image_urls: imageUrls,
      design思路: agentResult.design思路,
      printingNotes: agentResult.printingNotes,
      generatedPrompt: agentResult.prompt,
      created_at: new Date(),
    };

    if (isConnected) {
      await Pattern.create({
        name,
        theme: themes.join(' '),
        colors,
        sizes,
        image_urls: imageUrls,
        design思路: agentResult.design思路,
        printingNotes: agentResult.printingNotes,
      });
    }

    res.status(200).json({ success: true, data: patternData });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(200).json({ success: true });
    }
    await Pattern.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/keywords', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(200).json({ success: true, data: [] });
    }
    const keywords = await Keyword.find().sort({ category: 1, name: 1 });
    res.status(200).json({ success: true, data: keywords });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;