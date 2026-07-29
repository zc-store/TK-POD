import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import Product from '../models/Product';
import Config from '../models/Config';
import ExcelService from '../services/excel';
import ProductImageAgent from '../services/imageAgent';
import TitleAgent from '../services/titleAgent';
import JimengService from '../services/jimeng';
import TiktokService from '../services/tiktok';
import { isConnected } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(200).json({ success: true, data: [], total: 0 });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const skip = (page - 1) * pageSize;
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find()
        .sort(sort)
        .skip(skip)
        .limit(pageSize),
      Product.countDocuments()
    ]);

    const productsWithId = products.map(p => {
      const obj = p.toObject();
      obj.id = obj._id?.toString() || '';
      return obj;
    });

    res.status(200).json({ success: true, data: productsWithId, total, page, pageSize });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/carpet-types', async (req: Request, res: Response) => {
  try {
    const excelService = new ExcelService();
    const excelResult = await excelService.readCarpetSizes(process.env.EXCEL_FILE_PATH || '');
    
    const types: Record<string, { name: string; sizes: { size_cm: string; production_size_cm: string; cost_price: number; weight_g: number }[] }> = {};
    
    if (excelResult.success && excelResult.sizes) {
      excelResult.sizes.forEach((item) => {
        const skuCategory = (item.sku_category || '其他') as string;
        if (!types[skuCategory]) {
          types[skuCategory] = {
            name: skuCategory,
            sizes: [],
          };
        }
        types[skuCategory].sizes.push({
          size_cm: item.size_cm || '',
          production_size_cm: item.production_size_cm || '',
          cost_price: item.cost_price || 0,
          weight_g: item.weight_g || 0,
        });
      });
    }
    
    res.status(200).json({ success: true, data: Object.values(types) });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { 
      pattern_id, 
      pattern_name, 
      pattern_theme,
      pattern_colors,
      sizes, 
      image_urls, 
      price_settings,
      carpet_type,
      pattern_description 
    } = req.body;
    
    const effectivePriceSettings = price_settings || {
      shipping_fee: parseFloat(process.env.SHIPPING_FEE || '5'),
      platform_commission_rate: parseFloat(process.env.COMMISSION_RATE || '0.15'),
      packaging_fee: parseFloat(process.env.PACKAGING_FEE || '2'),
      tax_rate: parseFloat(process.env.TAX_RATE || '0.08'),
      profit_rate: parseFloat(process.env.PROFIT_RATE || '0.3'),
    };

    const excelService = new ExcelService();
    const excelResult = await excelService.readCarpetSizes(process.env.EXCEL_FILE_PATH || '');
    
    const variants = [];
    let material = '面料100%聚酯纤维+内胆聚氨酯';
    const imageUrl = (Object.values(image_urls)[0] as string) || '';

    for (const size of sizes) {
      const sizeWithoutCm = size.replace('cm', '').replace('*', 'x');
      
      let basePrice = 18;
      let productionSize = size;
      let weightG = 100;
      let packagingWeightG = 0;
      let packagingSize = '';
      
      if (excelResult.success && excelResult.sizes) {
        const foundSize = excelResult.sizes.find((s) => {
          const skuCategory = s.sku_category || '';
          const sizeCm = s.size_cm || '';
          return (
            (!carpet_type || skuCategory === carpet_type) &&
            (sizeCm === size || sizeCm === sizeWithoutCm || sizeCm === size.replace('x', '*'))
          );
        });
        if (foundSize) {
          basePrice = foundSize.cost_price || basePrice;
          material = foundSize.material || material;
          productionSize = foundSize.production_size_cm || size;
          weightG = foundSize.weight_g || weightG;
          packagingWeightG = foundSize.packaging_weight_g || 0;
          packagingSize = foundSize.packaging_size_cm || '';
        }
      }

      const commission = basePrice * effectivePriceSettings.platform_commission_rate;
      const tax = (basePrice + effectivePriceSettings.shipping_fee + commission + effectivePriceSettings.packaging_fee) * effectivePriceSettings.tax_rate;
      const profit = basePrice * effectivePriceSettings.profit_rate;
      const sellingPrice = basePrice + effectivePriceSettings.shipping_fee + commission + effectivePriceSettings.packaging_fee + tax + profit;

      const [width, length] = size.split('x').map(s => s.replace('cm', ''));

      variants.push({
        size_cm: sizeWithoutCm,
        production_size_cm: productionSize,
        cost_price: basePrice,
        selling_price: parseFloat(sellingPrice.toFixed(2)),
        price_breakdown: {
          cost: basePrice,
          shipping: effectivePriceSettings.shipping_fee,
          commission: parseFloat(commission.toFixed(2)),
          packaging: effectivePriceSettings.packaging_fee,
          tax: parseFloat(tax.toFixed(2)),
          profit: parseFloat(profit.toFixed(2)),
        },
        weight: parseFloat((weightG / 1000).toFixed(2)),
        packaging_weight: parseFloat((packagingWeightG / 1000).toFixed(2)) || parseFloat((weightG / 1000 + 0.1).toFixed(2)),
        packaging_size: packagingSize || `${parseFloat(width) + 5}x${parseFloat(length) + 5}x3`,
        inventory: 100,
      });
    }

    const sizeRange = sizes.length > 1 ? `${sizes[0]} - ${sizes[sizes.length - 1]}` : sizes[0];
    
    const titleAgent = new TitleAgent();
    const titleResult = await titleAgent.generateTikTokTitle(
      pattern_name,
      pattern_description,
      pattern_theme,
      pattern_colors || [],
      carpet_type,
      sizes,
      material
    );
    
    const titleEn = titleResult.title || generateTikTokTitle(pattern_name);
    const descriptionEn = titleResult.description || generateTikTokDescription(pattern_name, sizes, material);

    const productData = {
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      name: pattern_name,
      title_en: titleEn,
      description_en: descriptionEn,
      pattern_id,
      pattern_name,
      carpet_type: carpet_type || '矩形法兰绒地垫',
      material: material,
      image_url: imageUrl,
      images: [imageUrl],
      category: 'Home & Garden > Rugs & Carpets > Area Rugs',
      tiktok_category_id: '815504',
      tiktok_category_name: 'Carpets',
      attributes: {
        color: 'Multicolor',
        size: sizeRange,
        material: material,
        style: 'Modern',
        shape: 'Rectangle',
      },
      variants,
      product_details: '',
      product_highlights: [],
      image_prompts: [],
      status: 'draft' as const,
      created_at: new Date(),
    };

    let createdProduct = null;
    if (isConnected) {
      createdProduct = await Product.create(productData);
    }

    const imagePrompts: { type: string; positive_prompt: string; negative_prompt: string; aspect_ratio: string }[] = [];
    if (pattern_name) {
      const productImageAgent = new ProductImageAgent();
      const productImageResult = await productImageAgent.generatePrompts(pattern_name, sizes, carpet_type);
      
      if (productImageResult.success && productImageResult.prompts) {
        imagePrompts.push(...productImageResult.prompts);
      }
      
      if (imagePrompts.length > 0) {
        productData.image_prompts = imagePrompts;
        if (createdProduct) {
          createdProduct.image_prompts = imagePrompts;
          await createdProduct.save();
        }
      }
    }

    const resultProduct = createdProduct ? createdProduct.toObject() : { ...productData, _id: Date.now().toString(), id: Date.now().toString() };
    
    res.status(200).json({ success: true, data: [resultProduct], image_prompts: imagePrompts });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/check', async (req: Request, res: Response) => {
  try {
    const { product_id, category_id } = req.body;
    
    if (isConnected) {
      const product = await Product.findById(product_id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const tiktok = new TiktokService({ 
        apiKey: process.env.TIKTOK_SHOP_API_KEY || '',
        apiSecret: process.env.TIKTOK_SHOP_API_SECRET || '',
        region: process.env.TIKTOK_SHOP_REGION || 'US',
        redirectUri: process.env.TIKTOK_SHOP_REDIRECT_URI || '',
      });

      const config = await Config.findOne();
      const appToken = config?.tiktok_shop.access_token;
      const shopId = config?.tiktok_shop.shop_id || '';
      const shopCipher = config?.tiktok_shop.shop_cipher || '';
      
      if (!appToken) {
        return res.status(400).json({ success: false, error: 'Access token not found' });
      }

      const targetCategoryId = category_id || '815504';
      const mainVariant = product.variants[0];
      
      const checkResult = await tiktok.checkProductListing(
        appToken,
        {
          name: product.title_en || product.name,
          description: product.description_en || '',
          category_id: targetCategoryId,
          images: ['tos-alisg-i-aphluv4xwc-sg/be5bfd21ce5a4c78b91fcb83448dc50c'],
          price: mainVariant?.selling_price || 0,
          currency: 'USD',
          inventory: mainVariant?.inventory || 100,
          sku: product.sku,
          shop_id: shopId,
          shop_cipher: shopCipher,
        }
      );

      if (checkResult.success) {
        res.status(200).json({ success: true, data: checkResult });
      } else {
        res.status(500).json({ success: false, error: checkResult.error });
      }
    } else {
      res.status(200).json({ success: true, data: { product_id, status: 'pending' } });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/publish', async (req: Request, res: Response) => {
  let product: any = null;
  try {
    const { product_id, api_key, api_secret, access_token, region, category_id } = req.body;
    
    console.log('[Publish] Received request:', { product_id, api_key, region });
    
    if (isConnected) {
      product = await Product.findById(product_id);
      console.log('[Publish] Found product:', !!product);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      const tiktok = new TiktokService({ 
        apiKey: api_key || process.env.TIKTOK_SHOP_API_KEY || '',
        apiSecret: api_secret || process.env.TIKTOK_SHOP_API_SECRET || '',
        region: region || process.env.TIKTOK_SHOP_REGION || 'US',
        redirectUri: process.env.TIKTOK_SHOP_REDIRECT_URI || '',
      });

      const config = await Config.findOne();
      const appToken = access_token || config?.tiktok_shop.access_token;
      let sellerToken = config?.tiktok_shop.shop_cipher || '';
      let shopId = config?.tiktok_shop.shop_id || '';
      let shopCipher = config?.tiktok_shop.shop_cipher || '';
      
      if (!appToken) {
        return res.status(400).json({ success: false, error: 'Access token not found' });
      }

      console.log('[Publish] app_token:', appToken.substring(0, 10), '...');
      console.log('[Publish] seller_token:', sellerToken.substring(0, 10), '...');

      if (!shopId || !shopCipher) {
        console.log('[Publish] No shop_id or shop_cipher found, trying to get authorized shops...');
        const shopsResult = await tiktok.getAuthorizedShops(appToken);
        console.log('[Publish] Get shops result:', shopsResult);
        
        if (shopsResult.success && shopsResult.shops && shopsResult.shops.length > 0) {
          shopId = shopsResult.shops[0].shop_id;
          shopCipher = shopsResult.shops[0].shop_cipher || '';
          sellerToken = shopCipher;
          console.log('[Publish] Found shop:', shopId, 'cipher:', shopCipher ? shopCipher.substring(0, 10) + '...' : null);
          if (config) {
            config.tiktok_shop.shop_id = shopId;
            config.tiktok_shop.shop_cipher = shopCipher;
            await config.save();
          }
        }
      }
      
      console.log('[Publish] shop_cipher:', shopCipher ? shopCipher.substring(0, 10) + '...' : null);

      const publishToken = sellerToken || appToken;
      console.log('[Publish] Using publish token:', publishToken.substring(0, 10), '...');

      product.status = 'publishing';
      await product.save();
      console.log('[Publish] Product status set to publishing');

      let targetCategoryId = (product as { tiktok_category_id?: string }).tiktok_category_id || category_id || '815504';

      const images = product.generated_images || [];
      const imageUrls = images.map((img: { image_url?: string }) => img.image_url).filter(Boolean);
      
      console.log('[Publish] Found images:', imageUrls.length);
      console.log('[Publish] Image URLs:', imageUrls.slice(0, 3));
      
      const uploadedImageIds: string[] = [];
      const failedImages: string[] = [];
      
      for (let i = 0; i < Math.min(images.length, 9); i++) {
        const image = images[i];
        const useCase = i === 0 ? 'MAIN_IMAGE' : 'ATTRIBUTE_IMAGE';
        console.log('[Publish] Uploading image', i, image.local_path || image.image_url);
        
        let imageBuffer: Buffer | null = null;
        
        if (image.local_path) {
          try {
            imageBuffer = fs.readFileSync(image.local_path);
            console.log('[Publish] Read local image, size:', imageBuffer.length);
          } catch (e) {
            console.log('[Publish] Failed to read local image:', (e as Error).message);
          }
        }
        
        if (!imageBuffer) {
          try {
            console.log('[Publish] Downloading image...');
            const response = await axios.get(image.image_url, { 
              responseType: 'arraybuffer',
              headers: {
                'Referer': 'https://ai.bytedance.net/',
                'Origin': 'https://ai.bytedance.net',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              },
              timeout: 30000,
            });
            imageBuffer = Buffer.from(response.data);
            console.log('[Publish] Image downloaded, size:', imageBuffer.length);
            
            const fileName = `${product.sku}-${Date.now()}-${i}.jpg`;
            const localPath = `public/images/${fileName}`;
            fs.writeFileSync(localPath, imageBuffer);
            image.local_path = localPath;
          } catch (e) {
            console.log('[Publish] Failed to download image:', (e as Error).message);
            
            try {
              console.log('[Publish] Retrying download with different headers...');
              const response = await axios.get(image.image_url, { 
                responseType: 'arraybuffer',
                headers: {
                  'Referer': 'https://www.douyin.com/',
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                },
                timeout: 30000,
              });
              imageBuffer = Buffer.from(response.data);
              console.log('[Publish] Image downloaded on retry, size:', imageBuffer.length);
              
              const fileName = `${product.sku}-${Date.now()}-${i}.jpg`;
              const localPath = `public/images/${fileName}`;
              fs.writeFileSync(localPath, imageBuffer);
              image.local_path = localPath;
            } catch (e2) {
              console.log('[Publish] Retry failed:', (e2 as Error).message);
              failedImages.push(image.image_url);
              continue;
            }
          }
        }
        
        if (imageBuffer) {
          const uploadResult = await tiktok.uploadProductImage(appToken, imageBuffer, useCase, shopId);
          console.log('[Publish] Upload result:', uploadResult);
          if (uploadResult.success && uploadResult.img_id) {
            uploadedImageIds.push(uploadResult.img_id);
          } else {
            console.log('[Publish] Image upload failed:', uploadResult.error);
            failedImages.push(image.image_url);
          }
        } else {
          failedImages.push(image.image_url);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await product.save();

      console.log('[Publish] Uploaded image IDs:', uploadedImageIds);
      
      if (uploadedImageIds.length === 0) {
        return res.status(500).json({ success: false, error: 'Failed to upload any images' });
      }

      const variants = product.variants || [];
      
      const publishResult = await tiktok.publishProduct(
        appToken,
        {
          name: product.title_en || product.name,
          description: product.description_en || '',
          category_id: targetCategoryId,
          images: uploadedImageIds,
          price: variants[0]?.selling_price || 0,
          currency: 'USD',
          inventory: variants[0]?.inventory || 100,
          sku: product.sku,
          shop_id: shopId,
          shop_cipher: shopCipher,
          warehouse_id: config?.tiktok_shop.warehouse_id || '',
          variants: variants.map((v, index) => ({
            sku: `${product.sku}-${index + 1}`,
            size: v.size_cm || v.production_size_cm || '',
            price: v.selling_price,
            inventory: v.inventory,
          })),
        }
      );

      if (publishResult.success) {
        product.status = 'published';
        await product.save();
        res.status(200).json({ success: true, data: { ...product.toObject(), tiktok_product_id: publishResult.product_id } });
      } else {
        product.status = 'failed';
        await product.save();
        res.status(500).json({ success: false, error: publishResult.error });
      }
    } else {
      res.status(200).json({ success: true, data: { product_id, status: 'pending' } });
    }
    
  } catch (error) {
    if (product) {
      product.status = 'failed';
      await product.save().catch(() => {});
    }
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/generate-images', async (req: Request, res: Response) => {
  try {
    const { product_id, prompt_index, reference_image_url, count = 1 } = req.body;

    if (!product_id || prompt_index === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    let product;
    if (isConnected) {
      product = await Product.findById(product_id);
    }
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const imagePrompts = product.image_prompts || [];
    if (prompt_index >= imagePrompts.length) {
      return res.status(400).json({ success: false, error: 'Invalid prompt index' });
    }

    const prompt = imagePrompts[prompt_index];
    let referenceUrl = reference_image_url || product.image_url;

    if (!referenceUrl) {
      return res.status(400).json({ success: false, error: 'No reference image available' });
    }

    console.log('[Product Detail] generate-images - original referenceUrl:', referenceUrl);
    console.log('[Product Detail] generate-images - product.image_url:', product.image_url);

    if (referenceUrl.startsWith('/')) {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // 使用与静态文件配置一致的路径：../images（根目录下的images）
      // app.use('/images', express.static(path.join(__dirname, '../images')))
      const localPath = path.join(__dirname, '../..', referenceUrl);
      console.log('[Product Detail] generate-images - checking local path:', localPath);
      
      if (fs.existsSync(localPath)) {
        const config = await Config.findOne();
        const accessToken = config?.tiktok_shop.access_token;
        
        if (accessToken) {
          console.log('[Product Detail] generate-images - uploading to TikTok...');
          const tiktok = new TiktokService({
            apiKey: process.env.TIKTOK_SHOP_API_KEY || '',
            apiSecret: process.env.TIKTOK_SHOP_API_SECRET || '',
            region: config?.tiktok_shop.region || 'US',
            redirectUri: process.env.TIKTOK_SHOP_REDIRECT_URI || '',
          });
          
          const shopId = config?.tiktok_shop.shop_id;
          console.log('[Product Detail] generate-images - shop_id:', shopId);
          
          const imageBuffer = fs.readFileSync(localPath);
          const uploadResult = await tiktok.uploadProductImage(accessToken, imageBuffer, 'DESCRIPTION_IMAGE', shopId);
          
          if (uploadResult.success && uploadResult.image_url) {
            referenceUrl = uploadResult.image_url;
            console.log('[Product Detail] generate-images - uploaded to TikTok:', referenceUrl);
          } else {
            console.error('[Product Detail] generate-images - TikTok upload failed:', uploadResult.error);
            return res.status(500).json({
              success: false,
              error: 'TikTok image upload failed. Please check your TikTok Shop configuration.',
            });
          }
        } else {
          console.error('[Product Detail] generate-images - no TikTok access token configured');
          return res.status(500).json({
            success: false,
            error: 'TikTok access token not configured. Please configure TikTok Shop API credentials in the settings to enable image-to-image generation.',
          });
        }
      } else {
        console.error('[Product Detail] generate-images - local file not found:', localPath);
        return res.status(500).json({
          success: false,
          error: 'Reference image not found. Please ensure the pattern image exists and try again.',
        });
      }
    }

    const jimeng = new JimengService({
      apiKey: process.env.JIMENG_API_KEY || '',
      apiSecret: process.env.JIMENG_API_SECRET || '',
    });

    const aspectRatio = prompt.aspect_ratio || '1:1';
    
    const generatedUrls: string[] = [];

    for (let i = 0; i < count; i++) {
      if (prompt.type === '防滑底背翻折细节图') {
        const fs = await import('fs');
        const samplePath = 'D:\\tk工具\\shiyitu\\细节卖点图5.jpg';
        if (fs.existsSync(samplePath)) {
          const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
          const url = `${baseUrl}/images/sample-details.jpg`;
          generatedUrls.push(url);
          console.log('[Product Detail] generate-images - using sample image for 防滑底背翻折细节图');
          continue;
        }
      }
      
      if (prompt.type === '高密度防滑创意宣传图') {
        const fs = await import('fs');
        const path = await import('path');
        const samplePath = 'D:\\tk工具\\shiyitu\\细节卖点图.jpeg';
        if (fs.existsSync(samplePath)) {
          // 直接使用用户提供的图片，不调用AI生成
          const fileName = `${product.sku}-${prompt.type}-${Date.now()}.jpg`;
          const localPath = path.join(__dirname, '../../public/images', fileName);
          
          // 复制图片到 public/images 目录
          const imageBuffer = fs.readFileSync(samplePath);
          fs.writeFileSync(localPath, imageBuffer);
          
          // 生成可访问的URL
          const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
          const url = `${baseUrl}/images/${fileName}`;
          generatedUrls.push(url);
          console.log('[Product Detail] generate-images - using direct image for 高密度防滑创意宣传图:', url);
          continue;
        }
      }
      
      let basePrompt = prompt.positive_prompt;
      
      if (prompt.type === '多尺寸规格对比白底图') {
        const sizeInfo = product.variants?.map(v => {
          const prodSize = v.production_size_cm || v.size_cm;
          if (!prodSize) return null;
          const [w, h] = prodSize.replace('*', 'x').split('x').map(Number);
          const wIn = (w / 2.54).toFixed(1);
          const hIn = (h / 2.54).toFixed(1);
          return { cm: prodSize, inch: `${wIn}x${hIn}` };
        }).filter(Boolean);
        
        const sizeCount = sizeInfo.length;
        const sizeDescriptions = sizeInfo.map(s => `${s.cm}cm (${s.inch}in)`).join(', ');
        
        basePrompt = `Pure white minimalist background, ${sizeCount} rectangular carpets of different sizes neatly arranged in grid, sizes: ${sizeDescriptions}, all carpets show identical pattern from reference image, each carpet has dual unit measuring scale on left and bottom edges, centimeter (cm) labels above, inch (in) labels below, size numbers clear and legible, top-down flat lay no perspective distortion, pattern proportionally scaled to each size ensuring pattern integrity, no furniture no scene, professional e-commerce specification image, high resolution`;
        
        console.log('[Product Detail] generate-images - size comparison prompt with actual sizes:', sizeInfo);
      }
      
      const coreInstruction = `Copy reference image pattern exactly, keep pattern unchanged, `;
      const suffix = `, high quality product photo, variation ${i + 1}`;
      
      const maxContentLength = 700 - coreInstruction.length - suffix.length;
      if (basePrompt.length > maxContentLength) {
        basePrompt = basePrompt.substring(0, maxContentLength);
        console.log('[Product Detail] generate-images - prompt truncated to fit within 700 chars');
      }
      
      const enhancedPrompt = `${coreInstruction}${basePrompt}${suffix}`;

      let result = await jimeng.generateImageWithReference(
        enhancedPrompt,
        referenceUrl,
        10,
        aspectRatio
      );

      if (!result.success) {
        console.log(`I2I failed for image ${i + 1}:`, result.error);
        
        if (result.error?.includes('prompt can not be more than')) {
          const shortenedPrompt = `Follow reference pattern. ${basePrompt.substring(0, 500)}, high quality`;
          console.log('[Product Detail] Retrying I2I with shortened prompt');
          result = await jimeng.generateImageWithReference(
            shortenedPrompt,
            referenceUrl,
            10,
            aspectRatio
          );
        }
      }

      if (result.success && result.imageUrls && result.imageUrls.length > 0) {
        generatedUrls.push(result.imageUrls[0]);
      }
    }

    if (generatedUrls.length > 0) {
      if (isConnected) {
        if (!product.generated_images) {
          product.generated_images = [];
        }
        
        for (const url of generatedUrls) {
          let localPath: string | undefined;
          try {
            if (url.includes('/images/sample-details.jpg')) {
              const samplePath = 'D:\\tk工具\\shiyitu\\细节卖点图5.jpg';
              const fileName = `${product.sku}-${prompt.type}-${Date.now()}.jpg`;
              localPath = `public/images/${fileName}`;
              const imageBuffer = fs.readFileSync(samplePath);
              fs.writeFileSync(localPath, imageBuffer);
              console.log('[Product Detail] Sample details image saved locally:', localPath);
            } else if (url.includes('高密度防滑创意宣传图')) {
              // 高密度防滑创意宣传图已经在前面处理并保存，这里跳过重复保存
              console.log('[Product Detail] 高密度防滑创意宣传图 already saved, skipping');
              continue;
            } else {
              const response = await axios.get(url, { responseType: 'arraybuffer' });
              const fileName = `${product.sku}-${prompt.type}-${Date.now()}.jpg`;
              localPath = `public/images/${fileName}`;
              fs.writeFileSync(localPath, response.data);
              console.log('[Product Detail] Generated image saved locally:', localPath);
            }
          } catch (e) {
            console.log('[Product Detail] Failed to save image locally:', e);
          }
          
          product.generated_images.push({
            prompt_index,
            prompt_type: prompt.type,
            image_url: url,
            local_path: localPath,
            generated_at: new Date(),
          });
        }
        await product.save();
      }

      res.status(200).json({
        success: true,
        image_urls: generatedUrls,
        image_url: generatedUrls[0],
        prompt_type: prompt.type,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to generate images',
      });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/generate-description', async (req: Request, res: Response) => {
  try {
    const { title, material, variants, generated_images, image_prompts } = req.body;

    if (!title || !material) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const sizeList = variants?.map((v: { size_cm?: string }) => v.size_cm).join(', ') || '多种尺寸';
    
    const imageTypes: string[] = [];
    if (generated_images && generated_images.length > 0) {
      const types = new Set<string>(generated_images.map((img: { prompt_type?: string }) => img.prompt_type));
      imageTypes.push(...Array.from(types));
    }

    const imagePromptsSummary = image_prompts?.map((p: { type?: string }) => p.type).join(', ') || '';

    const systemPrompt = `你是专业跨境家居电商文案写作智能体。请根据产品信息生成适用于TikTok Shop平台的英文商品详情描述。

要求：
1. 语言：英文
2. 格式：使用HTML标签进行格式化，包含标题、段落、列表等
3. 内容：包含产品介绍、材质说明、尺寸信息、产品特点、适用场景等
4. 风格：专业、吸引人、符合电商平台规范
5. 长度：中等长度，约300-500词
6. 必须返回严格的JSON格式，包含description（HTML格式字符串）、highlights（字符串数组，3-5个要点）、details（字符串）三个字段`;

    const userPrompt = `产品标题：${title}
材质：${material}
尺寸：${sizeList}
已生成图片类型：${imageTypes.length > 0 ? imageTypes.join(', ') : '无'}
图片提示词类型：${imagePromptsSummary}

请返回JSON格式：
{
  "description": "<p>HTML格式的产品描述</p>",
  "highlights": ["要点1", "要点2", "要点3"],
  "details": "更详细的产品信息"
}`;

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
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
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ''}`,
        },
      }
    );

    const content = response.data.choices[0].message.content;
    console.log('DeepSeek response for description:', content.substring(0, 500));

    let result: { description: string; highlights: string[]; details: string } = { description: '', highlights: [], details: '' };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = {
          description: parsed.description || '',
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
          details: parsed.details || '',
        };
      } else {
        result.description = content;
      }
    } catch (e) {
      console.error('Failed to parse description response:', e);
      result.description = content;
    }

    res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(404).json({ success: false, error: 'Database not connected' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    const productData = product.toObject();
    productData.id = productData._id?.toString() || '';
    res.status(200).json({ success: true, data: productData });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!isConnected) {
      return res.status(404).json({ success: false, error: 'Database not connected' });
    }
    
    const { 
      name, 
      title_en, 
      description_en, 
      variants,
      product_details,
      product_highlights,
      image_prompts,
      generated_images,
      status,
      tiktok_category_id,
      tiktok_category_name
    } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    if (name !== undefined) product.name = name;
    if (title_en !== undefined) product.title_en = title_en;
    if (description_en !== undefined) product.description_en = description_en;
    if (variants !== undefined) product.variants = variants;
    if (product_details !== undefined) product.product_details = product_details;
    if (product_highlights !== undefined) product.product_highlights = product_highlights;
    if (image_prompts !== undefined) product.image_prompts = image_prompts;
    if (generated_images !== undefined) product.generated_images = generated_images;
    if (status !== undefined) product.status = status;
    if (tiktok_category_id !== undefined) product.tiktok_category_id = tiktok_category_id;
    if (tiktok_category_name !== undefined) product.tiktok_category_name = tiktok_category_name;
    
    await product.save();
    
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    if (isConnected) {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      product.status = 'pending';
      await product.save();

      res.status(200).json({ success: true, data: product });
    } else {
      res.status(200).json({ success: true, data: { _id: req.params.id, status: 'pending' } });
    }
    
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function generateTikTokTitle(patternName: string): string {
  return `${patternName} Velvet Area Rug Multiple Sizes Available - Soft Washable Polyester Floor Mat for Living Room Bedroom Home Decor Non-Slip`;
}

function generateTikTokDescription(patternName: string, sizes: string[], material: string): string {
  const sizeList = sizes.map(size => {
    const [width, length] = size.split('x').map(s => s.replace('cm', ''));
    return `${size}cm (${Math.round(parseFloat(width)/2.54)}" x ${Math.round(parseFloat(length)/2.54)}")`;
  }).join(', ');

  return `<p>Elevate your home decor with this stunning ${patternName} velvet area rug! Made from premium 850g/sqm washable polyester velvet, this rug features a luxurious soft texture and vibrant digital printing that won't fade.</p>
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

export default router;