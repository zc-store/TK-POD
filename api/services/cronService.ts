import cron from 'node-cron';
import Keyword from '../models/Keyword';
import Pattern from '../models/Pattern';
import Product from '../models/Product';
import Config from '../models/Config';
import JimengService from './jimeng';
import TiktokService from './tiktok';
import { OriginalPatternAgent, ProductImageAgent, KeywordImageAgent } from './imageAgent';
import TitleAgent from './titleAgent';
import ExcelService from './excel';
import { isConnected } from '../db';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const IMAGE_DIR = path.join(process.cwd(), 'images');

if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

class CronService {
  private jimengService: JimengService | null = null;
  private tiktokService: TiktokService | null = null;
  private isRunning = false;
  private currentProgress: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    message: string;
    progress: number;
    details: Array<{ productName: string; keywords: string[]; status: string }>;
  } | null = null;

  constructor() {
    this.initServices();
  }

  private initServices() {
    const apiKey = process.env.TIKTOK_SHOP_API_KEY || '';
    const apiSecret = process.env.TIKTOK_SHOP_API_SECRET || '';
    const region = process.env.TIKTOK_SHOP_REGION || 'US';
    const redirectUri = process.env.TIKTOK_SHOP_REDIRECT_URI || '';
    const jimengApiKey = process.env.JIMENG_API_KEY || '';
    const jimengApiSecret = process.env.JIMENG_API_SECRET || '';

    this.jimengService = new JimengService({ apiKey: jimengApiKey, apiSecret: jimengApiSecret });
    this.tiktokService = new TiktokService({ apiKey, apiSecret, region, redirectUri });
  }

  async init() {
    await this.initializeDefaultKeywords();
    this.scheduleDailyTask();
  }

  private scheduleDailyTask() {
    const schedule = '0 10 * * *';
    cron.schedule(schedule, () => {
      this.executeDailyTask();
    });
    console.log(`[Cron] Scheduled task registered: ${schedule}`);
  }

  async executeDailyTask() {
    if (this.isRunning) {
      console.log('[Cron] Task is already running');
      return;
    }

    if (!isConnected) {
      console.log('[Cron] Database not connected, skipping task');
      return;
    }

    this.isRunning = true;
    this.currentProgress = {
      status: 'running',
      message: 'Starting daily product generation',
      progress: 0,
      details: [],
    };

    try {
      const dailyCount = 5;
      const keywordsPerProduct = 3;

      console.log(`[Cron] Starting daily product generation: ${dailyCount} products`);

      for (let i = 0; i < dailyCount; i++) {
        if (!isConnected) {
          console.log('[Cron] Database disconnected, stopping task');
          break;
        }

        try {
          const keywords = await this.getRandomKeywords(keywordsPerProduct);
          const productName = this.generateProductName(keywords);
          
          console.log(`[Cron] Generating product ${i + 1}/${dailyCount}: ${productName}`);
          console.log(`[Cron] Keywords: ${keywords.map(k => k.name).join(', ')}`);

          this.currentProgress = {
            ...this.currentProgress!,
            message: `Creating product: ${productName}`,
          };

          const created = await this.createProductFromKeywords(keywords, productName);
          
          if (this.currentProgress) {
            this.currentProgress.details.push({
              productName,
              keywords: keywords.map(k => k.name),
              status: created ? 'success' : 'failed',
            });
            this.currentProgress.progress = ((i + 1) / dailyCount) * 100;
          }

          await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (error) {
          console.error(`[Cron] Error generating product ${i + 1}:`, error);
        }
      }

      this.currentProgress = {
        ...this.currentProgress!,
        status: 'completed',
        message: 'Daily product generation completed',
        progress: 100,
      };

      console.log('[Cron] Daily product generation completed successfully');

    } catch (error) {
      console.error('[Cron] Daily task failed:', error);
      this.currentProgress = {
        ...this.currentProgress!,
        status: 'failed',
        message: 'Daily product generation failed',
        progress: 0,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async getRandomKeywords(count: number): Promise<Array<{ name: string; category: string }>> {
    const categories = ['style', 'theme', 'color', 'texture'];
    const shuffled = [...categories].sort(() => Math.random() - 0.5);
    const selectedCategories = shuffled.slice(0, Math.min(count, categories.length));

    const keywords: Array<{ name: string; category: string }> = [];

    for (const category of selectedCategories) {
      const countInCategory = await Keyword.countDocuments({ category });
      if (countInCategory > 0) {
        const skip = Math.floor(Math.random() * countInCategory);
        const keyword = await Keyword.findOne({ category }).skip(skip);
        if (keyword) {
          keywords.push({ name: keyword.name, category });
        }
      }
    }

    if (keywords.length < count) {
      const remainingCount = count - keywords.length;
      const allKeywords = await Keyword.find().limit(remainingCount);
      allKeywords.forEach(k => {
        if (!keywords.some(kw => kw.name === k.name)) {
          keywords.push({ name: k.name, category: k.category });
        }
      });
    }

    return keywords;
  }

  private generateProductName(keywords: Array<{ name: string; category: string }>): string {
    const keywordNames = keywords.map(k => k.name);
    return `${keywordNames.join(' ')} `;
  }

  private async createProductFromKeywords(
    keywords: Array<{ name: string; category: string }>,
    productName: string
  ): Promise<boolean> {
    const sizes = ['60x90cm', '40x60cm'];
    const carpetType = '矩形仿硅藻泥地垫';

    try {
      const patternImages = await this.generatePatternImages(productName, carpetType, sizes, keywords);
      
      if (patternImages.length === 0) {
        console.error('[Cron] No pattern images generated');
        return false;
      }

      const pattern = await this.createPattern(productName, keywords, sizes, patternImages);
      
      if (!pattern) {
        console.error('[Cron] Failed to create pattern');
        return false;
      }

      const product = await this.createProduct(productName, keywords, sizes, carpetType, pattern);
      
      if (!product) {
        console.error('[Cron] Failed to create product');
        return false;
      }

      try {
        const productImages = await this.generateProductImages(product, sizes, carpetType);
        
        if (productImages.length > 0) {
          await this.updateProductWithImages(product, productImages);
        } else {
          console.log('[Cron] No product images generated, skipping image update');
        }
      } catch (error) {
        console.error('[Cron] Failed to generate product images, but product was created:', error);
      }

      return true;

    } catch (error) {
      console.error('[Cron] Error creating product:', error);
      return false;
    }
  }

  private async generatePatternImages(productName: string, carpetType: string, sizes: string[], keywords: Array<{ name: string; category: string }>): Promise<string[]> {
    const agent = new KeywordImageAgent();
    const keywordNames = keywords.map(k => k.name);
    console.log('[Cron] Generating pattern prompts for keywords:', keywordNames);
    
    const promptsResult = await agent.generatePrompts(keywordNames, sizes, carpetType);
    
    if (!promptsResult.success || !promptsResult.prompts) {
      console.error('[Cron] Failed to generate pattern prompts:', promptsResult.error);
      return [];
    }

    const generatedUrls: string[] = [];

    for (const prompt of promptsResult.prompts) {
      if (!this.jimengService) continue;

      const result = await this.jimengService.generateImage(prompt.positive_prompt, prompt.aspect_ratio);
      
      if (result.success && result.imageUrls && result.imageUrls.length > 0) {
        const imageUrl = result.imageUrls[0];
        
        const fileName = `${Date.now()}-${prompt.type.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-')}.png`;
        const localPath = path.join(IMAGE_DIR, fileName);
        
        try {
          const savedPath = await this.downloadAndSaveImage(imageUrl, localPath);
          if (!fs.existsSync(localPath)) {
            throw new Error('File not saved');
          }
          generatedUrls.push(savedPath);
          console.log('[Cron] Pattern image saved:', savedPath);
        } catch (e) {
          console.error('[Cron] Failed to save pattern image:', e);
          generatedUrls.push(imageUrl);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return generatedUrls;
  }

  private async createPattern(
    name: string,
    keywords: Array<{ name: string; category: string }>,
    sizes: string[],
    imageUrls: string[]
  ): Promise<any> {
    try {
      const imageUrlsMap: Record<string, string> = {};
      
      sizes.forEach((size, index) => {
        imageUrlsMap[size] = imageUrls[index] || imageUrls[0] || '';
      });

      const pattern = await Pattern.create({
        name,
        theme: keywords.find(k => k.category === 'theme')?.name || '原创设计',
        colors: keywords.filter(k => k.category === 'color').map(k => k.name),
        keywords: keywords.map(k => k.name),
        sizes,
        image_urls: imageUrlsMap,
        created_at: new Date(),
      });

      console.log(`[Cron] Pattern created: ${pattern._id}`);
      return pattern;
    } catch (error) {
      console.error('[Cron] Error creating pattern:', error);
      return null;
    }
  }

  private async createProduct(
    name: string,
    keywords: Array<{ name: string; category: string }>,
    sizes: string[],
    carpetType: string,
    pattern: any
  ): Promise<any> {
    try {
      const titleAgent = new TitleAgent();
      const titleResult = await titleAgent.generateTikTokTitle(name, '', '', [], carpetType, sizes);
      
      const title = titleResult.success && titleResult.title 
        ? titleResult.title 
        : name;

      const variants = sizes.map(size => {
        const isLarge = size.includes('60x90');
        const costPrice = isLarge ? 12.00 : 8.00;
        const sellingPrice = isLarge ? 32.50 : 22.50;
        return {
          size_cm: size,
          production_size_cm: size,
          cost_price: costPrice,
          selling_price: sellingPrice,
          price_breakdown: {
            cost: costPrice * 0.6,
            shipping: isLarge ? 4.00 : 2.50,
            commission: sellingPrice * 0.15,
            packaging: 1.00,
            tax: sellingPrice * 0.08,
            profit: sellingPrice - costPrice - (isLarge ? 4.00 : 2.50) - (sellingPrice * 0.15) - 1.00 - (sellingPrice * 0.08),
          },
          weight: isLarge ? 1.5 : 0.8,
          packaging_weight: 0.2,
          packaging_size: '30x20x10cm',
          inventory: 100,
        };
      });

      const sku = `RUG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const patternImageUrl = pattern.image_urls && Object.values(pattern.image_urls).length > 0 
        ? Object.values(pattern.image_urls)[0] 
        : '';

      const product = await Product.create({
        sku,
        name,
        title_en: title,
        description_en: `High quality ${carpetType}, made of premium materials, soft and comfortable, non-slip and durable. Suitable for various home scenarios.`,
        pattern_id: pattern._id,
        pattern_name: pattern.name,
        carpet_type: carpetType,
        material: 'Polyester Velvet',
        image_url: patternImageUrl,
        images: patternImageUrl ? [patternImageUrl] : [],
        category: '家纺布艺-居家布艺-地毯-局部地毯',
        tiktok_category_id: '815504',
        tiktok_category_name: '家纺布艺-居家布艺-地毯-局部地毯',
        attributes: {},
        variants,
        product_details: '',
        product_highlights: ['Soft and comfortable', 'Non-slip backing', 'Machine washable', 'Durable'],
        image_prompts: [],
        generated_images: [],
        status: 'draft',
        created_at: new Date(),
      });

      const productImageAgent = new ProductImageAgent();
      const productImageResult = await productImageAgent.generatePrompts(name, sizes, carpetType);
      
      if (productImageResult.success && productImageResult.prompts) {
        product.image_prompts = productImageResult.prompts;
        await product.save();
      }

      console.log(`[Cron] Product created: ${product._id}`);
      return product;
    } catch (error) {
      console.error('[Cron] Error creating product:', error);
      return null;
    }
  }

  private async generateProductImages(product: any, sizes: string[], carpetType: string): Promise<string[]> {
    if (!this.jimengService) return [];

    const generatedUrls: string[] = [];
    const referenceImageUrl = product.pattern_id 
      ? await this.getPatternImageUrl(product.pattern_id)
      : '';

    if (!referenceImageUrl) {
      console.error('[Cron] No reference image available for product:', product.name);
      return [];
    }

    let uploadUrl = referenceImageUrl;
    
    if (referenceImageUrl.startsWith('/images/')) {
      const config = await Config.findOne();
      if (config && config.tiktok_shop && config.tiktok_shop.access_token) {
        try {
          const localFilePath = path.join(IMAGE_DIR, referenceImageUrl.replace('/images/', ''));
          if (fs.existsSync(localFilePath)) {
            const imageBuffer = fs.readFileSync(localFilePath);
            const uploadResult = await this.tiktokService!.uploadProductImage(
              config.tiktok_shop.access_token,
              imageBuffer,
              'DESCRIPTION_IMAGE',
              config.tiktok_shop.shop_id
            );
            
            if (uploadResult.success && uploadResult.image_url) {
              uploadUrl = uploadResult.image_url;
              console.log('[Cron] Uploaded reference image to TikTok:', uploadUrl);
            } else {
              console.error('[Cron] TikTok upload failed:', uploadResult.error);
              uploadUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            }
          }
        } catch (e) {
          console.error('[Cron] Failed to upload to TikTok, fallback to base64:', e);
          const localFilePath = path.join(IMAGE_DIR, referenceImageUrl.replace('/images/', ''));
          if (fs.existsSync(localFilePath)) {
            const fileBuffer = fs.readFileSync(localFilePath);
            uploadUrl = `data:image/png;base64,${fileBuffer.toString('base64')}`;
          }
        }
      } else {
        const localFilePath = path.join(IMAGE_DIR, referenceImageUrl.replace('/images/', ''));
        if (fs.existsSync(localFilePath)) {
          const fileBuffer = fs.readFileSync(localFilePath);
          uploadUrl = `data:image/png;base64,${fileBuffer.toString('base64')}`;
        }
      }
    }

    if (!product.image_prompts || product.image_prompts.length === 0) {
      const productImageAgent = new ProductImageAgent();
      const productImageResult = await productImageAgent.generatePrompts(product.name, sizes, carpetType);
      
      if (productImageResult.success && productImageResult.prompts) {
        product.image_prompts = productImageResult.prompts;
        await product.save();
      }
    }

    for (const prompt of product.image_prompts) {
      try {
        const result = await this.jimengService!.generateImageWithReference(
          prompt.positive_prompt,
          uploadUrl,
          prompt.aspect_ratio
        );
        
        if (result.success && result.imageUrls && result.imageUrls.length > 0) {
          const imageUrl = result.imageUrls[0];
          const fileName = `${Date.now()}-${prompt.type.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-')}.png`;
          const localPath = path.join(IMAGE_DIR, fileName);
          
          try {
            await this.downloadAndSaveImage(imageUrl, localPath);
            if (fs.existsSync(localPath)) {
              generatedUrls.push(`/images/${fileName}`);
              console.log('[Cron] Product image saved:', `/images/${fileName}`);
            } else {
              generatedUrls.push(imageUrl);
            }
          } catch (e) {
            console.error('[Cron] Failed to save product image:', e);
            generatedUrls.push(imageUrl);
          }
        } else if (!result.success) {
          console.error('[Cron] Jimeng API failed to generate image:', result.error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error('[Cron] Failed to generate product image:', error);
      }
    }

    return generatedUrls;
  }

  private async getPatternImageUrl(patternId: string): Promise<string> {
    try {
      const pattern = await Pattern.findById(patternId);
      if (pattern && pattern.image_urls) {
        const firstSize = Object.keys(pattern.image_urls)[0];
        return pattern.image_urls[firstSize] || '';
      }
    } catch (error) {
      console.error('[Cron] Failed to get pattern image:', error);
    }
    return '';
  }

  private async updateProductWithImages(product: any, imageUrls: string[]): Promise<void> {
    try {
      product.images = [...product.images, ...imageUrls];
      await product.save();
      console.log('[Cron] Product images updated:', product._id);
    } catch (error) {
      console.error('[Cron] Error updating product images:', error);
    }
  }

  private async downloadAndSaveImage(url: string, localPath: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, response.data);
    return `/images/${path.basename(localPath)}`;
  }

  async initializeDefaultKeywords(): Promise<void> {
    if (!isConnected) return;

    const defaultKeywords = [
      { name: '现代简约', category: 'style' as const },
      { name: '北欧风', category: 'style' as const },
      { name: '波西米亚', category: 'style' as const },
      { name: '复古怀旧', category: 'style' as const },
      { name: '几何抽象', category: 'style' as const },
      { name: '花卉植物', category: 'theme' as const },
      { name: '海洋沙滩', category: 'theme' as const },
      { name: '星空宇宙', category: 'theme' as const },
      { name: '森林动物', category: 'theme' as const },
      { name: '节日庆典', category: 'theme' as const },
      { name: '莫兰迪色系', category: 'color' as const },
      { name: '高饱和撞色', category: 'color' as const },
      { name: '清新淡雅', category: 'color' as const },
      { name: '黑白灰', category: 'color' as const },
      { name: '马卡龙色系', category: 'color' as const },
      { name: '短绒', category: 'texture' as const },
      { name: '长绒', category: 'texture' as const },
      { name: '编织', category: 'texture' as const },
      { name: '立体浮雕', category: 'texture' as const },
      { name: '光滑', category: 'texture' as const },
      
      { name: 'living room', category: 'theme' as const },
      { name: 'bedroom', category: 'theme' as const },
      { name: 'home office', category: 'theme' as const },
      { name: 'entryway', category: 'theme' as const },
      { name: 'cool room decor', category: 'theme' as const },
      { name: 'aesthetic room decor', category: 'theme' as const },
      { name: 'apartment accessory', category: 'theme' as const },
      { name: 'home accessory', category: 'theme' as const },
      
      { name: 'soft plush', category: 'texture' as const },
      { name: 'fluffy', category: 'texture' as const },
      { name: 'shag', category: 'texture' as const },
      { name: 'shaggy', category: 'texture' as const },
      { name: 'faux fur', category: 'texture' as const },
      { name: 'modern shaggy', category: 'style' as const },
      { name: 'low pile', category: 'texture' as const },
      { name: 'reversible', category: 'style' as const },
      { name: 'lightweight', category: 'style' as const },
      { name: 'hand wash', category: 'style' as const },
      { name: 'in style', category: 'style' as const },
      
      { name: 'anti-slip backing', category: 'texture' as const },
      { name: 'rubber backing', category: 'texture' as const },
      { name: 'tpr anti-slip bottom', category: 'texture' as const },
      { name: 'non slip', category: 'texture' as const },
      { name: 'non-slip', category: 'texture' as const },
      { name: 'easy care', category: 'style' as const },
      
      { name: 'pizza prep mat', category: 'theme' as const },
      { name: 'soft prayer mat', category: 'theme' as const },
      { name: 'fall prevention mat', category: 'theme' as const },
      { name: 'carport', category: 'theme' as const },
      { name: 'breathable honeycomb gel', category: 'texture' as const },
      { name: 'outdoor floor mat', category: 'theme' as const },
      { name: 'outdoor patio rug', category: 'theme' as const },
      { name: 'funny welcome door mat', category: 'theme' as const },
      { name: 'religious doormat', category: 'theme' as const },
      
      { name: 'santa deer christmas', category: 'theme' as const },
      
      { name: 'mat', category: 'style' as const },
      { name: 'rug', category: 'style' as const },
      { name: 'carpet', category: 'style' as const },
      { name: 'area mat', category: 'style' as const },
      { name: 'area rug', category: 'style' as const },
      { name: 'large area mat', category: 'style' as const },
      { name: 'doormat', category: 'style' as const },
      { name: 'indoor rug', category: 'style' as const },
      { name: 'indoor area rug', category: 'style' as const },
      { name: 'indoor floor rug', category: 'style' as const },
      { name: 'bedroom non slip', category: 'style' as const },
      { name: 'preston carpet', category: 'style' as const },
      { name: 'household decorative rug', category: 'style' as const },
      
      { name: 'happy place', category: 'theme' as const },
    ];

    for (const kw of defaultKeywords) {
      try {
        const existing = await Keyword.findOne({ name: kw.name });
        if (!existing) {
          await Keyword.create(kw);
          console.log(`[Cron] Created default keyword: ${kw.name}`);
        }
      } catch (error) {
        console.log(`[Cron] Keyword ${kw.name} already exists or error`);
      }
    }

    console.log('[Cron] Default keywords initialized');
  }

  getProgress() {
    return this.currentProgress || {
      status: 'idle',
      message: 'No task running',
      progress: 0,
      details: [],
    };
  }

  get isExecuting() {
    return this.isRunning;
  }
}

let cronService: CronService | null = null;

export async function initCron() {
  if (!cronService) {
    cronService = new CronService();
    await cronService.init();
  }
  return cronService;
}

export function getCronService() {
  return cronService;
}

export default CronService;
