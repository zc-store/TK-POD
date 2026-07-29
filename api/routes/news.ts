import { Router, Request, Response } from 'express';
import NewsItem from '../models/NewsItem';
import DeepSeekService from '../services/deepseek';
import NewsAgent from '../services/newsAgent';
import { isConnected } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(200).json({ success: true, data: [] });
    }
    const news = await NewsItem.find().sort({ publish_date: -1 }).limit(20);
    res.status(200).json({ success: true, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/fetch', async (req: Request, res: Response) => {
  try {
    const { count = 5 } = req.body;
    
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'DeepSeek API key not configured' });
    }

    const deepseek = new DeepSeekService({ apiKey, apiUrl });
    const result = await deepseek.fetchNews(count);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const newsData = result.news!.map((item) => ({
      ...item,
      publish_date: new Date(),
    }));

    if (isConnected) {
      await Promise.all(
        newsData.map((item) => 
          NewsItem.create({
            title: item.title,
            summary: item.summary,
            source: item.source,
            category: item.category,
            keywords: item.keywords,
            url: item.url,
            publish_date: item.publish_date,
            extracted_info: item.extracted_info,
          })
        )
      );
    }

    res.status(200).json({ success: true, data: newsData });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/fetch-via-agent', async (req: Request, res: Response) => {
  try {
    const { filter } = req.body;
    
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'DeepSeek API key not configured' });
    }

    const agent = new NewsAgent({ deepseekApiKey: apiKey });
    const result = await agent.fetchNews(filter);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const newsData = result.newsItems.map((item) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title: item.title,
      summary: item.summary,
      source: item.source,
      category: item.category,
      keywords: item.visualSymbols,
      url: '',
      publish_date: item.date,
      extracted_info: {
        themes: [item.category],
        colors: [],
        elements: item.visualSymbols,
        styles: ['现代简约', '扁平化'],
      },
    }));

    if (isConnected) {
      await Promise.all(
        newsData.map((item) => 
          NewsItem.create({
            title: item.title,
            summary: item.summary,
            source: item.source,
            category: item.category,
            keywords: item.keywords,
            url: item.url,
            publish_date: new Date(item.publish_date),
            extracted_info: item.extracted_info,
          })
        )
      );
    }

    res.status(200).json({ 
      success: true, 
      data: newsData,
      visualElements: result.visualElements,
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { news_id, api_key, title, summary } = req.body;
    
    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
    const effectiveApiKey = api_key || process.env.DEEPSEEK_API_KEY || '';
    
    if (!effectiveApiKey) {
      return res.status(400).json({ success: false, error: 'DeepSeek API key not configured' });
    }

    let newsTitle = title;
    let newsSummary = summary;

    if (news_id && isConnected) {
      const newsItem = await NewsItem.findById(news_id);
      if (newsItem) {
        newsTitle = newsItem.title;
        newsSummary = newsItem.summary;
      }
    }

    if (!newsTitle || !newsSummary) {
      return res.status(400).json({ success: false, error: 'News title and summary are required' });
    }

    const deepseek = new DeepSeekService({ apiKey: effectiveApiKey, apiUrl });
    const result = await deepseek.extractCreativeInfo(newsTitle, newsSummary);
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    if (news_id && isConnected) {
      await NewsItem.findByIdAndUpdate(news_id, { extracted_info: result.info });
    }

    res.status(200).json({ success: true, data: result.info });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await NewsItem.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;