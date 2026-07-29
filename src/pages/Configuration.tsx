import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import {
  Settings,
  Cpu,
  DollarSign,
  Globe,
  Clock,
  Save,
  CheckCircle,
  AlertCircle,
  Newspaper,
  RefreshCw,
  Warehouse,
  Loader2
} from 'lucide-react';
import { useState } from 'react';

type TabType = 'price' | 'api' | 'news' | 'baidu' | 'tiktok' | 'schedule';

interface TiktokWarehouse {
  warehouse_id: string;
  name: string;
  type: string;
  is_default?: boolean;
  effect_status?: string;
}

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'price', label: '价格设置', icon: DollarSign },
  { id: 'api', label: 'AI图像API', icon: Cpu },
  { id: 'news', label: '新闻API', icon: Newspaper },
  { id: 'baidu', label: '百度AI', icon: Globe },
  { id: 'tiktok', label: 'TikTok Shop', icon: Globe },
  { id: 'schedule', label: '定时任务', icon: Clock },
];

export default function Configuration() {
  const { config, setConfig } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>('price');
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 仓库相关状态
  const [warehouses, setWarehouses] = useState<TiktokWarehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [warehouseError, setWarehouseError] = useState('');

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    
    if (config.price_settings.shipping_fee < 0) {
      newErrors.shipping_fee = '运费不能为负数';
    }
    if (config.price_settings.platform_commission_rate < 0 || config.price_settings.platform_commission_rate > 1) {
      newErrors.platform_commission_rate = '佣金率应在0-1之间';
    }
    if (config.price_settings.packaging_fee < 0) {
      newErrors.packaging_fee = '包装费不能为负数';
    }
    if (config.price_settings.tax_rate < 0 || config.price_settings.tax_rate > 1) {
      newErrors.tax_rate = '税率应在0-1之间';
    }
    if (config.price_settings.profit_rate < 0) {
      newErrors.profit_rate = '利润率不能为负数';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const response = await fetch('/api/tiktok/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktok_shop: config.tiktok_shop }),
      });
      
      const data = await response.json();
      if (data.success) {
        setErrors({});
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert('保存配置失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('保存配置失败，请检查网络连接');
    }
  };

  const handleConfigChange = (section: string, key: string, value: string | number | boolean) => {
    setConfig({
      [section]: {
        ...config[section as keyof typeof config],
        [key]: value,
      },
    });
  };

  const handleAuthorize = async () => {
    try {
      const response = await fetch('/api/tiktok/authorize-url');
      console.log('[Authorize] Response status:', response.status);
      console.log('[Authorize] Response statusText:', response.statusText);
      
      const data = await response.json();
      console.log('[Authorize] Response data:', data);
      
      if (data.success && data.data && data.data.url) {
        window.location.href = data.data.url;
      } else {
        const errorMsg = data.error || '未知错误';
        if (errorMsg.includes('redirect URI not configured')) {
          alert('获取授权URL失败: ' + errorMsg + '\n\n请先填写重定向URL并点击保存按钮');
        } else if (errorMsg.includes('API key or secret not configured')) {
          alert('获取授权URL失败: ' + errorMsg + '\n\n请先填写API密钥和Secret并点击保存按钮');
        } else {
          alert('获取授权URL失败: ' + errorMsg);
        }
      }
    } catch (error) {
      console.error('获取授权URL失败:', error);
      alert('获取授权URL失败，请检查网络连接或后端服务是否正常运行');
    }
  };

  const handleRefreshToken = async () => {
    try {
      const response = await fetch('/api/tiktok/refresh-token', { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        alert('Token刷新成功！');
        const configRes = await fetch('/api/tiktok/config');
        const configData = await configRes.json();
        if (configData.success && configData.data) {
          setConfig({ tiktok_shop: configData.data });
        }
      } else {
        alert('Token刷新失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('刷新Token失败:', error);
      alert('刷新Token失败，请检查网络连接');
    }
  };

  // 拉取TikTok仓库列表
  const handleFetchWarehouses = async () => {
    if (loadingWarehouses) return;
    setLoadingWarehouses(true);
    setWarehouseError('');
    try {
      const response = await fetch('/api/tiktok/warehouses');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setWarehouses(data.data);
        if (data.data.length === 0) {
          setWarehouseError('未获取到仓库列表，请确认店铺已授权且存在可用仓库');
        }
      } else {
        setWarehouseError(data.error || '获取仓库列表失败');
        setWarehouses([]);
      }
    } catch (error) {
      console.error('获取仓库列表失败:', error);
      setWarehouseError('获取仓库列表失败，请检查网络连接');
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  // 选择仓库
  const handleSelectWarehouse = (warehouseId: string) => {
    const wh = warehouses.find(w => w.warehouse_id === warehouseId);
    handleConfigChange('tiktok_shop', 'warehouse_id', warehouseId);
    handleConfigChange('tiktok_shop', 'warehouse_name', wh?.name || '');
  };

  const renderPriceSettings = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-800">价格计算公式</h4>
            <p className="text-sm text-blue-600 mt-1">
              销售价格 = 成本价 + 运费 + 佣金 + 包装费 + 税费 + 利润
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            运费 ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.price_settings.shipping_fee}
            onChange={(e) => handleConfigChange('price_settings', 'shipping_fee', parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.shipping_fee ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
            }`}
          />
          {errors.shipping_fee && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.shipping_fee}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            平台佣金率 (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.price_settings.platform_commission_rate}
            onChange={(e) => handleConfigChange('price_settings', 'platform_commission_rate', parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.platform_commission_rate ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
            }`}
          />
          {errors.platform_commission_rate && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.platform_commission_rate}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            包装费 ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.price_settings.packaging_fee}
            onChange={(e) => handleConfigChange('price_settings', 'packaging_fee', parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.packaging_fee ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
            }`}
          />
          {errors.packaging_fee && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.packaging_fee}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            税率 (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.price_settings.tax_rate}
            onChange={(e) => handleConfigChange('price_settings', 'tax_rate', parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.tax_rate ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
            }`}
          />
          {errors.tax_rate && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.tax_rate}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            利润率 (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={config.price_settings.profit_rate}
            onChange={(e) => handleConfigChange('price_settings', 'profit_rate', parseFloat(e.target.value) || 0)}
            className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
              errors.profit_rate ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
            }`}
          />
          {errors.profit_rate && (
            <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.profit_rate}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderApiSettings = () => (
    <div className="space-y-6">
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h4 className="font-medium text-purple-800">AI图像生成API</h4>
            <p className="text-sm text-purple-600 mt-1">
              用于生成创意图案的AI服务，支持即梦AI、OpenAI DALL-E等
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API提供商
          </label>
          <select
            value={config.ai_image.api_provider}
            onChange={(e) => handleConfigChange('ai_image', 'api_provider', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="jimeng">即梦AI (火山引擎)</option>
            <option value="openai">OpenAI DALL-E</option>
            <option value="stability">Stability AI</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API密钥 (Access Key)
          </label>
          <input
            type="text"
            value={config.ai_image.api_key}
            onChange={(e) => handleConfigChange('ai_image', 'api_key', e.target.value)}
            placeholder="AK..."
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            即梦AI：在火山引擎控制台获取Access Key
          </p>
        </div>

        {config.ai_image.api_provider === 'jimeng' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API密钥 (Secret Key)
            </label>
            <input
              type="password"
              value={config.ai_image.api_secret}
              onChange={(e) => handleConfigChange('ai_image', 'api_secret', e.target.value)}
              placeholder="SK..."
              className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">
              即梦AI：在火山引擎控制台获取Secret Key
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            生成图像尺寸
          </label>
          <select
            value={config.ai_image.image_size}
            onChange={(e) => handleConfigChange('ai_image', 'image_size', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <optgroup label="电商展示尺寸">
              <option value="512x512">512x512 - 缩略图</option>
              <option value="1024x1024">1024x1024 - 商品详情</option>
              <option value="1792x1024">1792x1024 - 宽屏主图</option>
              <option value="1024x1792">1024x1792 - 竖屏展示</option>
            </optgroup>
            <optgroup label="高清印刷尺寸">
              <option value="2048x2048">2048x2048 - 4K高清印刷</option>
              <option value="3072x3072">3072x3072 - 6K超清印刷</option>
              <option value="4096x4096">4096x4096 - 8K超高清印刷</option>
              <option value="2000x3000">2000x3000 - 标准地毯尺寸</option>
              <option value="2500x3500">2500x3500 - 大尺寸地毯</option>
            </optgroup>
          </select>
        </div>
      </div>
    </div>
  );

  const renderNewsSettings = () => (
    <div className="space-y-6">
      <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Newspaper className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h4 className="font-medium text-orange-800">新闻API</h4>
            <p className="text-sm text-orange-600 mt-1">
              通过DeepSeek大模型获取美国最新新闻并提取创作灵感
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API提供商
          </label>
          <select
            value={config.news_api.api_provider}
            onChange={(e) => handleConfigChange('news_api', 'api_provider', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API密钥
          </label>
          <input
            type="password"
            value={config.news_api.api_key}
            onChange={(e) => handleConfigChange('news_api', 'api_key', e.target.value)}
            placeholder="sk-..."
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            请在DeepSeek官网获取API密钥
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API地址
          </label>
          <input
            type="text"
            value={config.news_api.api_url}
            onChange={(e) => handleConfigChange('news_api', 'api_url', e.target.value)}
            placeholder="https://api.deepseek.com/v1/chat/completions"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>
      </div>
    </div>
  );

  const renderBaiduSettings = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-800">百度AI图像增强</h4>
            <p className="text-sm text-blue-600 mt-1">
              使用百度AI图像无损放大API提升印花原图质量，支持超分辨率放大
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            APP ID
          </label>
          <input
            type="text"
            value={config.baidu_ai?.app_id || ''}
            onChange={(e) => handleConfigChange('baidu_ai', 'app_id', e.target.value)}
            placeholder="7919780"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            百度智能云控制台创建应用时获取的APP ID
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <input
            type="password"
            value={config.baidu_ai?.api_key || ''}
            onChange={(e) => handleConfigChange('baidu_ai', 'api_key', e.target.value)}
            placeholder="eEUDm3jFUvRvlnbT5RcfWpxp"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            百度智能云控制台获取的API Key
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Secret Key
          </label>
          <input
            type="password"
            value={config.baidu_ai?.secret_key || ''}
            onChange={(e) => handleConfigChange('baidu_ai', 'secret_key', e.target.value)}
            placeholder="AD6ylkgYo8L0meEOVjpEps5A8C1qaioC"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            百度智能云控制台获取的Secret Key
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-2">API功能说明</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>- 图像无损放大：提升图片清晰度和细节，适合印花原图优化</li>
          <li>- 超分辨率：支持2倍、4倍放大，保持图像质量</li>
          <li>- 鉴权机制：使用API Key和Secret Key获取access_token</li>
        </ul>
      </div>
    </div>
  );

  const renderTiktokSettings = () => {
    const tokenInfo = (config.tiktok_shop as any)?.token_info;
    const isExpired = tokenInfo?.is_expired;
    const expiresInMinutes = tokenInfo?.expires_in;
    const expireTime = tokenInfo?.expire_time;
    const tokenType = tokenInfo?.token_type;

    return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium text-green-800">TikTok Shop API</h4>
            <p className="text-sm text-green-600 mt-1">
              用于将产品发布到TikTok Shop平台
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API密钥
          </label>
          <input
            type="text"
            value={config.tiktok_shop.api_key}
            onChange={(e) => handleConfigChange('tiktok_shop', 'api_key', e.target.value)}
            placeholder="API Key"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API密钥 (Secret)
          </label>
          <input
            type="password"
            value={config.tiktok_shop.api_secret}
            onChange={(e) => handleConfigChange('tiktok_shop', 'api_secret', e.target.value)}
            placeholder="API Secret"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service ID
          </label>
          <input
            type="text"
            value={config.tiktok_shop.service_id || ''}
            onChange={(e) => handleConfigChange('tiktok_shop', 'service_id', e.target.value)}
            placeholder="Service ID"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            在TikTok Shop Partner Center的应用详情页面获取Service ID
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            重定向URL
          </label>
          <input
            type="text"
            value={config.tiktok_shop.redirect_uri}
            onChange={(e) => handleConfigChange('tiktok_shop', 'redirect_uri', e.target.value)}
            placeholder="http://localhost:3001/api/tiktok/callback"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400">
            必须与TikTok Shop Partner Center中配置的Redirect URL一致。本地开发请填写: http://localhost:3001/api/tiktok/callback
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            目标区域
          </label>
          <select
            value={config.tiktok_shop.region}
            onChange={(e) => handleConfigChange('tiktok_shop', 'region', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="US">美国</option>
            <option value="UK">英国</option>
            <option value="DE">德国</option>
            <option value="FR">法国</option>
            <option value="ES">西班牙</option>
            <option value="IT">意大利</option>
            <option value="JP">日本</option>
            <option value="SG">新加坡</option>
            <option value="MY">马来西亚</option>
            <option value="TH">泰国</option>
            <option value="ID">印度尼西亚</option>
            <option value="VN">越南</option>
            <option value="PH">菲律宾</option>
          </select>
        </div>

        {/* 仓库设置 */}
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Warehouse className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-amber-800">发货仓库设置</h4>
              <p className="text-sm text-amber-600 mt-1">
                选择发布产品时使用的发货仓库，影响订单履约和物流
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">当前仓库:</span>
              {config.tiktok_shop.warehouse_id ? (
                <span className="text-sm font-medium text-gray-800">
                  {config.tiktok_shop.warehouse_name || config.tiktok_shop.warehouse_id}
                </span>
              ) : (
                <span className="text-sm text-gray-400">未设置</span>
              )}
              {config.tiktok_shop.warehouse_id && (
                <span className="text-xs text-gray-400 font-mono">({config.tiktok_shop.warehouse_id})</span>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={config.tiktok_shop.warehouse_id || ''}
                onChange={(e) => handleSelectWarehouse(e.target.value)}
                disabled={warehouses.length === 0}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {warehouses.length === 0 ? '请先拉取仓库列表' : '请选择仓库'}
                </option>
                {warehouses.map((wh) => (
                  <option key={wh.warehouse_id} value={wh.warehouse_id}>
                    {wh.name} ({wh.warehouse_id})
                    {wh.type === 'SALES_WAREHOUSE' ? ' - 发货' : wh.type === 'RETURN_WAREHOUSE' ? ' - 退货' : ''}
                    {wh.effect_status === 'ENABLED' ? ' [启用]' : ' [停用]'}
                  </option>
                ))}
              </select>
              <button
                onClick={handleFetchWarehouses}
                disabled={loadingWarehouses || !config.tiktok_shop.access_token}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {loadingWarehouses ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    拉取中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    拉取仓库
                  </>
                )}
              </button>
            </div>

            {!config.tiktok_shop.access_token && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                请先完成TikTok Shop授权后再拉取仓库
              </p>
            )}
            {warehouseError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {warehouseError}
              </p>
            )}
            {warehouses.length > 0 && (
              <div className="text-xs text-gray-500">
                共 {warehouses.length} 个仓库，发货仓库 {
                  warehouses.filter(w => w.type === 'SALES_WAREHOUSE').length
                } 个，退货仓库 {
                  warehouses.filter(w => w.type === 'RETURN_WAREHOUSE').length
                } 个
              </div>
            )}
          </div>
        </div>

        <div className="pt-4">
          {config.tiktok_shop.access_token ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-5 h-5 ${isExpired ? 'text-red-500' : 'text-green-600'}`} />
                  <span className={`font-medium ${isExpired ? 'text-red-700' : 'text-green-700'}`}>
                    {isExpired ? '授权已过期' : '已授权'}
                  </span>
                  {tokenType && (
                    <span className={`ml-auto px-2 py-1 text-xs rounded-full ${tokenType === 'Seller Token' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {tokenType}
                    </span>
                  )}
                </div>

                {config.tiktok_shop.shop_name && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="w-4 h-4" />
                    <span>店铺名称: <strong>{config.tiktok_shop.shop_name}</strong></span>
                  </div>
                )}

                {config.tiktok_shop.seller_name && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Cpu className="w-4 h-4" />
                    <span>卖家名称: <strong>{config.tiktok_shop.seller_name}</strong></span>
                  </div>
                )}

                {tokenInfo?.token_prefix && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Token: <code className="text-xs">{tokenInfo.token_prefix}</code></span>
                  </div>
                )}

                {expireTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span className={isExpired ? 'text-red-600' : 'text-gray-600'}>
                      过期时间: {new Date(expireTime).toLocaleString('zh-CN')}
                      {expiresInMinutes !== null && (
                        <span className="ml-2">({expiresInMinutes}分钟后)</span>
                      )}
                    </span>
                  </div>
                )}

                {(config.tiktok_shop as any)?.last_auth_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>最后授权: {new Date((config.tiktok_shop as any).last_auth_time).toLocaleString('zh-CN')}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRefreshToken}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新Token
                </button>
                <button
                  onClick={() => handleConfigChange('tiktok_shop', 'access_token', '')}
                  className="px-4 py-2.5 text-sm text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                >
                  取消授权
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleAuthorize}
              disabled={!config.tiktok_shop.api_key || !config.tiktok_shop.api_secret || !config.tiktok_shop.redirect_uri}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Globe className="w-5 h-5" />
              点击授权TikTok Shop
            </button>
          )}
        </div>
      </div>
    </div>
    );
  };

  const [cronStatus, setCronStatus] = useState<{
    isRunning: boolean;
    progress: number;
    message: string;
    details: Array<{ productName: string; keywords: string[]; status: string }>;
  } | null>(null);
  const [cronLoading, setCronLoading] = useState(false);

  const fetchCronStatus = async () => {
    try {
      const response = await fetch('/api/cron/status');
      const data = await response.json();
      if (data.success && data.data) {
        setCronStatus(data.data);
      }
    } catch (error) {
      console.error('获取定时任务状态失败:', error);
    }
  };

  const executeCronTask = async () => {
    if (cronLoading) return;
    
    setCronLoading(true);
    try {
      const response = await fetch('/api/cron/execute', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('定时任务已启动！');
        fetchCronStatus();
      } else {
        alert('启动失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('启动定时任务失败:', error);
      alert('启动失败，请检查后端服务');
    } finally {
      setCronLoading(false);
    }
  };

  const renderScheduleSettings = () => (
    <div className="space-y-6">
      <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h4 className="font-medium text-orange-800">定时任务</h4>
            <p className="text-sm text-orange-600 mt-1">
              自动运行系统任务，如获取新闻、生成产品等
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <h4 className="font-medium text-gray-800">启用定时任务</h4>
            <p className="text-sm text-gray-500">开启后系统将自动执行预设任务</p>
          </div>
          <button
            onClick={() => handleConfigChange('scheduler', 'enabled', !config.scheduler.enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
              config.scheduler.enabled ? 'bg-accent-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                config.scheduler.enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            执行时间 (Cron表达式)
          </label>
          <input
            type="text"
            value={config.scheduler.schedule}
            onChange={(e) => handleConfigChange('scheduler', 'schedule', e.target.value)}
            placeholder="0 9 * * *"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            disabled={!config.scheduler.enabled}
          />
          <p className="mt-1 text-xs text-gray-400">
            默认: 每天早上9点执行 (0 9 * * *)
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-medium text-blue-800">手动执行任务</h4>
              <p className="text-sm text-blue-600 mt-1">立即触发一次产品生成任务</p>
            </div>
            <button
              onClick={executeCronTask}
              disabled={cronLoading || (cronStatus?.isRunning && cronStatus.progress < 100)}
              className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors flex items-center gap-2 ${
                cronLoading || (cronStatus?.isRunning && cronStatus.progress < 100)
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {cronLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  启动中...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  立即执行
                </>
              )}
            </button>
          </div>

          {cronStatus && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">任务状态:</span>
                <span className={`text-sm font-medium ${
                  cronStatus.isRunning && cronStatus.progress < 100
                    ? 'text-blue-600'
                    : cronStatus.progress === 100
                    ? 'text-green-600'
                    : 'text-gray-500'
                }`}>
                  {cronStatus.isRunning && cronStatus.progress < 100
                    ? '执行中'
                    : cronStatus.progress === 100
                    ? '已完成'
                    : '空闲'}
                </span>
              </div>

              {cronStatus.isRunning && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">进度</span>
                    <span className="text-gray-800">{Math.round(cronStatus.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${cronStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {cronStatus.message && (
                <p className="text-sm text-gray-600 bg-white px-3 py-2 rounded-lg">
                  {cronStatus.message}
                </p>
              )}

              {cronStatus.details && cronStatus.details.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">执行详情:</p>
                  {cronStatus.details.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                        item.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <span className="text-sm text-gray-700">{item.productName}</span>
                      <span className={`text-xs font-medium ${
                        item.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.status === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={fetchCronStatus}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            刷新状态
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'price':
        return renderPriceSettings();
      case 'api':
        return renderApiSettings();
      case 'news':
        return renderNewsSettings();
      case 'baidu':
        return renderBaiduSettings();
      case 'tiktok':
        return renderTiktokSettings();
      case 'schedule':
        return renderScheduleSettings();
      default:
        return null;
    }
  };

  return (
    <Layout title="系统配置" subtitle="管理系统参数和API设置">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all ${
                    isActive
                      ? 'text-primary-800 bg-primary-50 border-b-2 border-primary-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {renderContent()}

          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={() => {
                setConfig({
                  price_settings: {
                    shipping_fee: 5.0,
                    platform_commission_rate: 0.15,
                    packaging_fee: 2.0,
                    tax_rate: 0.08,
                    profit_rate: 0.30,
                  },
                  ai_image: {
                    api_provider: 'jimeng',
                    api_key: '',
                    api_secret: '',
                    image_size: '1024x1024',
                  },
                  news_api: {
                    api_provider: 'deepseek',
                    api_key: '',
                    api_url: 'https://api.deepseek.com/v1/chat/completions',
                  },
                  tiktok_shop: {
                    api_key: '',
                    api_secret: '',
                    service_id: '',
                    region: 'US',
                    redirect_uri: '',
                    access_token: '',
                    refresh_token: '',
                    token_expire_at: '',
                    shop_id: '',
                    shop_cipher: '',
                    shop_name: '',
                    seller_name: '',
                    user_type: 0,
                    granted_scopes: [],
                    last_auth_time: '',
                    warehouse_id: '',
                    warehouse_name: '',
                  },
                  scheduler: {
                    enabled: true,
                    schedule: '0 9 * * *',
                  },
                });
                setErrors({});
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              重置为默认
            </button>
            <button
              onClick={handleSave}
              className={`px-6 py-2 text-sm font-medium text-white rounded-xl transition-all flex items-center gap-2 ${
                saved
                  ? 'bg-green-500'
                  : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/30'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存配置
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
