import axios from 'axios';

interface PatternAgentConfig {
  deepseekApiKey: string;
}

interface PatternAgentResult {
  prompt: string;
  design思路: string;
  printingNotes: string;
  success: boolean;
  error?: string;
}

class PatternAgent {
  private deepseekApiKey: string;
  private deepseekUrl = 'https://api.deepseek.com/v1/chat/completions';

  constructor(config: PatternAgentConfig) {
    this.deepseekApiKey = config.deepseekApiKey;
  }

  private getRemainingHolidays(): string {
    const today = new Date();
    const year = today.getFullYear();
    
    const holidays = [
      { month: 7, day: 4, name: '美国独立日', elements: '星条旗、烟花、自由女神' },
      { month: 9, day: 11, name: '911纪念日', elements: '双子塔、国旗、丝带' },
      { month: 10, day: 31, name: '万圣节', elements: '南瓜、骷髅、蝙蝠、幽灵' },
      { month: 11, day: 11, name: '退伍军人节', elements: '国旗、勋章、士兵剪影' },
      { month: 11, day: 27, name: '感恩节', elements: '火鸡、玉米、南瓜派、枫叶' },
      { month: 12, day: 25, name: '圣诞节', elements: '圣诞树、雪花、铃铛、礼物、圣诞老人' },
      { month: 12, day: 31, name: '新年夜', elements: '烟花、倒计时、庆祝' },
    ];

    const remaining = holidays.filter(h => {
      const holidayDate = new Date(year, h.month - 1, h.day);
      return holidayDate >= today;
    });

    if (remaining.length === 0) {
      return '当前年度无重大节日';
    }

    return remaining.map(h => `${h.name}(${h.elements})`).join('、');
  }

  async generatePrompt(newsInfo: {
    themes: string[];
    colors: string[];
    elements: string[];
    styles: string[];
  }): Promise<PatternAgentResult> {
    try {
      const themes = newsInfo.themes.join(' ');
      const colors = newsInfo.colors.join(' ');
      const elements = newsInfo.elements.join(' ');
      const holidays = this.getRemainingHolidays();

      const systemPrompt = `你是专业地毯印花纹样设计 Agent，专注产出适配实体地毯数码印花的高清平铺图案，严格贴合用户提供的时事新闻素材、本年度剩余节日视觉元素创作，全程遵循印花工艺标准输出画面，适配即梦绘图渲染逻辑，杜绝无法印刷的画面缺陷。

【核心工作流程】
接收用户提供的新闻关键词、后续节日清单，提取可视化标志性符号；
将两类元素均匀融合，设计无缝平铺地毯印花图案；
严格按照印花规范生成画面，自动规避渐变、模糊、细碎毛刺、半透明图层；
输出成品同时附带适配即梦的精简绘图提示词 + 印花工艺说明；
用户有调整需求时，快速修改元素密度、配色、线条粗细，不破坏印刷适配性。

【强制画面规范（生成图片必遵守）】
画风：扁平化矢量插画，粗黑清晰轮廓，纯色块平涂，无光影、无渐变、无模糊虚化；
细节：删除极小细碎元素，避免印刷糊版；元素排布疏密均衡，不拥挤、不空旷；
印刷适配：高清晰硬边缘，色彩区分度适中，无荧光高饱和色，适合地毯数码印花大批量生产；
构图：无缝连续平铺图案，可铺满整张地毯，图案重复排列整齐；
元素融合规则：新闻符号与节日元素穿插分布，主次协调，不出现单一元素堆砌；
分辨率：高清大图，适合实际地毯尺寸印刷，细节丰富但不过于复杂。

【输出格式要求】
每次回复固定分为三段：
1. 成品绘图提示词（可直接复制到即梦生图，适配平台渲染规则，使用中文，精简不超过100字）
2. 图案设计思路（新闻 + 节日元素融合逻辑）
3. 印花落地注意事项（给印花工厂参考）

【约束规则】
不生成复杂写实、厚涂、水彩、3D 光影风格，所有画面以矢量平涂为基准；
不添加水印、文字、杂乱特效，画面仅保留装饰纹样图形；
默认生成无缝平铺地毯印花图案；
禁止生成灰度渐变、渐变阴影、模糊光晕、半透明叠加效果。`;

      const userPrompt = `新闻关键词：${themes}
新闻元素：${elements}
推荐配色：${colors}
剩余节日：${holidays}

请根据以上信息生成适配地图印刷的装饰纹样设计。`;

      const response = await axios.post(
        this.deepseekUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.deepseekApiKey}`,
          },
          timeout: 60000,
        }
      );

      const content = response.data.choices[0].message.content;
      
      const parts = content.split('\n\n');
      
      let prompt = '';
      let design思路 = '';
      let printingNotes = '';

      for (const part of parts) {
        if (part.includes('成品绘图提示词') || part.startsWith('1.')) {
          prompt = part.replace(/成品绘图提示词[：:]?|^1\.\s*/, '').trim();
        } else if (part.includes('图案设计思路') || part.startsWith('2.')) {
          design思路 = part.replace(/图案设计思路[：:]?|^2\.\s*/, '').trim();
        } else if (part.includes('印刷落地注意事项') || part.startsWith('3.')) {
          printingNotes = part.replace(/印刷落地注意事项[：:]?|^3\.\s*/, '').trim();
        }
      }

      if (!prompt) {
        prompt = parts[0] || content;
      }

      return {
        prompt,
        design思路,
        printingNotes,
        success: true,
      };

    } catch (error) {
      const err = error as Error;
      console.error('PatternAgent error:', err.message);
      return {
        prompt: '',
        design思路: '',
        printingNotes: '',
        success: false,
        error: err.message || '生成提示词失败',
      };
    }
  }
}

export default PatternAgent;