import axios from 'axios';

export interface TitleAgentResult {
  success: boolean;
  title?: string;
  description?: string;
  keywords?: string[];
  error?: string;
}

interface TitleAgentConfig {
  deepseekApiKey?: string;
  deepseekApiUrl?: string;
}

class TitleAgent {
  private deepseekApiKey: string;
  private deepseekApiUrl: string;

  constructor(config: TitleAgentConfig = {}) {
    this.deepseekApiKey = config.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '';
    this.deepseekApiUrl = config.deepseekApiUrl || process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
  }

  async generateTikTokTitle(
    patternName: string,
    patternDescription: string = '',
    patternTheme: string = '',
    patternColors: string[] = [],
    carpetType: string = '矩形天鹅绒地毯',
    sizes: string[] = [],
    material: string = '聚酯纤维'
  ): Promise<TitleAgentResult> {
    try {
      if (!this.deepseekApiKey) {
        const fallbackTitle = this.generateFallbackTitle(patternName, sizes, carpetType);
        const fallbackDescription = this.generateFallbackDescription(patternName, sizes, material);
        return {
          success: true,
          title: fallbackTitle,
          description: fallbackDescription,
          keywords: this.extractKeywords(patternName, patternTheme, patternColors),
        };
      }

      const colorList = patternColors.length > 0 ? patternColors.join(', ') : 'Multicolor';
      const sizeList = sizes.length > 0 ? sizes.join(', ') : 'Multiple Sizes';
      const sizeRange = sizes.length > 1 ? `${sizes[0]} - ${sizes[sizes.length - 1]}` : sizeList;

      const systemPrompt = `你是专业跨境家居电商TikTok标题优化专家。
你的任务是根据产品信息生成适用于TikTok Shop美国市场的高质量产品标题和描述。

标题生成规则：
1. 长度控制在80-120字符，不超过150字符
2. 开头必须包含核心关键词（图案名称）
3. 包含产品类型（Area Rug, Floor Mat, Carpet等）
4. 包含材质关键词（Velvet, Polyester, Washable等）
5. 包含尺寸信息（如60x90cm, Multiple Sizes）
6. 包含使用场景（Living Room, Bedroom, Home Decor）
7. 包含核心卖点（Non-Slip, Soft, Washable, Durable）
8. 使用热门搜索词提高曝光率
9. 语言自然流畅，符合TikTok用户搜索习惯

描述生成规则：
1. 长度300-500字符
2. 使用HTML标签格式化（<p>, <strong>, <ul>, <li>）
3. 突出产品卖点和优势
4. 包含尺寸列表（带厘米和英寸换算）
5. 包含适用场景
6. 引导用户购买

必须返回JSON格式，包含title、description、keywords三个字段。`;

      const userPrompt = `产品信息：
图案名称：${patternName}
图案主题：${patternTheme || '现代简约'}
图案颜色：${colorList}
产品类型：${carpetType}
尺寸范围：${sizeRange}
可用尺寸：${sizeList}
材质：${material}
图案描述：${patternDescription || '暂无详细描述'}

请生成：
1. TikTok标题（80-120字符）
2. TikTok产品描述（300-500字符）
3. 5-10个核心关键词

输出格式为JSON：
{
  "title": "...",
  "description": "...",
  "keywords": ["...", "..."]
}`;

      const response = await axios.post(this.deepseekApiUrl, {
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }, {
        headers: {
          'Authorization': `Bearer ${this.deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const result = response.data;
      if (result && result.choices && result.choices.length > 0) {
        const content = result.choices[0].message.content;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonResult = JSON.parse(jsonMatch[0]);
            return {
              success: true,
              title: jsonResult.title || this.generateFallbackTitle(patternName, sizes, carpetType),
              description: jsonResult.description || this.generateFallbackDescription(patternName, sizes, material),
              keywords: jsonResult.keywords || this.extractKeywords(patternName, patternTheme, patternColors),
            };
          }
        } catch (e) {
          console.error('Failed to parse JSON:', e);
        }
      }

      const fallbackTitle = this.generateFallbackTitle(patternName, sizes, carpetType);
      const fallbackDescription = this.generateFallbackDescription(patternName, sizes, material);
      return {
        success: true,
        title: fallbackTitle,
        description: fallbackDescription,
        keywords: this.extractKeywords(patternName, patternTheme, patternColors),
      };

    } catch (error) {
      console.error('Title generation failed:', error);
      const fallbackTitle = this.generateFallbackTitle(patternName, sizes, carpetType);
      const fallbackDescription = this.generateFallbackDescription(patternName, sizes, material);
      return {
        success: true,
        title: fallbackTitle,
        description: fallbackDescription,
        keywords: this.extractKeywords(patternName, patternTheme, patternColors),
      };
    }
  }

  private generateFallbackTitle(patternName: string, sizes: string[], carpetType: string): string {
    const sizeRange = sizes.length > 1 ? `${sizes[0]} - ${sizes[sizes.length - 1]}` : (sizes[0] || 'Multiple Sizes');
    const typeEn = carpetType.includes('天鹅绒') ? 'Velvet' : 'Flannel';
    const typeCn = carpetType.includes('地垫') ? 'Floor Mat' : 'Area Rug';
    
    return `${patternName} ${typeEn} ${typeCn} ${sizeRange} - Soft Washable Non-Slip Home Decor for Living Room Bedroom`;
  }

  private generateFallbackDescription(patternName: string, sizes: string[], material: string): string {
    const sizeList = sizes.map(size => {
      const [width, length] = size.split('x').map(s => s.replace('cm', ''));
      return `${size}cm (${Math.round(parseFloat(width)/2.54)}" x ${Math.round(parseFloat(length)/2.54)}")`;
    }).join(', ');

    return `<p>Elevate your home decor with this stunning ${patternName} area rug! Made from premium 850g/sqm washable polyester velvet, this rug features a luxurious soft texture and vibrant digital printing that won't fade.</p>
<p><strong>Available Sizes:</strong></p>
<p>${sizeList}</p>
<p><strong>Product Features:</strong></p>
<ul>
<li>Material: ${material}</li>
<li>High density 850g/sqm premium velvet fabric</li>
<li>Non-slip rubber backing for safety</li>
<li>Machine washable for easy cleaning</li>
<li>Durable digital printing, colorfast</li>
</ul>
<p><strong>Perfect For:</strong></p>
<ul>
<li>Living room, bedroom, dining room</li>
<li>Entryway, hallway, kids room</li>
<li>Home office, nursery</li>
</ul>
<p>Add warmth and style to any space with this beautiful patterned rug. Order now and transform your home!</p>`;
  }

  private extractKeywords(patternName: string, patternTheme: string, patternColors: string[]): string[] {
    const keywords: string[] = [];
    
    if (patternName) keywords.push(patternName);
    if (patternTheme) keywords.push(patternTheme);
    if (patternColors.length > 0) keywords.push(...patternColors);
    
    keywords.push('area rug', 'carpet', 'home decor', 'living room', 'bedroom', 'non-slip', 'washable', 'velvet');
    
    return [...new Set(keywords)].slice(0, 10);
  }
}

export default TitleAgent;