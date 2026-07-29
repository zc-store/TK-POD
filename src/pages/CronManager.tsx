import Layout from '../components/Layout';
import { useState, useEffect } from 'react';
import { Clock, Play, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface CronStatus {
  isRunning: boolean;
  progress: {
    status: 'idle' | 'running' | 'completed' | 'failed';
    message: string;
    progress: number;
    details: Array<{ productName: string; keywords: string[]; status: string }>;
  };
}

interface Keyword {
  _id: string;
  name: string;
  category: string;
}

export default function CronManager() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/cron/status');
      const data = await response.json();
      if (data.success && data.data) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('获取定时任务状态失败:', error);
    }
  };

  const fetchKeywords = async () => {
    setKeywordsLoading(true);
    try {
      const response = await fetch('/api/patterns/keywords');
      const data = await response.json();
      if (data.success && data.data) {
        setKeywords(data.data);
      }
    } catch (error) {
      console.error('获取关键词失败:', error);
    } finally {
      setKeywordsLoading(false);
    }
  };

  const executeTask = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/cron/execute', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert('定时任务已启动！');
        fetchStatus();
      } else {
        alert('启动失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('启动定时任务失败:', error);
      alert('启动失败，请检查后端服务');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchKeywords();
  }, []);

  const categories = [
    { name: 'style', label: '风格质感' },
    { name: 'theme', label: '场景空间' },
    { name: 'color', label: '色彩色系' },
    { name: 'texture', label: '材质纹理' },
  ];

  return (
    <Layout title="定时任务" subtitle="管理自动产品生成任务">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">任务状态</h3>
                <p className="text-sm text-gray-500">当前定时任务执行情况</p>
              </div>
            </div>

            {status ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                  <span className="text-gray-600">任务状态</span>
                  <span className={`font-medium ${
                    status.isRunning && status.progress.progress < 100
                      ? 'text-blue-600'
                      : status.progress.progress === 100
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }`}>
                    {status.isRunning && status.progress.progress < 100
                      ? '执行中'
                      : status.progress.progress === 100
                      ? '已完成'
                      : '空闲'}
                  </span>
                </div>

                {status.isRunning && status.progress.progress < 100 && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">执行进度</span>
                      <span className="font-medium text-gray-800">
                        {Math.round(status.progress.progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${status.progress.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {status.progress.message && (
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-700">{status.progress.message}</p>
                  </div>
                )}

                {status.progress.details && status.progress.details.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">执行详情</p>
                    {status.progress.details.map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                          item.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                        }`}
                      >
                        <span className="text-sm text-gray-700 truncate max-w-[150px]">
                          {item.productName}
                        </span>
                        {item.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={executeTask}
                  disabled={loading || (status.isRunning && status.progress.progress < 100)}
                  className={`w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 ${
                    loading || (status.isRunning && status.progress.progress < 100)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      启动中...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      立即执行
                    </>
                  )}
                </button>

                <button
                  onClick={fetchStatus}
                  className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新状态
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">无法获取任务状态</p>
                <button
                  onClick={fetchStatus}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  重试
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">任务配置</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500">执行时间</span>
                <span className="font-medium text-gray-800">每天 10:00</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500">每日生成</span>
                <span className="font-medium text-gray-800">5 个产品</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500">关键词数量</span>
                <span className="font-medium text-gray-800">每个产品 3 个</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500">尺寸规格</span>
                <span className="font-medium text-gray-800">60x90cm / 40x60cm</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-gray-800">关键词库</h3>
                <p className="text-sm text-gray-500">定时任务使用的关键词池</p>
              </div>
              <button
                onClick={fetchKeywords}
                disabled={keywordsLoading}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-2"
              >
                {keywordsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                刷新
              </button>
            </div>

            {keywordsLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : keywords.length > 0 ? (
              <div className="space-y-4">
                {categories.map((cat) => {
                  const catKeywords = keywords.filter(k => k.category === cat.name);
                  if (catKeywords.length === 0) return null;
                  return (
                    <div key={cat.name}>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">{cat.label}</h4>
                      <div className="flex flex-wrap gap-2">
                        {catKeywords.map((kw) => (
                          <span
                            key={kw._id}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            {kw.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">暂无关键词</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}