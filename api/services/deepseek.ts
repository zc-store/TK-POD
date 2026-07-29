import axios from 'axios';

interface DeepSeekConfig {
  apiKey: string;
  apiUrl: string;
}

interface NewsResult {
  title: string;
  summary: string;
  source: string;
  category: string;
  keywords: string[];
  url?: string;
  extracted_info?: {
    themes: string[];
    colors: string[];
    elements: string[];
    styles: string[];
  };
}

interface NewsFetchResult {
  success: boolean;
  news?: NewsResult[];
  error?: string;
}

interface ExtractInfoResult {
  success: boolean;
  info?: {
    themes: string[];
    colors: string[];
    elements: string[];
    styles: string[];
  };
  error?: string;
}

class DeepSeekService {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  async fetchNews(count: number = 5): Promise<NewsFetchResult> {
    try {
      const today = new Date().toLocaleDateString('zh-CN');
      
      const prompt = `请为我提供${count}条最新的美国新闻，包含以下内容：
1. 标题（中英文均可）
2. 详细摘要（100-200字）
3. 来源（如BBC、CNN、纽约时报等）
4. 分类（如科技、体育、娱乐、政治、经济等）
5. 3-5个关键词
6. 创作灵感提取（主题、配色、视觉元素、设计风格）

请以JSON格式返回，格式如下：
{
  "news": [
    {
      "title": "新闻标题",
      "summary": "新闻摘要",
      "source": "来源",
      "category": "分类",
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "url": "原文链接（可选）",
      "extracted_info": {
        "themes": ["主题1", "主题2"],
        "colors": ["颜色1", "颜色2"],
        "elements": ["元素1", "元素2"],
        "styles": ["风格1", "风格2"]
      }
    }
  ]
}

日期：${today}`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的新闻分析师和创意灵感提取器。请提供最新、最热门的美国新闻，并从中提取可用于图案设计的创意灵感。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 60000,
        }
      );

      const content = response.data.choices[0]?.message?.content;
      
      if (!content) {
        return {
          success: false,
          error: 'No response from DeepSeek',
        };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const processedNews = (parsed.news || []).map((item: NewsResult) => {
        if (item.extracted_info) {
          const splitString = (str: unknown): string[] => {
            if (Array.isArray(str)) return str;
            if (typeof str === 'string') {
              return str.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
            }
            return [];
          };
          
          return {
            ...item,
            extracted_info: {
              themes: splitString(item.extracted_info.themes),
              colors: splitString(item.extracted_info.colors),
              elements: splitString(item.extracted_info.elements),
              styles: splitString(item.extracted_info.styles),
            },
          };
        }
        return item;
      });
      
      return {
        success: true,
        news: processedNews,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async extractCreativeInfo(title: string, summary: string): Promise<ExtractInfoResult> {
    try {
      const prompt = `请分析以下新闻，提取可用于地毯图案设计的创意灵感：

标题：${title}
摘要：${summary}

请提取以下信息：
1. 主题（3-5个）
2. 配色方案（3-5个颜色）
3. 视觉元素（3-5个）
4. 设计风格（2-3个）

请以JSON格式返回，格式如下：
{
  "themes": ["主题1", "主题2", "主题3"],
  "colors": ["颜色1", "颜色2", "颜色3"],
  "elements": ["元素1", "元素2", "元素3"],
  "styles": ["风格1", "风格2"]
}`;

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的创意设计师和图案设计顾问。请根据新闻内容提取可用于地毯图案设计的创意灵感。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 60000,
        }
      );

      const content = response.data.choices[0]?.message?.content;
      
      if (!content) {
        return {
          success: false,
          error: 'No response from DeepSeek',
        };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          error: 'Invalid response format',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        info: {
          themes: parsed.themes || [],
          colors: parsed.colors || [],
          elements: parsed.elements || [],
          styles: parsed.styles || [],
        },
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default DeepSeekService;