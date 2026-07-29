import axios from 'axios';

interface NewsAgentConfig {
  deepseekApiKey: string;
}

interface NewsItem {
  category: string;
  date: string;
  title: string;
  summary: string;
  visualSymbols: string[];
  source: string;
}

interface NewsAgentResult {
  newsItems: NewsItem[];
  visualElements: string[];
  success: boolean;
  error?: string;
}

class NewsAgent {
  private deepseekApiKey: string;
  private deepseekUrl = 'https://api.deepseek.com/v1/chat/completions';

  constructor(config: NewsAgentConfig) {
    this.deepseekApiKey = config.deepseekApiKey;
  }

  async fetchNews(filter?: string): Promise<NewsAgentResult> {
    try {
      const systemPrompt = `你是【新闻中心专用采集分析Agent】，底层依托DeepSeek大模型驱动，专职实时抓取、整理、梳理**美国最新全网新闻资讯**，为地图印刷图案、资讯看板、内容素材库提供标准化新闻素材。具备联网检索、新闻筛选、分类提炼、结构化输出全流程能力。

# 核心工作目标
接收指令后，自动检索近3日美国本土权威媒体实时新闻，过滤重复、低质、娱乐八卦内容，提炼时政、经济、民生、科技、社会五大类核心热点，输出可直接用于设计素材、新闻简报的标准化内容，杜绝编造、臆测信息。

# 强制执行流程（必须按顺序执行）
1. 工具调用判断：所有美国实时新闻属于动态时效性信息，必须调用联网搜索工具，禁止依靠模型知识库编造内容；
2. 检索范围限定：仅检索美国主流权威媒体（路透、美联、华尔街日报、NBC、CNN、华盛顿邮报等），剔除自媒体小道消息；
3. 内容清洗：合并同事件多条报道，去重、剔除极端煽动性内容，客观中立还原事件核心；
4. 分类归档：将新闻分为五大固定类目：美国时政政策、经济金融、科技产业、民生社会、突发事件；
5. 信息提炼：每条新闻提取【发布时间、事件标题、核心摘要、关键视觉符号】，视觉符号专供地图图案设计使用；
6. 标准化交付：固定输出Markdown简报+纯素材关键词列表，方便后续即梦绘图生成印刷地图纹样。

# 硬性约束规则
1. 信息真实：无搜索结果时如实标注「暂无近期相关资讯」，绝不虚构新闻事件、时间、数据；
2. 立场规范：客观中立陈述新闻事实，不加入主观评判、极端观点；
3. 内容过滤：不输出暴力、灾难血腥细节、敏感冲突过激描述，仅保留可商用设计素材；
4. 输出语言：全文中文，新闻专有名词保留标准英文原名；
5. 格式锁定：严格遵守指定输出结构，不额外增加无关闲聊、多余解释；
6. 适配下游：提炼视觉元素简洁具象（国旗、地标、产业图标、政策符号等），适配扁平化印刷图案。

# 固定输出格式（每次回复严格遵循，不可改动）
## 一、美国近期新闻总览简报
### 1. 美国时政政策
- 【时间】YYYY-MM-DD｜标题：XXX
  内容摘要：XXX
  设计视觉符号：XXX
### 2. 美国经济金融
- 【时间】YYYY-MM-DD｜标题：XXX
  内容摘要：XXX
  设计视觉符号：XXX
### 3. 美国科技产业
### 4. 美国民生社会
### 5. 美国突发事件

## 二、地图图案专用素材关键词（逗号分隔，直接复制进即梦绘图）
美国新闻视觉元素：XXX,XXX,XXX
后续节日元素预留接口：等待用户补充节日清单后融合纹样

## 三、素材使用说明
1. 视觉符号适配矢量印刷地图，无复杂写实细节；
2. 可与节日元素混合做无缝平铺底纹/边框装饰图案；
3. 色彩适配纸质印刷，无渐变、细碎复杂图形。

# 交互响应规则
1. 用户仅发送「获取美国最新新闻」：直接执行完整检索输出全套简报+素材关键词；
2. 用户附带节日清单：自动将新闻视觉符号+节日元素合并生成统一绘图关键词；
3. 用户提出筛选需求（仅经济/仅时政）：对应缩减类目输出；
4. 用户需要调整素材风格：同步修改绘图关键词适配印刷规范。

# DeepSeek模型参数适配（内置指令）
temperature=0.3，输出稳定无发散；max_tokens=3000，完整容纳新闻简报；强制结构化输出，减少自由发挥。

请严格按照上述格式输出，不要添加任何额外内容。`;

      let userPrompt = '获取美国最新新闻';
      if (filter) {
        userPrompt = `获取美国最新新闻，筛选条件：${filter}`;
      }

      const response = await axios.post(
        this.deepseekUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.deepseekApiKey}`,
          },
          timeout: 120000,
        }
      );

      const content = response.data.choices[0].message.content;
      
      console.log('NewsAgent raw content:', content);
      
      const newsItems: NewsItem[] = this.parseNewsContent(content);
      const visualElements = this.extractVisualElements(content);

      console.log('Parsed news items:', newsItems.length);
      console.log('Visual elements:', visualElements);

      return {
        newsItems,
        visualElements,
        success: true,
      };

    } catch (error) {
      const err = error as Error;
      console.error('NewsAgent error:', err.message);
      return {
        newsItems: [],
        visualElements: [],
        success: false,
        error: err.message || '获取新闻失败',
      };
    }
  }

  private parseNewsContent(content: string): NewsItem[] {
    const newsItems: NewsItem[] = [];
    
    const categories = [
      '美国时政政策',
      '美国经济金融',
      '美国科技产业',
      '美国民生社会',
      '美国突发事件',
    ];

    let currentCategory = '';
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('###')) {
        const match = line.match(/###\s*\d+\.\s*(.+)/);
        if (match && categories.includes(match[1])) {
          currentCategory = match[1];
        }
      } else if (line.startsWith('- 【') && line.includes('】｜标题：') && currentCategory) {
        const dateMatch = line.match(/【(\d{4}-\d{2}-\d{2})】/);
        const titleMatch = line.match(/｜标题：(.+)/);
        
        if (dateMatch && titleMatch) {
          const date = dateMatch[1];
          const title = titleMatch[1].trim();
          
          let summary = '';
          let visualSymbolsStr = '';
          const source = '权威媒体';
          
          let j = i + 1;
          while (j < lines.length && !lines[j].startsWith('- 【时间】') && !lines[j].startsWith('###')) {
            if (lines[j].trim().startsWith('内容摘要：')) {
              summary = lines[j].trim().replace('内容摘要：', '');
            } else if (lines[j].trim().startsWith('设计视觉符号：')) {
              visualSymbolsStr = lines[j].trim().replace('设计视觉符号：', '');
            }
            j++;
          }
          
          const visualSymbols = visualSymbolsStr
            .split(/[,，、]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
          
          newsItems.push({
            category: currentCategory,
            date,
            title,
            summary,
            visualSymbols,
            source,
          });
        }
      }
    }
    
    return newsItems;
  }

  private extractVisualElements(content: string): string[] {
    const sectionMatch = content.match(/## 二、地图图案专用素材关键词[\s\S]*?美国新闻视觉元素：([^\n]+)/);
    
    if (sectionMatch && sectionMatch[1]) {
      return sectionMatch[1]
        .split(/[,，、]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
    
    return [];
  }
}

export default NewsAgent;