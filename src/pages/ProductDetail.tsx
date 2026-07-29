import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import { 
  ArrowLeft, 
  Save, 
  Edit3, 
  Copy, 
  Check,
  Plus,
  Trash2,
  Tag,
  Package,
  Weight,
  Ruler,
  Sparkles,
  FileText,
  Star,
  Image,
  Calculator,
  Loader2,
  Upload,
  ChevronDown,
  ChevronUp,
  Search,
  FolderTree
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Product, ProductVariant, PriceBreakdown } from '../types';

interface ImagePrompt {
  type: string;
  positive_prompt: string;
  negative_prompt: string;
  aspect_ratio: string;
}

interface TiktokCategory {
  category_id: string;
  name: string;
  parent_id: string;
  is_leaf: boolean;
}

interface ProductDetailProps {
  productId: string;
  onBack: () => void;
}

export default function ProductDetail({ productId, onBack }: ProductDetailProps) {
  const { products, editProduct } = useAppStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [highlights, setHighlights] = useState<string[]>([]);
  const [newHighlight, setNewHighlight] = useState('');
  
  const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState<Set<number>>(new Set());
  const [generatedImages, setGeneratedImages] = useState<Record<number, string[]>>({});
  const [generatingDescription, setGeneratingDescription] = useState(false);
  
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);

  // TikTok类目选择相关状态
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [allCategories, setAllCategories] = useState<TiktokCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<TiktokCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    const parseGeneratedImages = (images: any[] | undefined): Record<number, string[]> => {
      if (!images) return {};
      const savedImages: Record<number, string[]> = {};
      images.forEach((img: any) => {
        if (!savedImages[img.prompt_index]) {
          savedImages[img.prompt_index] = [];
        }
        savedImages[img.prompt_index].push(img.image_url);
      });
      return savedImages;
    };

    const fetchProduct = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/${productId}`);
        const data = await response.json();
        if (data.success && data.data) {
          setProduct(data.data);
          setHighlights(data.data.product_highlights || []);
          setImagePrompts(data.data.image_prompts || []);
          setGeneratedImages(parseGeneratedImages(data.data.generated_images));
        } else {
          const localProduct = products.find(p => p.id === productId || p._id === productId);
          if (localProduct) {
            setProduct(localProduct);
            setHighlights(localProduct.product_highlights || []);
            setImagePrompts(localProduct.image_prompts || []);
            setGeneratedImages(parseGeneratedImages(localProduct.generated_images));
          }
        }
      } catch (error) {
        const localProduct = products.find(p => p.id === productId || p._id === productId);
        if (localProduct) {
          setProduct(localProduct);
          setHighlights(localProduct.product_highlights || []);
          setImagePrompts(localProduct.image_prompts || []);
          setGeneratedImages(parseGeneratedImages(localProduct.generated_images));
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId, products]);

  const handleSave = async () => {
    if (!product) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product._id || product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name,
          title_en: product.title_en,
          description_en: product.description_en,
          variants: product.variants,
          product_details: product.product_details,
          product_highlights: highlights,
          image_prompts: imagePrompts,
          status: product.status,
          tiktok_category_id: product.tiktok_category_id || '',
          tiktok_category_name: product.tiktok_category_name || '',
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        editProduct(product._id || product.id, data.data);
      }
    } catch (error) {
      console.error('Failed to save product:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldEdit = (field: string, value: string | number | PriceBreakdown) => {
    if (!product) return;
    setProduct({ ...product, [field]: value });
    setEditingField(null);
    setEditValue('');
  };

  const updateVariantField = (variantIndex: number, field: string, value: string | number) => {
    if (!product) return;
    const newVariants = [...product.variants];
    newVariants[variantIndex] = { ...newVariants[variantIndex], [field]: value };
    setProduct({ ...product, variants: newVariants });
  };

  const updateVariantPriceBreakdown = (variantIndex: number, field: string, value: number) => {
    if (!product) return;
    const newVariants = [...product.variants];
    newVariants[variantIndex] = { 
      ...newVariants[variantIndex], 
      price_breakdown: { ...newVariants[variantIndex].price_breakdown, [field]: value } 
    };
    setProduct({ ...product, variants: newVariants });
  };

  const addHighlight = () => {
    if (newHighlight.trim()) {
      setHighlights([...highlights, newHighlight.trim()]);
      setNewHighlight('');
    }
  };

  const removeHighlight = (index: number) => {
    setHighlights(highlights.filter((_, i) => i !== index));
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(type);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  const generateImage = async (promptIndex: number) => {
    if (!product) return;
    
    setGeneratingImages(new Set([...generatingImages, promptIndex]));
    
    try {
      const count = promptIndex === 0 ? 3 : 1;
      const response = await fetch('/api/products/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product._id || product.id,
          prompt_index: promptIndex,
          reference_image_url: product.image_url,
          count,
        }),
      });
      
      const data = await response.json();
      if (data.success && data.image_urls) {
        setGeneratedImages({ ...generatedImages, [promptIndex]: data.image_urls });
        const updatedGeneratedImages = [...(product.generated_images || [])];
        data.image_urls.forEach((url: string) => {
          updatedGeneratedImages.push({
            prompt_index: promptIndex,
            prompt_type: imagePrompts[promptIndex]?.type || '',
            image_url: url,
            generated_at: new Date().toISOString(),
          });
        });
        setProduct({ ...product, generated_images: updatedGeneratedImages });
      } else {
        alert(data.error || '生成图片失败');
      }
    } catch (error) {
      alert('生成图片失败: ' + (error as Error).message);
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptIndex);
        return newSet;
      });
    }
  };

  const handleSubmitForPublish = async () => {
    if (!product) return;
    
    try {
      const response = await fetch(`/api/products/${product._id || product.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      if (data.success) {
        setProduct({ ...product, status: 'pending' });
        alert('产品已提交到发布队列，可在发布中心查看');
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      alert('提交失败: ' + (error as Error).message);
    }
  };

  const generateDescription = async () => {
    if (!product) return;

    setGeneratingDescription(true);

    try {
      const response = await fetch('/api/products/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product._id || product.id,
          title: product.title_en,
          material: product.material,
          variants: product.variants,
          generated_images: product.generated_images || [],
          image_prompts: imagePrompts,
        }),
      });

      const data = await response.json();
      if (data.success) {
        if (data.description) {
          setProduct(prev => prev ? { ...prev, description_en: data.description } : prev);
          setEditingField(null);
        }
        if (Array.isArray(data.highlights) && data.highlights.length > 0) {
          setHighlights(data.highlights);
        }
        if (data.details) {
          setProduct(prev => prev ? { ...prev, product_details: data.details } : prev);
        }
      } else {
        alert(data.error || '生成详情失败');
      }
    } catch (error) {
      alert('生成详情失败: ' + (error as Error).message);
    } finally {
      setGeneratingDescription(false);
    }
  };

  // 拉取TikTok类目列表
  const fetchCategories = async () => {
    if (loadingCategories) return;
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/tiktok/categories');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        // 仅保留叶子类目，便于发布时使用
        const leafCategories = data.data.filter((c: TiktokCategory) => c.is_leaf);
        setAllCategories(leafCategories);
        setFilteredCategories(leafCategories.slice(0, 100));
      } else {
        setAllCategories([]);
        setFilteredCategories([]);
      }
    } catch (error) {
      console.error('拉取类目失败:', error);
      alert('拉取TikTok类目失败，请确认已授权TikTok Shop');
      setAllCategories([]);
      setFilteredCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  // 类目搜索过滤
  const handleCategorySearch = (keyword: string) => {
    setCategorySearch(keyword);
    if (!keyword.trim()) {
      setFilteredCategories(allCategories.slice(0, 100));
      return;
    }
    const lower = keyword.toLowerCase();
    const filtered = allCategories.filter(
      c => c.name.toLowerCase().includes(lower) || c.category_id.includes(lower)
    );
    setFilteredCategories(filtered.slice(0, 100));
  };

  // 选中类目
  const handleSelectCategory = (category: TiktokCategory) => {
    if (!product) return;
    setProduct({
      ...product,
      tiktok_category_id: category.category_id,
      tiktok_category_name: category.name,
    });
    setShowCategorySelector(false);
    setCategorySearch('');
  };

  // 打开类目选择器
  const openCategorySelector = () => {
    setShowCategorySelector(true);
    if (allCategories.length === 0) {
      fetchCategories();
    } else {
      setFilteredCategories(allCategories.slice(0, 100));
    }
  };

  // 下载图片
  const handleDownloadImage = async (url: string, fileName: string) => {
    try {
      const proxyUrl = `/api/image/proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('下载图片失败:', error);
      alert('下载图片失败: ' + (error as Error).message);
    }
  };

  if (loading) {
    return (
      <Layout title="产品详情" subtitle="加载中...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout title="产品详情" subtitle="产品不存在">
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Package className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">产品未找到</p>
          <button
            onClick={onBack}
            className="mt-4 px-6 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
          >
            返回产品列表
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={product.name} subtitle={`SKU: ${product.sku}`}>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              保存修改
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Image className="w-5 h-5 text-primary-500" />
              产品图片
            </h3>
            <div className="flex gap-4">
              <img
                src={product.image_url}
                alt={product.name}
                className="w-32 h-32 rounded-xl object-cover border border-gray-200"
              />
              <div className="flex-1 space-y-2">
                {(product.images || []).slice(1).map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`${product.name} ${index + 1}`}
                    className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-500" />
              产品基本信息
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">产品名称</span>
                {editingField === 'name' ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFieldEdit('name', editValue)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFieldEdit('name', editValue)}
                    className="flex-1 ml-4 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{product.name}</span>
                    <button
                      onClick={() => { setEditingField('name'); setEditValue(product.name); }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">TikTok标题</span>
                {editingField === 'title_en' ? (
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFieldEdit('title_en', editValue)}
                    className="flex-1 ml-4 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={2}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-2 ml-4">
                    <span className="font-medium text-gray-800 text-sm">{product.title_en}</span>
                    <button
                      onClick={() => { setEditingField('title_en'); setEditValue(product.title_en); }}
                      className="p-1 hover:bg-gray-100 rounded transition-colors mt-0.5"
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">产品类型</span>
                <span className="font-medium text-gray-800">{product.carpet_type || '-'}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">材质</span>
                <span className="font-medium text-gray-800">{product.material}</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">图案</span>
                <span className="font-medium text-gray-800">{product.pattern_name}</span>
              </div>

              <div className="py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5" />
                    TikTok类目
                  </span>
                  <div className="flex items-center gap-2">
                    {product.tiktok_category_id ? (
                      <>
                        <span className="font-medium text-gray-800 text-sm">
                          {product.tiktok_category_name || product.tiktok_category_id}
                        </span>
                        <span className="text-xs text-gray-400">({product.tiktok_category_id})</span>
                        <button
                          onClick={openCategorySelector}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="更换类目"
                        >
                          <Edit3 className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={openCategorySelector}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <FolderTree className="w-3.5 h-3.5" />
                        选择TikTok类目
                      </button>
                    )}
                  </div>
                </div>

                {showCategorySelector && (
                  <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <div className="p-3 bg-white border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={categorySearch}
                            onChange={(e) => handleCategorySearch(e.target.value)}
                            placeholder="搜索类目名称或ID..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => {
                            setShowCategorySelector(false);
                            setCategorySearch('');
                          }}
                          className="px-3 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          取消
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>仅显示叶子类目（可直接用于发布）</span>
                        <button
                          onClick={fetchCategories}
                          disabled={loadingCategories}
                          className="text-primary-600 hover:underline disabled:opacity-50"
                        >
                          {loadingCategories ? '加载中...' : '重新加载'}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {loadingCategories ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                          <span className="ml-2 text-sm text-gray-500">加载类目中...</span>
                        </div>
                      ) : filteredCategories.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                          {allCategories.length === 0 ? '暂无类目数据，请确认已授权' : '未找到匹配的类目'}
                        </div>
                      ) : (
                        filteredCategories.map((category) => (
                          <button
                            key={category.category_id}
                            onClick={() => handleSelectCategory(category)}
                            className={`w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-primary-50 transition-colors border-b border-gray-100 ${
                              product.tiktok_category_id === category.category_id ? 'bg-primary-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FolderTree className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{category.name}</span>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">{category.category_id}</span>
                          </button>
                        ))
                      )}
                    </div>
                    {!loadingCategories && filteredCategories.length > 0 && (
                      <div className="px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
                        显示 {filteredCategories.length} / {allCategories.length} 个叶子类目
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-500">状态</span>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    product.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                    product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    product.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {product.status === 'draft' ? '草稿' : 
                     product.status === 'pending' ? '待发布' : 
                     product.status === 'failed' ? '发布失败' : '已发布'}
                  </span>
                  {(product.status === 'draft' || product.status === 'failed') && (
                    <button
                      onClick={handleSubmitForPublish}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      {product.status === 'failed' ? '重新发布' : '提交发布'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary-500" />
              规格与价格
            </h3>
            <div className="space-y-3">
              {(product.variants || []).map((variant, index) => (
                <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedVariant(expandedVariant === index ? null : index)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-gray-800">{variant.size_cm}cm</span>
                      <span className="text-sm text-gray-500">成本价: ¥{variant.cost_price}</span>
                      <span className="font-semibold text-primary-600">售价: ¥{variant.selling_price}</span>
                    </div>
                    {expandedVariant === index ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {expandedVariant === index && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">生产尺寸</label>
                          <span className="text-sm text-gray-700">{variant.production_size_cm}cm</span>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">库存</label>
                          <input
                            type="number"
                            value={variant.inventory}
                            onChange={(e) => updateVariantField(index, 'inventory', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">成本价</label>
                          <input
                            type="number"
                            value={variant.cost_price}
                            onChange={(e) => updateVariantField(index, 'cost_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">售价</label>
                          <input
                            type="number"
                            value={variant.selling_price}
                            onChange={(e) => updateVariantField(index, 'selling_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">价格构成</h4>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">成本</span>
                            <span className="text-gray-700">¥{variant.price_breakdown.cost}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">运费</span>
                            <span className="text-gray-700">¥{variant.price_breakdown.shipping}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">佣金</span>
                            <span className="text-gray-700">¥{variant.price_breakdown.commission}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">包装</span>
                            <span className="text-gray-700">¥{variant.price_breakdown.packaging}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">税费</span>
                            <span className="text-gray-700">¥{variant.price_breakdown.tax}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">利润</span>
                            <span className="text-green-600">¥{variant.price_breakdown.profit}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">包装信息（不可修改）</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <Weight className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">包裹重量: {variant.packaging_weight} kg</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">包裹尺寸: {variant.packaging_size} cm</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" />
                商品详情
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateDescription}
                  disabled={generatingDescription}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingDescription ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AI生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      AI一键生成详情
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setEditingField('description_en'); setEditValue(product.description_en || ''); }}
                  className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </h3>
            {editingField === 'description_en' ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleFieldEdit('description_en', editValue)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                rows={6}
                placeholder="输入商品详情..."
                autoFocus
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap min-h-[100px]">
                {product.description_en || '暂无详情'}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary-500" />
              商品亮点
            </h3>
            <div className="space-y-3">
              {highlights.length === 0 ? (
                <p className="text-sm text-gray-400">暂无亮点，请添加</p>
              ) : (
                highlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700">{highlight}</span>
                    <button
                      onClick={() => removeHighlight(index)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHighlight()}
                  placeholder="添加新亮点..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={addHighlight}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  添加
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" />
              图片提示词
            </h3>
            <div className="space-y-4">
              {(() => {
                const filteredPrompts = imagePrompts
                  .map((p, idx) => ({ prompt: p, originalIndex: idx }))
                  .filter(item => item.prompt.type !== '高清印花原图');
                
                return filteredPrompts.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无图片提示词</p>
                ) : (
                  filteredPrompts.map(({ prompt, originalIndex }) => (
                    <div key={originalIndex} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{prompt.type}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{prompt.aspect_ratio}</span>
                          <button
                            onClick={() => generateImage(originalIndex)}
                            disabled={generatingImages.has(originalIndex)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingImages.has(originalIndex) ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                生成中...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3" />
                                生成图片
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        {generatedImages[originalIndex] && generatedImages[originalIndex].length > 0 && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between">
                              <span className="text-xs text-gray-500">生成结果 ({generatedImages[originalIndex].length}张)</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
                              {generatedImages[originalIndex].map((imgUrl, imgIndex) => (
                                <div key={imgIndex} className="relative group">
                                  <img
                                    src={imgUrl}
                                    alt={`Generated ${prompt.type} ${imgIndex + 1}`}
                                    className="w-full h-auto max-h-48 object-contain"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => window.open(imgUrl, '_blank')}
                                      className="px-3 py-1.5 text-white text-xs font-medium bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                                    >
                                      查看大图
                                    </button>
                                    <button
                                      onClick={() => handleDownloadImage(imgUrl, `${product.name}-${prompt.type}-${imgIndex + 1}`)}
                                      className="px-3 py-1.5 text-white text-xs font-medium bg-primary-600 rounded-lg hover:bg-primary-500 transition-colors"
                                    >
                                      下载原图
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">正向Prompt</label>
                          <textarea
                            value={prompt.positive_prompt}
                            onChange={(e) => {
                              const newPrompts = [...imagePrompts];
                              newPrompts[originalIndex].positive_prompt = e.target.value;
                              setImagePrompts(newPrompts);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">反向Prompt</label>
                          <textarea
                            value={prompt.negative_prompt}
                            onChange={(e) => {
                              const newPrompts = [...imagePrompts];
                              newPrompts[originalIndex].negative_prompt = e.target.value;
                              setImagePrompts(newPrompts);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                            rows={2}
                          />
                        </div>
                        <button
                          onClick={() => copyToClipboard(prompt.positive_prompt, `${prompt.type}-positive`)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          {copiedPrompt === `${prompt.type}-positive` ? (
                            <>
                              <Check className="w-4 h-4 text-green-500" />
                              已复制正向Prompt
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              复制正向Prompt
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )})()}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">产品属性</h3>
            <div className="space-y-3">
              {Object.entries(product.attributes || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500 capitalize">{key}</span>
                  <span className="text-sm text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">规格概览</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">规格数量</span>
                <span className="font-medium text-gray-800">{product.variants?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">最小成本</span>
                <span className="font-medium text-gray-800">¥{product.variants?.reduce((min, v) => Math.min(min, v.cost_price), Infinity)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">最大成本</span>
                <span className="font-medium text-gray-800">¥{product.variants?.reduce((max, v) => Math.max(max, v.cost_price), 0)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">最小售价</span>
                <span className="font-medium text-primary-600">¥{product.variants?.reduce((min, v) => Math.min(min, v.selling_price), Infinity)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">最大售价</span>
                <span className="font-medium text-primary-600">¥{product.variants?.reduce((max, v) => Math.max(max, v.selling_price), 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
