import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import {
  Package,
  Plus,
  Trash2,
  Eye,
  Upload,
  Edit3,
  Calculator,
  Loader2,
  X,
  Tag,
  Calendar,
  CheckCircle,
  ChevronDown,
  Sparkles,
  Image,
  Copy,
  Check,
  FolderTree
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Product, Pattern } from '../types';

interface CarpetType {
  name: string;
  sizes: { size_cm: string; production_size_cm: string; cost_price: number; weight_g: number }[];
}

interface ImagePrompt {
  type: string;
  positive_prompt: string;
  negative_prompt: string;
  aspect_ratio: string;
}

interface ProductManagerProps {
  onProductSelect?: (productId: string) => void;
}

export default function ProductManager({ onProductSelect }: ProductManagerProps) {
  const { products, patterns, config, addProduct, removeProduct, setProducts } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedCarpetType, setSelectedCarpetType] = useState<string>('');
  const [carpetTypes, setCarpetTypes] = useState<CarpetType[]>([]);
  const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>([]);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchCarpetTypes();
  }, []);

  const fetchCarpetTypes = async () => {
    try {
      const response = await fetch('/api/products/carpet-types');
      const data = await response.json();
      if (data.success && data.data) {
        setCarpetTypes(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch carpet types:', error);
    }
  };

  const handleCreateProducts = async () => {
    if (!selectedPattern || selectedSizes.length === 0) {
      return;
    }

    const pattern = patterns.find((p) => p.id === selectedPattern || p._id === selectedPattern);
    if (!pattern) return;

    setCreating(true);
    try {
      const response = await fetch('/api/products/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pattern_id: pattern._id || pattern.id,
          pattern_name: pattern.name,
          pattern_theme: pattern.theme || '',
          pattern_colors: pattern.colors || [],
          sizes: selectedSizes,
          image_urls: pattern.image_urls,
          price_settings: config.price_settings,
          carpet_type: selectedCarpetType,
          pattern_description: pattern.design思路 || '',
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        data.data.forEach((p: Product) => addProduct(p));
        
        if (data.image_prompts && data.image_prompts.length > 0) {
          setImagePrompts(data.image_prompts);
          setShowPromptsModal(true);
        }
        
        setShowModal(false);
        setSelectedPattern('');
        setSelectedSizes([]);
        setSelectedCarpetType('');
        
        if (data.data.length > 0 && onProductSelect) {
          const firstProduct = data.data[0];
          onProductSelect(firstProduct._id || firstProduct.id);
        }
      } else {
        alert(data.error || '创建产品失败');
      }
    } catch (error) {
      alert('创建产品失败: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveProduct = async (id: string) => {
    if (confirm('确定要删除这个产品吗？')) {
      try {
        const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          removeProduct(id);
          const productsRes = await fetch('/api/products');
          const productsData = await productsRes.json();
          if (productsData.success && productsData.data) {
            setProducts(productsData.data);
          }
        } else {
          alert('删除产品失败: ' + (data.error || '未知错误'));
        }
      } catch (error) {
        console.error('删除产品失败:', error);
        alert('删除产品失败，请重试');
      }
    }
  };

  const handlePublishProduct = (product: Product) => {
    const updatedProducts = products.map((p) =>
      p.id === product.id || p._id === product.id ? { ...p, status: 'pending' as const } : p
    );
    setProducts(updatedProducts);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return { text: '已发布', class: 'bg-green-100 text-green-800' };
      case 'pending':
        return { text: '待发布', class: 'bg-yellow-100 text-yellow-800' };
      default:
        return { text: '草稿', class: 'bg-gray-100 text-gray-800' };
    }
  };

  const handleCopyPrompt = (prompt: string, type: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(type);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const currentCarpetTypeSizes = carpetTypes.find(t => t.name === selectedCarpetType)?.sizes || [];

  return (
    <Layout title="产品管理" subtitle="管理产品列表和价格计算">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowModal(true)}
            disabled={patterns.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            创建产品
          </button>
          {patterns.length === 0 && (
            <span className="text-sm text-gray-400">请先在图案工作室创建图案</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            共 {products.length} 个产品
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">产品图片</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">产品信息</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">尺寸</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">类型</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">材质</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">TikTok类目</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">规格数量</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">售价范围</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">状态</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.length > 0 ? (
                products.map((product) => {
                  const status = getStatusBadge(product.status);
                  const prod = product as Product & { _id?: string; carpet_type?: string; variants?: any[] };
                  const sizes = prod.variants?.map(v => v.size_cm).join(', ') || '';
                  const minPrice = prod.variants?.reduce((min, v) => Math.min(min, v.selling_price), Infinity);
                  const maxPrice = prod.variants?.reduce((max, v) => Math.max(max, v.selling_price), 0);
                  return (
                    <tr key={prod._id || prod.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-xs text-gray-400">{product.sku}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm max-w-[150px] truncate" title={sizes}>{sizes}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{prod.carpet_type || '-'}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{product.material}</td>
                      <td className="py-3 px-4 text-sm">
                        {product.tiktok_category_id ? (
                          <div className="flex items-center gap-1.5 max-w-[180px]">
                            <FolderTree className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-700 truncate" title={product.tiktok_category_name}>
                                {product.tiktok_category_name || '-'}
                              </p>
                              <p className="text-xs text-gray-400 font-mono truncate" title={product.tiktok_category_id}>
                                {product.tiktok_category_id}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">未设置</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{prod.variants?.length || 0}</td>
                      <td className="py-3 px-4 font-semibold text-accent-600">${minPrice?.toFixed(2)} - ${maxPrice?.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.class}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onProductSelect?.(prod._id || prod.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handlePublishProduct(product)}
                            disabled={product.status === 'published'}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleRemoveProduct(prod._id || prod.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-600 mb-2">暂无产品</h3>
                    <p className="text-gray-400 mb-4">点击上方按钮创建产品</p>
                    <button
                      onClick={() => setShowModal(true)}
                      disabled={patterns.length === 0}
                      className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50"
                    >
                      创建产品
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" />
                创建产品
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择图案
                </label>
                <select
                  value={selectedPattern}
                  onChange={(e) => {
                    setSelectedPattern(e.target.value);
                    setSelectedSizes([]);
                    setSelectedCarpetType('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">请选择图案</option>
                  {patterns.map((pattern) => (
                    <option key={pattern.id || pattern._id} value={pattern._id || pattern.id}>
                      {pattern.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPattern && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择产品类型
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCarpetType}
                        onChange={(e) => {
                          setSelectedCarpetType(e.target.value);
                          setSelectedSizes([]);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
                      >
                        <option value="">请选择产品类型</option>
                        {carpetTypes.map((type) => (
                          <option key={type.name} value={type.name}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      选择尺寸
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {currentCarpetTypeSizes.length > 0 ? (
                        currentCarpetTypeSizes.map((item) => (
                          <button
                            key={item.size_cm}
                            onClick={() => {
                              const isSelected = selectedSizes.includes(item.size_cm);
                              setSelectedSizes(
                                isSelected
                                  ? selectedSizes.filter((s) => s !== item.size_cm)
                                  : [...selectedSizes, item.size_cm]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selectedSizes.includes(item.size_cm)
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {item.size_cm}cm ¥{item.cost_price}
                          </button>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">请先选择产品类型</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">价格计算预览</span>
                    </div>
                    <div className="space-y-1 text-xs text-blue-600">
                      <p>运费: ${config.price_settings.shipping_fee}</p>
                      <p>平台佣金: {config.price_settings.platform_commission_rate * 100}%</p>
                      <p>包装费: ${config.price_settings.packaging_fee}</p>
                      <p>税率: {config.price_settings.tax_rate * 100}%</p>
                      <p>利润率: {config.price_settings.profit_rate * 100}%</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateProducts}
                disabled={creating || !selectedPattern || selectedSizes.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    创建产品
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">{previewProduct.name}</h3>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <img
                    src={previewProduct.image_url}
                    alt={previewProduct.name}
                    className="w-full aspect-square rounded-xl object-cover"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">SKU</p>
                    <p className="font-medium text-gray-800">{previewProduct.sku}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">尺寸</p>
                    <p className="font-medium text-gray-800">{(previewProduct as any).variants?.map(v => v.size_cm).join(', ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">类型</p>
                    <p className="font-medium text-gray-800">{(previewProduct as Product & { carpet_type?: string }).carpet_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">材质</p>
                    <p className="font-medium text-gray-800">{previewProduct.material}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">图案</p>
                    <p className="font-medium text-gray-800">{previewProduct.pattern_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">状态</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getStatusBadge(previewProduct.status).class
                    }`}>
                      {getStatusBadge(previewProduct.status).text}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-gray-500" />
                  价格明细（首个规格）
                </h4>
                {(() => {
                  const firstVariant = (previewProduct as any).variants?.[0];
                  if (!firstVariant) return null;
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">成本价</p>
                        <p className="font-semibold text-gray-800">¥{firstVariant.cost_price}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">运费</p>
                        <p className="font-semibold text-gray-800">${firstVariant.price_breakdown?.shipping || '-'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">平台佣金</p>
                        <p className="font-semibold text-gray-800">${firstVariant.price_breakdown?.commission || '-'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">包装费</p>
                        <p className="font-semibold text-gray-800">${firstVariant.price_breakdown?.packaging || '-'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">税费</p>
                        <p className="font-semibold text-gray-800">${firstVariant.price_breakdown?.tax || '-'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">利润</p>
                        <p className="font-semibold text-green-600">${firstVariant.price_breakdown?.profit || '-'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">库存</p>
                        <p className="font-semibold text-gray-800">{firstVariant.inventory}</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">重量</p>
                        <p className="font-semibold text-gray-800">{firstVariant.weight}kg</p>
                      </div>
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400">类目</p>
                        <p className="font-semibold text-gray-800 text-xs">{previewProduct.category}</p>
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-medium text-gray-800">销售价格</span>
                  <span className="text-2xl font-bold text-accent-600">${(previewProduct as any).variants?.[0]?.selling_price?.toFixed(2) || '-'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
              {previewProduct.status !== 'published' && (
                <button
                  onClick={() => {
                    handlePublishProduct(previewProduct);
                    setPreviewProduct(null);
                  }}
                  className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  提交发布
                </button>
              )}
              {previewProduct.status === 'published' && (
                <span className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-xl">
                  <CheckCircle className="w-4 h-4" />
                  已发布
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showPromptsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI 图片提示词生成结果
              </h3>
              <button
                onClick={() => setShowPromptsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {imagePrompts.map((prompt, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4 text-primary-600" />
                      <span className="font-medium text-gray-800">{prompt.type}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">{prompt.aspect_ratio}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">正向提示词</label>
                      <div className="flex gap-2">
                        <p className="flex-1 text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                          {prompt.positive_prompt}
                        </p>
                        <button
                          onClick={() => handleCopyPrompt(prompt.positive_prompt, `positive-${index}`)}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors flex items-center gap-1"
                        >
                          {copiedPrompt === `positive-${index}` ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-gray-600" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">反向提示词</label>
                      <div className="flex gap-2">
                        <p className="flex-1 text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                          {prompt.negative_prompt}
                        </p>
                        <button
                          onClick={() => handleCopyPrompt(prompt.negative_prompt, `negative-${index}`)}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors flex items-center gap-1"
                        >
                          {copiedPrompt === `negative-${index}` ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-gray-600" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowPromptsModal(false)}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
