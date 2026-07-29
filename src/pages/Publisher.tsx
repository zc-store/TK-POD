import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import { 
  Upload, 
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Eye,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useState } from 'react';
import { PublishTask } from '../types';

export default function Publisher() {
  const { products, publishTasks, setPublishTasks, addPublishTask, updatePublishTask, config, setConfig } = useAppStore();
  const [publishing, setPublishing] = useState(false);

  const pendingProducts = products.filter((p) => p.status === 'pending');
  const publishedToday = publishTasks.filter(
    (t) => t.status === 'success' && new Date(t.published_at || t.created_at).toDateString() === new Date().toDateString()
  );

  const handlePublishAll = async () => {
    if (pendingProducts.length === 0) return;

    if (!config.tiktok_shop.api_key || !config.tiktok_shop.api_secret) {
      alert('请先配置TikTok Shop API密钥');
      return;
    }

    let currentConfig = config.tiktok_shop;
    
    if (!currentConfig.access_token) {
      try {
        const configRes = await fetch('/api/tiktok/config');
        const configData = await configRes.json();
        if (configData.success && configData.data) {
          setConfig({ tiktok_shop: configData.data });
          currentConfig = configData.data;
          if (!currentConfig.access_token) {
            alert('请先完成TikTok Shop授权，获取Access Token');
            return;
          }
        } else {
          alert('请先完成TikTok Shop授权，获取Access Token');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
        alert('请先完成TikTok Shop授权，获取Access Token');
        return;
      }
    }

    setPublishing(true);

    for (let index = 0; index < pendingProducts.length; index++) {
      const product = pendingProducts[index];
      
      const productId = product._id || product.id;
      const task: PublishTask = {
        id: Date.now().toString() + '-' + index,
        product_id: productId,
        product_name: product.name,
        status: 'publishing',
        created_at: new Date().toISOString(),
      };
      addPublishTask(task);

      try {
        const response = await fetch('/api/products/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product_id: productId,
            api_key: currentConfig.api_key,
            api_secret: currentConfig.api_secret,
            access_token: currentConfig.access_token,
            region: currentConfig.region,
          }),
        });
        
        if (!response.ok) {
          const text = await response.text();
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = text || errorMessage;
          }
          updatePublishTask(task.id, 'failed', errorMessage);
          continue;
        }
        
        const text = await response.text();
        if (!text) {
          updatePublishTask(task.id, 'failed', '服务器返回空响应');
          continue;
        }
        
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          updatePublishTask(task.id, 'failed', '服务器返回无效响应');
          continue;
        }
        
        if (data.success) {
          updatePublishTask(task.id, 'success');
        } else {
          updatePublishTask(task.id, 'failed', data.error || '发布失败');
        }
      } catch (error) {
        updatePublishTask(task.id, 'failed', (error as Error).message);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setPublishing(false);
  };

  const handleRetry = async (task: PublishTask) => {
    if (!config.tiktok_shop.api_key || !config.tiktok_shop.api_secret) {
      alert('请先配置TikTok Shop API密钥');
      return;
    }

    let currentConfig = config.tiktok_shop;
    
    if (!currentConfig.access_token) {
      try {
        const configRes = await fetch('/api/tiktok/config');
        const configData = await configRes.json();
        if (configData.success && configData.data) {
          setConfig({ tiktok_shop: configData.data });
          currentConfig = configData.data;
          if (!currentConfig.access_token) {
            alert('请先完成TikTok Shop授权，获取Access Token');
            return;
          }
        } else {
          alert('请先完成TikTok Shop授权，获取Access Token');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch config:', error);
        alert('请先完成TikTok Shop授权，获取Access Token');
        return;
      }
    }

    updatePublishTask(task.id, 'publishing');

    try {
      const response = await fetch('/api/products/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: task.product_id,
          api_key: currentConfig.api_key,
          api_secret: currentConfig.api_secret,
          access_token: currentConfig.access_token,
          region: currentConfig.region,
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        updatePublishTask(task.id, 'success');
      } else {
        updatePublishTask(task.id, 'failed', data.error || '重试失败');
      }
    } catch (error) {
      updatePublishTask(task.id, 'failed', (error as Error).message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'publishing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return '发布成功';
      case 'failed':
        return '发布失败';
      case 'publishing':
        return '发布中...';
      default:
        return '待发布';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50';
      case 'failed':
        return 'bg-red-50';
      case 'publishing':
        return 'bg-blue-50';
      default:
        return 'bg-yellow-50';
    }
  };

  return (
    <Layout title="发布中心" subtitle="发布产品到TikTok Shop平台">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{pendingProducts.length}</p>
              <p className="text-sm text-gray-500">待发布产品</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{publishedToday.length}</p>
              <p className="text-sm text-gray-500">今日发布成功</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">
                {publishTasks.filter((t) => t.status === 'failed').length}
              </p>
              <p className="text-sm text-gray-500">发布失败</p>
            </div>
          </div>
        </div>
      </div>

      {pendingProducts.length > 0 && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">待发布产品</h3>
              <p className="text-sm text-primary-200">共 {pendingProducts.length} 个产品等待发布到TikTok Shop</p>
            </div>
            <button
              onClick={handlePublishAll}
              disabled={publishing}
              className="px-6 py-2 bg-white text-primary-600 rounded-xl font-medium hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  一键发布
                </>
              )}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pendingProducts.slice(0, 4).map((product) => (
              <div key={product.id} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-primary-200">${(product as any).variants?.[0]?.selling_price?.toFixed(2) || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-600" />
            发布历史
          </h3>
        </div>

        <div className="divide-y divide-gray-50">
          {publishTasks.length > 0 ? (
            publishTasks.map((task) => (
              <div key={task.id} className={`p-5 ${getStatusBg(task.status)} hover:bg-opacity-80 transition-colors`}>
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getStatusIcon(task.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-800">{task.product_name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        task.status === 'success' ? 'bg-green-100 text-green-800' :
                        task.status === 'failed' ? 'bg-red-100 text-red-800' :
                        task.status === 'publishing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {getStatusText(task.status)}
                      </span>
                    </div>
                    {task.error_message && (
                      <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{task.error_message}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.created_at).toLocaleString()}
                      </span>
                      {task.published_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          发布于 {new Date(task.published_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(task)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white text-primary-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      重试
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <Upload className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">暂无发布记录</h3>
              <p className="text-gray-400">在产品管理中提交产品后，发布记录会显示在这里</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
