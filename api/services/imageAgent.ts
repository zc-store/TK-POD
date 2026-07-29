import axios from 'axios';

export interface ImagePrompt {
  type: string;
  positive_prompt: string;
  negative_prompt: string;
  aspect_ratio: string;
}

export interface ImageAgentResult {
  success: boolean;
  prompts?: ImagePrompt[];
  error?: string;
}

class OriginalPatternAgent {
  private deepseekApiKey: string;
  private deepseekApiUrl: string;

  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    this.deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  }

  async generatePatternPrompts(patternName: string, carpetType: string = '', sizes: string[] = []): Promise<ImageAgentResult> {
    try {
      if (!this.deepseekApiKey) {
        return {
          success: false,
          error: 'DeepSeek API key not configured',
        };
      }

      const aspectRatio = this.calculateAspectRatio(sizes);

      const systemPrompt = `你是专业地毯印花图案设计智能体RugPatternDesigner。
用户会提供一张地毯印花图案图片，你需要生成印花原图设计的AI绘图提示词。

通用强制规则：
1. 纯图案设计，无背景，无场景，无家具，无文字
2. 无缝平铺，高清印刷质量
3. 图案将完全通过参考图片传递，提示词中禁止包含任何图案、花纹、颜色的描述
4. 必须返回JSON格式，包含prompts数组，每个元素包含type、positive_prompt、negative_prompt、aspect_ratio字段`;

      const carpetShape = carpetType?.includes('圆形') ? '圆形' : '矩形';

      const userPrompt = `产品名称：${patternName}
产品类型：${carpetType || '矩形法兰绒地垫'}
地毯形状：${carpetShape}
图片比例：${aspectRatio}

请生成3张印花原图设计的AI绘图提示词：

任务1：高清印花原图（基础印花图案）
画面要求：纯图案设计，无背景，无场景，无家具，无缝平铺纹理，高清印刷质量，图案必须与参考图片完全一致，8K高清，${aspectRatio}比例，专业印花设计稿，图案不变形不模糊，适合数码印花工艺
负面词：背景、场景、家具、文字、水印、模糊、变形、颜色改变、图案改变

任务2：放大局部印花细节图（印花精细度展示）
画面要求：图案局部放大特写，展示印花细节和色彩层次，无背景，无场景，图案必须与参考图片完全一致，高清精细纹理，专业印花设计稿，图案细节清晰可见，${aspectRatio}比例
负面词：背景、场景、人物、水印、模糊、变形、颜色改变、图案改变

任务3：颜色变体印花图（多色方案展示）
画面要求：纯图案设计，保留原有图案结构，改变配色方案，无背景，无场景，无家具，无缝平铺纹理，高清印刷质量，图案结构必须与参考图片一致，色彩和谐美观，${aspectRatio}比例，专业印花设计稿
负面词：背景、场景、家具、文字、水印、模糊、变形、图案结构改变

请严格按照JSON格式输出，不要包含任何额外文字。`;

      const response = await axios.post(
        this.deepseekApiUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.deepseekApiKey}`,
          },
        }
      );

      const content = response.data.choices[0].message.content;

      let prompts: ImagePrompt[] = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          prompts = parsed.prompts || parsed;
        } else {
          prompts = this.parsePromptsFromText(content, aspectRatio);
        }
      } catch {
        prompts = this.parsePromptsFromText(content, aspectRatio);
      }

      return {
        success: true,
        prompts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parsePromptsFromText(content: string, aspectRatio: string): ImagePrompt[] {
    const prompts: ImagePrompt[] = [];
    const tasks = [
      { key: '任务1', type: '高清印花原图', aspect_ratio: aspectRatio },
      { key: '任务2', type: '放大局部印花细节图', aspect_ratio: aspectRatio },
      { key: '任务3', type: '颜色变体印花图', aspect_ratio: aspectRatio },
    ];

    tasks.forEach((task) => {
      const taskMatch = content.split(task.key)[1];
      if (taskMatch) {
        let positive = '';
        let negative = '';

        const positiveMatch = taskMatch.match(/正向提示词[:：]([\s\S]*?)(?=反向提示词|$)/);
        const negativeMatch = taskMatch.match(/反向提示词[:：]([\s\S]*?)(?=任务|$)/);

        if (positiveMatch) {
          positive = positiveMatch[1].trim();
        }
        if (negativeMatch) {
          negative = negativeMatch[1].trim();
        }

        if (!positive) {
          positive = this.getDefaultPositivePrompt(task.type, aspectRatio);
        }
        if (!negative) {
          negative = this.getDefaultNegativePrompt(task.type);
        }

        prompts.push({
          type: task.type,
          positive_prompt: positive,
          negative_prompt: negative,
          aspect_ratio: task.aspect_ratio,
        });
      }
    });

    return prompts;
  }

  private calculateAspectRatio(sizes: string[]): string {
    if (!sizes || sizes.length === 0) {
      return '1:1';
    }

    const firstSize = sizes[0];
    const match = firstSize.match(/(\d+)\s*x\s*(\d+)/i);
    if (match) {
      const width = parseInt(match[1]);
      const height = parseInt(match[2]);

      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const divisor = gcd(width, height);

      return `${width / divisor}:${height / divisor}`;
    }

    return '1:1';
  }

  private getDefaultPositivePrompt(type: string, aspectRatio: string): string {
    const defaults: Record<string, string> = {
      '高清印花原图': `Pure pattern design, no background, no scene, no furniture, seamless tiling texture, high-definition printing quality, pattern must be identical to reference image, 8K ultra HD, ${aspectRatio} aspect ratio, professional print design, pattern must not be altered or blurred, suitable for digital printing process`,
      '放大局部印花细节图': `Pattern close-up magnified view, showing print details and color layers, no background, no scene, pattern must be identical to reference image, high-definition fine texture, professional print design, pattern details clearly visible, ${aspectRatio} aspect ratio`,
      '颜色变体印花图': `Pure pattern design, retain original pattern structure, change color scheme, no background, no scene, no furniture, seamless tiling texture, high-definition printing quality, pattern structure must match reference image, harmonious and beautiful colors, ${aspectRatio} aspect ratio, professional print design`,
    };
    return defaults[type] || '';
  }

  private getDefaultNegativePrompt(type: string): string {
    const defaults: Record<string, string> = {
      '高清印花原图': 'background, scene, furniture, text, watermark, blurry, deformed, color changed, pattern altered',
      '放大局部印花细节图': 'background, scene, people, watermark, blurry, deformed, color changed, pattern altered',
      '颜色变体印花图': 'background, scene, furniture, text, watermark, blurry, deformed, pattern structure changed',
    };
    return defaults[type] || '';
  }
}

class ProductImageAgent {
  private deepseekApiKey: string;
  private deepseekApiUrl: string;

  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    this.deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  }

  private formatSizeWithInch(sizeCm: string): string {
    const cleanSize = sizeCm.replace('*', 'x');
    const [w, h] = cleanSize.split('x').map(Number);
    if (!w || !h) return sizeCm;
    const wIn = (w / 2.54).toFixed(1);
    const hIn = (h / 2.54).toFixed(1);
    return `${sizeCm}cm (${wIn}x${hIn}in)`;
  }

  async generatePrompts(patternName: string, sizes: string[] = [], carpetType: string = ''): Promise<ImageAgentResult> {
    try {
      if (!this.deepseekApiKey) {
        return {
          success: false,
          error: 'DeepSeek API key not configured',
        };
      }

      const systemPrompt = `你是专业地毯产品摄影AI提示词生成智能体RugProductPhotographer。
用户会提供一张地毯印花图案图片，你需要生成产品效果图的AI绘图提示词。

通用强制规则：
1. 产品效果图类：850g/sqm premium washable velvet polyester carpet，短绒柔软肌理，数码渗透印花，不掉色
2. 提示词中禁止包含任何图案、花纹、颜色的描述，图案将完全通过参考图片传递
3. 必须返回JSON格式，包含prompts数组，每个元素包含type、positive_prompt、negative_prompt、aspect_ratio字段`;

      const carpetShape = carpetType?.includes('圆形') ? '圆形' : '矩形';
      const sizeCount = sizes.length;
      const sizeDescriptions = sizes.map(s => this.formatSizeWithInch(s)).join(', ');

      const userPrompt = `产品尺寸：${sizeCount > 0 ? sizeDescriptions : '多种尺寸'}
尺寸数量：${sizeCount}
产品类型：${carpetType || '矩形法兰绒地垫'}
地毯形状：${carpetShape}

请生成6张产品图片的AI绘图提示词：

任务1：产品场景主图（商品首页轮播图）
画面要求：以${carpetShape}地毯为绝对主体的商业产品摄影，尺寸严格按照产品实际尺寸比例展示，地毯占据画面60%-70%面积，完整平铺展示，图案必须与参考图片完全一致。请根据产品名称和图案风格推断最合适的家居场景：如果是节日主题（如万圣节、圣诞节），场景应体现节日氛围但不过度装饰；如果是抽象几何或简约风格，场景应为现代简约或北欧风格；如果是花卉植物图案，场景应为温馨田园或清新自然风格；如果是复古或民族图案，场景应为复古怀旧或波西米亚风格。场景背景应简洁干净，仅用少量家具或装饰作为点缀（如极简边几、落地绿植、装饰画），柔和散射自然光照射，真实丝绒地毯厚度与自然边缘阴影，地毯与背景之间有清晰对比，8K高清，横向1:1比例，专业电商产品主图风格，产品为主场景为辅，背景简洁不抢镜，图案不变形不模糊
负面词：变形、模糊、水印、文字、多余杂物、鲜艳刺眼色彩、场景抢镜、产品过小、产品不完整、透视变形、图案改变、颜色改变、复杂背景、过多家具、过度装饰

任务2：多尺寸规格对比白底图（详情尺寸模块）
画面要求：纯白色极简背景，${sizeCount}块不同尺寸的${carpetShape}地毯整齐排列成网格，尺寸分别为${sizeDescriptions}，所有地毯图案必须与参考图片完全一致，每块地毯左侧和底部各带双单位刻度标尺，上方标注厘米(cm)数字，下方标注英寸(in)数字，尺寸数字清晰可辨，俯拍平铺无透视变形，地毯图案根据尺寸大小等比例精确拉伸或缩小，确保图案完整性和比例一致性，无家具无场景，横向1:1比例，专业电商规格图，图案不变形
负面词：阴影、场景、杂物、渐变背景、模糊文字、图案变形、尺寸标注错误、比例失调、图案改变、颜色改变

任务3：面料表面细节微距图（印花柔软面料卖点）
画面要求：地毯表面近距离微距特写，图案必须与参考图片完全一致，突出短绒丝绒纤维质感，画面顶部浅灰白半透明条，文字"Soft Fabric & Digital Printing"，柔和侧光凸显布料肌理，横向1:1写实实拍，图案细节清晰可见
负面词：翻边、背面、人物、污渍、杂乱光影、图案改变、颜色改变、图案模糊

任务4：防滑底背翻折细节图（防滑底层工艺）
画面要求：使用提供的参考示意图，展示地毯防滑底背细节，地毯一角向上翻折约45度，上方露出部分印花面且图案必须与参考图片完全一致，下方完整展示黑色点状橡胶防滑底，防滑底布满白色小圆点颗粒，右下角白色圆圈放大标注底背颗粒细节并带白色箭头指向，底部白色艺术字体"Non-Slip Backing"，浅木色木质地板背景，室内俯拍写实实拍，清晰展示防滑底纹理细节，横向1:1，印花面图案不变形
负面词：家具、大面积场景、变形底纹、模糊颗粒、杂乱背景、图案改变、颜色改变、印花面变形

任务5：易清洁吸尘器功能图（耐脏打理卖点）
画面要求：俯视俯拍完整地毯表面，图案必须与参考图片完全一致，少量浅褐色污渍散落在图案上，白色手持吸尘器吸头从右上角斜向进入画面，吸头尺寸约占地毯可视面积的1/3，正在清理污渍，画面顶部浅灰白半透明条，文字"Easy to Clean"，明亮均匀柔光，生活化产品实拍，横向1:1，图案不变形
负面词：杂乱家居、多余人物、昏暗光影、吸尘器过大或过小、阴影遮挡、图案改变、颜色改变、图案变形

任务6：高密度防滑创意宣传图（防滑性能强卖点）
画面要求：使用提供的参考示意图，大面积黑色防滑橡胶底微距纹理，白色小圆点颗粒均匀分布，2个微缩小人骑着自行车在底面上（一个穿蓝色上衣黑色裤子，一个穿黄色上衣蓝色裤子），直观展示超强防滑，深色高级渐变背景，顶部白色文字"High Density Rubber Particles strong non-slip"，高级商业渲染图，横向1:1
负面词：地毯正面印花、家具、杂物、低清模糊、人物比例失调、变形颗粒

请严格按照JSON格式输出，不要包含任何额外文字。`;

      const response = await axios.post(
        this.deepseekApiUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.deepseekApiKey}`,
          },
        }
      );

      const content = response.data.choices[0].message.content;

      let prompts: ImagePrompt[] = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          prompts = parsed.prompts || parsed;
        } else {
          prompts = this.parsePromptsFromText(content);
        }
      } catch {
        prompts = this.parsePromptsFromText(content);
      }

      return {
        success: true,
        prompts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parsePromptsFromText(content: string): ImagePrompt[] {
    const prompts: ImagePrompt[] = [];
    const tasks = [
      { key: '任务1', type: '产品场景主图', aspect_ratio: '1:1' },
      { key: '任务2', type: '多尺寸规格对比白底图', aspect_ratio: '1:1' },
      { key: '任务3', type: '面料表面细节微距图', aspect_ratio: '1:1' },
      { key: '任务4', type: '防滑底背翻折细节图', aspect_ratio: '1:1' },
      { key: '任务5', type: '易清洁吸尘器功能图', aspect_ratio: '1:1' },
      { key: '任务6', type: '高密度防滑创意宣传图', aspect_ratio: '1:1' },
    ];

    tasks.forEach((task) => {
      const taskMatch = content.split(task.key)[1];
      if (taskMatch) {
        let positive = '';
        let negative = '';

        const positiveMatch = taskMatch.match(/正向提示词[:：]([\s\S]*?)(?=反向提示词|$)/);
        const negativeMatch = taskMatch.match(/反向提示词[:：]([\s\S]*?)(?=任务|$)/);

        if (positiveMatch) {
          positive = positiveMatch[1].trim();
        }
        if (negativeMatch) {
          negative = negativeMatch[1].trim();
        }

        if (!positive) {
          positive = this.getDefaultPositivePrompt(task.type);
        }
        if (!negative) {
          negative = this.getDefaultNegativePrompt(task.type);
        }

        prompts.push({
          type: task.type,
          positive_prompt: positive,
          negative_prompt: negative,
          aspect_ratio: task.aspect_ratio,
        });
      }
    });

    return prompts;
  }

  private getDefaultPositivePrompt(type: string): string {
    const defaults: Record<string, string> = {
      '产品场景主图': '850g/sqm premium washable velvet polyester carpet, short plush soft texture, digital penetration printing, non-fading, rectangular rug as absolute main subject, product occupies 60-70% of frame, complete flat display, pattern identical to reference image, minimalist modern home scene background, light gray or light wood floor, minimal wooden side table and floor plant as subtle decor, soft diffused natural light from side, realistic velvet thickness and natural edge shadow, clear contrast between carpet and background, 8K HD, 1:1 aspect ratio, professional e-commerce product hero image style, product primary scene secondary, clean background not stealing focus, pattern unchanged non-blurry',
      '多尺寸规格对比白底图': '850g/sqm premium washable velvet polyester carpet, short plush soft texture, digital penetration printing, non-fading, pure white minimalist background, rectangular carpets of different sizes neatly arranged in grid, all carpets show identical pattern from reference image, each carpet has dual unit measuring scale on left and bottom edges, centimeter (cm) labels above, inch (in) labels below, size numbers clear and legible, top-down flat lay no perspective distortion, pattern proportionally scaled to each size ensuring pattern integrity, no furniture no scene, 1:1 aspect ratio, professional e-commerce specification image, pattern unchanged',
      '面料表面细节微距图': '850g/sqm premium washable velvet polyester carpet, short plush soft texture, digital penetration printing, non-fading, close-up macro detail of carpet surface, pattern identical to reference, highlighting short velvet fiber texture, semi-transparent light gray white bar at top with text "Soft Fabric & Digital Printing", soft side light accentuating fabric texture, 1:1 realistic photography, pattern details sharp and clear',
      '防滑底背翻折细节图': '850g/sqm premium washable velvet polyester carpet, short plush soft texture, digital penetration printing, non-fading, one corner folded up at 45 degrees, upper part showing printed surface pattern identical to reference, lower part fully showing black dot rubber non-slip backing, white small dot particles arranged in flower leaf pattern, white circle magnifying callout at bottom right highlighting backing dot details with white arrow pointing, white artistic text at bottom "Non-Slip Backing", light wood floor background, indoor top-down realistic photography, clear backing texture details, 1:1, printed pattern un-deformed',
      '易清洁吸尘器功能图': '850g/sqm premium washable velvet polyester carpet, short plush soft texture, digital penetration printing, non-fading, top-down overhead view of complete carpet surface, pattern identical to reference, few light brown stains scattered on pattern, white handheld vacuum cleaner head entering from top right corner diagonally, vacuum head size about 1/3 of visible carpet area, cleaning stains, semi-transparent light gray white bar at top with text "Easy to Clean", bright even soft light, lifestyle product realistic shot, 1:1, pattern unchanged',
      '高密度防滑创意宣传图': '850g/sqm premium washable velvet polyester carpet, short plush soft texture, digital penetration printing, non-fading, large area black rubber non-slip backing macro texture, white small dot particles evenly distributed, 2 miniature people riding bicycles on backing surface, one wearing blue shirt black pants, other wearing yellow shirt blue pants, visually demonstrating strong non-slip, dark premium gradient background, white text at top "High Density Rubber Particles strong non-slip", high-end commercial render, 1:1',
    };
    return defaults[type] || '';
  }

  private getDefaultNegativePrompt(type: string): string {
    const defaults: Record<string, string> = {
      '产品场景主图': 'deformed, blurry, watermark, text, extra clutter, overly bright and eye-catching colors, scene stealing focus, product too small, product incomplete, perspective distortion, overcrowded scene, distracting elements, pattern altered, color changed',
      '多尺寸规格对比白底图': 'shadows, scenes, clutter, gradient background, blurry text, pattern distortion, incorrect size labels, disproportionate scaling, pattern altered, color changed',
      '面料表面细节微距图': 'folding edge, back side, people, stains, messy lighting, pattern altered, color changed, blurry pattern',
      '防滑底背翻折细节图': 'furniture, large area scene, deformed backing texture, blurry particles, cluttered background, pattern altered, color changed, printed surface distorted',
      '易清洁吸尘器功能图': 'cluttered home, extra people, dim lighting, vacuum too large or too small, shadow obstruction, pattern altered, color changed, pattern distorted',
      '高密度防滑创意宣传图': 'carpet front print, furniture, clutter, low resolution blurry, disproportionate people, deformed particles',
    };
    return defaults[type] || '';
  }
}

