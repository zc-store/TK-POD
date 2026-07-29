import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { 
  Palette, 
  Plus, 
  Trash2, 
  Download,
  Eye,
  Sparkles,
  Loader2,
  X,
  Tag,
  Calendar,
  ArrowRight,
  ZoomIn,
  Image
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Pattern } from '../types';

const availableSizes = ['37x47cm', '43x53cm', '43x63cm', '50x80cm', '60x90cm'];

export default function PatternStudio() {
  const { patterns, setPatterns, addPattern, removePattern, config, tempPatternData, setTempPatternData } = useAppStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [previewPattern, setPreviewPattern] = useState<Pattern | null>(null);
  const [generating, setGenerating] = useState(false);
  const [newPattern, setNewPattern] = useState({
    name: '',
    theme: '',
    colors: [] as string[],
    sizes: [] as string[],
  });
  const [enhancingImage, setEnhancingImage] = useState(false);
  const [enhancedImageUrl, setEnhancedImageUrl] = useState<string | null>(null);
  const [enhancedCache, setEnhancedCache] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const cached = localStorage.getItem('enhancedImageCache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const cleaned: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && value.startsWith('/')) {
            cleaned[key] = value;
          }
        }
        setEnhancedCache(cleaned);
        if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
          localStorage.setItem('enhancedImageCache', JSON.stringify(cleaned));
        }
      }
    } catch {
      try {
        localStorage.removeItem('enhancedImageCache');
      } catch {}
      setEnhancedCache({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('enhancedImageCache', JSON.stringify(enhancedCache));
    } catch {
      console.warn('localStorage quota exceeded, cache not saved');
    }
  }, [enhancedCache]);

  useEffect(() => {
    if (tempPatternData) {
      addPattern(tempPatternData);
      setTempPatternData(null);
    }
  }, [tempPatternData, addPattern, setTempPatternData]);

  const handleGeneratePattern = async () => {
    if (!newPattern.name || !newPattern.theme || newPattern.sizes.length === 0) {
      return;
    }

    if (!config.ai_image.api_key || !config.ai_image.api_secret) {
      alert('请先配置即梦AI API密钥');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/patterns/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newPattern.name,
          theme: newPattern.theme,
          colors: newPattern.colors.length > 0 ? newPattern.colors : ['默认配色'],
          sizes: newPattern.sizes,
          api_key: config.ai_image.api_key,
          api_secret: config.ai_image.api_secret,
          image_size: config.ai_image.image_size,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        addPattern(data.data);
        setShowModal(false);
        setNewPattern({ name: '', theme: '', colors: [], sizes: [] });
      } else {
        alert(data.error || '生成图案失败');
      }
    } catch (error) {
      alert('生成图案失败: ' + (error as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!previewPattern) return;

    const imageUrls = Object.entries(previewPattern.image_urls);
    if (imageUrls.length === 0) {
      alert('没有可下载的图片');
      return;
    }

    for (const [size, url] of imageUrls) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`下载失败: ${response.status}`);
        }
        const blob = await response.blob();
        const fileName = `${previewPattern.name}-${size}.png`;
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`下载 ${size} 失败:`, error);
        alert(`下载 ${size} 失败: ${(error as Error).message}`);
      }
    }

    alert(`已尝试下载 ${imageUrls.length} 张图片`);
  };

  const handleImageEnhance = async () => {
    if (!previewPattern) return;

    const firstSize = previewPattern.sizes[0];
    const imageUrl = previewPattern.image_urls[firstSize];
    
    if (!imageUrl) {
      alert('没有可增强的图片');
      return;
    }

    const cacheKey = previewPattern.id;
    if (enhancedCache[cacheKey]) {
      setEnhancedImageUrl(enhancedCache[cacheKey]);
      return;
    }

    setEnhancingImage(true);
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`下载图片失败: ${imageResponse.status}`);
      }
      
      const blob = await imageResponse.blob();
      const reader = new FileReader();
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('图片转换失败'));
        reader.readAsDataURL(blob);
      });
      
      const base64Data = base64Image.split(',')[1];

      const response = await fetch('/api/image/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: imageUrl, image_base64: base64Data }),
      });
      
      const data = await response.json();
      
      if (data.success && data.image_url) {
        setEnhancedImageUrl(data.image_url);
        setEnhancedCache(prev => ({ ...prev, [cacheKey]: data.image_url }));
      } else {
        alert(data.error || '图像增强失败');
      }
    } catch (error) {
      alert('图像增强失败: ' + (error as Error).message);
    } finally {
      setEnhancingImage(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!previewPattern) return;

    const firstSize = previewPattern.sizes[0];
    const imageUrl = previewPattern.image_urls[firstSize];
    
    if (!imageUrl) {
      alert('没有可下载的原图');
      return;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      const blob = await response.blob();
      const fileName = `${previewPattern.name}-original.png`;
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('下载原图失败:', error);
      alert('下载原图失败: ' + (error as Error).message);
    }
  };

  const handleDownloadEnhanced = async () => {
    if (!enhancedImageUrl) {
      alert('请先进行图像增强');
      return;
    }

    try {
      const response = await fetch(enhancedImageUrl);
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      const blob = await response.blob();
      const fileName = `${previewPattern.name}-enhanced.png`;
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('下载增强图片失败:', error);
      alert('下载增强图片失败: ' + (error as Error).message);
    }
  };

  const handleDeletePattern = async (id: string) => {
    if (confirm('确定要删除这个图案吗？')) {
      removePattern(id);
    }
  };

  return (
    <Layout title="图案工作室" subtitle="生成和管理创意图案">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/30"
          >
            <Plus className="w-4 h-4" />
            生成新图案
          </button>
        </div>

        <div className="text-sm text-gray-500">
          共 {patterns.length} 个图案
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {patterns.length > 0 ? (
          patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all group"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                <img
                  src={pattern.image_urls[pattern.sizes[0]]}
                  alt={pattern.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={() => setPreviewPattern(pattern)}
                    className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </button>
                  <button
                    onClick={() => removePattern(pattern.id)}
                    className="p-2 bg-red-500/90 rounded-lg hover:bg-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-2 line-clamp-1">
                  {pattern.name}
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                    {pattern.theme}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {pattern.colors.slice(0, 3).map((color) => (
                    <span
                      key={color}
                      className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md"
                    >
                      {color}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {pattern.sizes.length} 个尺寸
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(pattern.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Palette className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">暂无图案</h3>
            <p className="text-gray-400 mb-4">点击上方按钮生成新图案</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all"
            >
              生成图案
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-500" />
                生成新图案
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
                  图案名称
                </label>
                <input
                  type="text"
                  value={newPattern.name}
                  onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
                  placeholder="输入图案名称"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  主题
                </label>
                <input
                  type="text"
                  value={newPattern.theme}
                  onChange={(e) => setNewPattern({ ...newPattern, theme: e.target.value })}
                  placeholder="输入图案主题"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  配色方案（可选）
                </label>
                <input
                  type="text"
                  placeholder="输入颜色，用逗号分隔"
                  onChange={(e) => setNewPattern({ ...newPattern, colors: e.target.value.split(',').map(c => c.trim()).filter(Boolean) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择尺寸
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        const isSelected = newPattern.sizes.includes(size);
                        setNewPattern({
                          ...newPattern,
                          sizes: isSelected
                            ? newPattern.sizes.filter(s => s !== size)
                            : [...newPattern.sizes, size],
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        newPattern.sizes.includes(size)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleGeneratePattern}
                disabled={generating || !newPattern.name || !newPattern.theme || newPattern.sizes.length === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    生成图案
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewPattern && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">{previewPattern.name}</h3>
              <button
                onClick={() => {
                  setPreviewPattern(null);
                  setEnhancedImageUrl(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex h-[calc(90vh-140px)]">
              <div className="flex-1 p-4 border-r border-gray-100 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <Image className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-600">原图预览</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {previewPattern.sizes.map((size) => (
                    <div key={size} className="text-center">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-1">
                        <img
                          src={previewPattern.image_urls[size]}
                          alt={`${previewPattern.name} - ${size}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-700">{size}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                      主题: {previewPattern.theme}
                    </span>
                    {previewPattern.colors.map((color) => (
                      <span
                        key={color}
                        className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full"
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400">
                    创建时间: {new Date(previewPattern.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="w-80 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ZoomIn className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-600">图像增强</span>
                  </div>
                  {enhancedImageUrl && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">
                      已完成
                    </span>
                  )}
                </div>

                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-4 flex items-center justify-center">
                  {enhancedImageUrl ? (
                    <img
                      src={enhancedImageUrl}
                      alt={`${previewPattern.name} - enhanced`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ZoomIn className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">点击下方按钮进行图像增强</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleImageEnhance}
                    disabled={enhancingImage}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enhancingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        增强中...
                      </>
                    ) : (
                      <>
                        <ZoomIn className="w-4 h-4" />
                        图像无损放大
                      </>
                    )}
                  </button>

                  {enhancedImageUrl && (
                    <button
                      onClick={handleDownloadEnhanced}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      下载增强图片
                    </button>
                  )}

                  <button
                    onClick={handleDownloadOriginal}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Image className="w-4 h-4" />
                    下载原图
                  </button>

                  <button
                    onClick={handleDownloadAll}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    下载所有尺寸
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setPreviewPattern(null);
                    setEnhancedImageUrl(null);
                    navigate('/products');
                  }}
                  className="w-full mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                >
                  创建产品 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