class KeywordImageAgent {
  private deepseekApiKey: string;
  private deepseekApiUrl: string;

  constructor() {
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
    this.deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  }

  async generatePrompts(keywords: string[], sizes: string[] = [], carpetType: string = ''): Promise<ImageAgentResult> {
    try {
      if (!this.deepseekApiKey) {
        return {
          success: false,
          error: 'DeepSeek API key not configured',
        };
      }

      const systemPrompt = `你是专业地毯印花图案设计智能体RugPatternDesigner。
用户会提供创作灵感关键词，你需要基于这些关键词生成印花原图设计的AI绘图提示词。

通用强制规则：
1. 纯图案设计，无背景，无场景，无家具，无文字
2. 无缝平铺，高清印刷质量
3. 必须返回JSON格式，包含prompts数组，每个元素包含type、positive_prompt、negative_prompt、aspect_ratio字段`;

      const carpetShape = carpetType?.includes('圆形') ? '圆形' : '矩形';
      const sizeCount = sizes.length;
      const sizeDescriptions = sizes.map(s => this.formatSizeWithInch(s)).join(', ');

      const userPrompt = `创作关键词：${keywords.join('，')}
产品尺寸：${sizeCount > 0 ? sizeDescriptions : '多种尺寸'}
尺寸数量：${sizeCount}
产品类型：${carpetType || '矩形法兰绒地垫'}
地毯形状：${carpetShape}

请基于以上关键词生成1张产品原图的AI绘图提示词：

任务1：高清印花原图（基础印花图案）
画面要求：根据关键词设计的${carpetShape}地毯印花图案，纯图案设计，无背景，无场景，无家具，无缝平铺纹理，高清印刷质量，图案色彩丰富和谐，符合现代审美，适合数码印花工艺，粗线条清晰轮廓，纯色块平涂，无渐变无模糊，8K高清，横向1:1比例，专业印花设计稿
负面词：背景、场景、家具、文字、水印、模糊、变形、颜色改变、图案改变


请严格按照JSON格式输出，不要包含任何额外文字。`;

      const response = await axios.post(
        this.deepseekApiUrl,
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.deepseekApiKey}`,
          },
        }
      );

      const content = response.data.choices[0].message.content;

      let prompts: ImagePrompt[] = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          prompts = parsed.prompts || parsed;
        } else {
          prompts = this.parsePromptsFromText(content);
        }
      } catch {
        prompts = this.parsePromptsFromText(content);
      }

      return {
        success: true,
        prompts,
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message || 
                          error.message || 
                          'Unknown error';
      const statusCode = error.response?.status || 'unknown';
      console.error('[KeywordImageAgent] DeepSeek API error:', statusCode, errorMessage);
      console.error('[KeywordImageAgent] Request URL:', this.deepseekApiUrl);
      console.error('[KeywordImageAgent] API Key present:', !!this.deepseekApiKey);
      return {
        success: false,
        error: `${statusCode} - ${errorMessage}`,
      };
    }
  }

  private formatSizeWithInch(sizeCm: string): string {
    const cleanSize = sizeCm.replace('*', 'x');
    const [w, h] = cleanSize.split('x').map(Number);
    if (!w || !h) return sizeCm;
    const wIn = (w / 2.54).toFixed(1);
    const hIn = (h / 2.54).toFixed(1);
    return `${sizeCm}cm (${wIn}x${hIn}in)`;
  }

  private parsePromptsFromText(content: string): ImagePrompt[] {
    const prompts: ImagePrompt[] = [];
    const tasks = [
      { key: '任务1', type: '高清印花原图', aspect_ratio: '1:1' }
    ];

    tasks.forEach((task) => {
      const taskMatch = content.split(task.key)[1];
      if (taskMatch) {
        let positive = '';
        let negative = '';

        const positiveMatch = taskMatch.match(/正向提示词[:：]([\s\S]*?)(?=反向提示词|$)/);
        const negativeMatch = taskMatch.match(/反向提示词[:：]([\s\S]*?)(?=任务|$)/);

        if (positiveMatch) {
          positive = positiveMatch[1].trim();
        }
        if (negativeMatch) {
          negative = negativeMatch[1].trim();
        }

        if (!positive) {
          positive = this.getDefaultPositivePrompt(task.type);
        }
        if (!negative) {
          negative = this.getDefaultNegativePrompt(task.type);
        }

        prompts.push({
          type: task.type,
          positive_prompt: positive,
          negative_prompt: negative,
          aspect_ratio: task.aspect_ratio,
        });
      }
    });

    return prompts;
  }

  private getDefaultPositivePrompt(type: string): string {
    const defaults: Record<string, string> = {
      '高清印花原图': 'Pure carpet print pattern design, no background, no scene, no furniture, seamless tiling texture, high-definition printing quality, rich and harmonious colors, modern aesthetic, suitable for digital printing process, bold clear lines, solid color blocks, no gradients no blurring, 8K ultra HD, 1:1 landscape aspect ratio, professional print design, suitable for mass production printing',
    };
    return defaults[type] || '';
  }

  private getDefaultNegativePrompt(type: string): string {
    const defaults: Record<string, string> = {
      '高清印花原图': 'background, scene, furniture, text, watermark, blurry, deformed, color changed, pattern altered',
    };
    return defaults[type] || '';
  }
}

export { OriginalPatternAgent, ProductImageAgent, KeywordImageAgent };

export default ProductImageAgent;
