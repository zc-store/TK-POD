import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import { 
  Package, 
  Upload, 
  Palette, 
  Newspaper, 
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
  Zap
} from 'lucide-react';
import { useEffect } from 'react';

const statCards = [
  { 
    id: 'products', 
    label: '总产品数', 
    icon: Package, 
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  { 
    id: 'published', 
    label: '已发布', 
    icon: Upload, 
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600'
  },
  { 
    id: 'pending', 
    label: '待发布', 
    icon: Clock, 
    color: 'from-yellow-500 to-yellow-600',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-600'
  },
  { 
    id: 'patterns', 
    label: '图案数量', 
    icon: Palette, 
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600'
  },
  { 
    id: 'news', 
    label: '最新新闻', 
    icon: Newspaper, 
    color: 'from-red-500 to-red-600',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600'
  },
  { 
    id: 'today', 
    label: '今日发布', 
    icon: TrendingUp, 
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600'
  },
];

const quickActions = [
  { 
    id: 'fetch-news', 
    label: '获取最新新闻', 
    icon: Newspaper,
    description: '从美国主流媒体获取热点新闻',
    color: 'bg-blue-50 hover:bg-blue-100 text-blue-700'
  },
  { 
    id: 'generate-pattern', 
    label: '生成图案', 
    icon: Palette,
    description: '基于新闻灵感生成创意图案',
    color: 'bg-purple-50 hover:bg-purple-100 text-purple-700'
  },
  { 
    id: 'create-product', 
    label: '创建产品', 
    icon: Package,
    description: '选择图案和尺寸生成产品',
    color: 'bg-green-50 hover:bg-green-100 text-green-700'
  },
  { 
    id: 'publish', 
    label: '一键发布', 
    icon: Upload,
    description: '发布待上架产品到TikTok Shop',
    color: 'bg-orange-50 hover:bg-orange-100 text-orange-700'
  },
];

export default function Dashboard() {
  const { stats, setStats, news, patterns, products, publishTasks, setCurrentPage } = useAppStore();

  useEffect(() => {
    const today = new Date().toDateString();
    const todayTasks = publishTasks.filter(t => 
      t.status === 'success' && new Date(t.published_at || t.created_at).toDateString() === today
    );
    
    setStats({
      total_products: products.length,
      published_products: products.filter(p => p.status === 'published').length,
      pending_products: products.filter(p => p.status === 'pending').length,
      total_patterns: patterns.length,
      recent_news_count: news.length,
      today_publish_count: todayTasks.length,
    });
  }, [products, patterns, news, publishTasks, setStats]);

  const statValues = {
    products: stats.total_products,
    published: stats.published_products,
    pending: stats.pending_products,
    patterns: stats.total_patterns,
    news: stats.recent_news_count,
    today: stats.today_publish_count,
  };

  const recentNews = news.slice(0, 3);
  const recentProducts = products.slice(-3).reverse();

  const handleQuickAction = (actionId: string) => {
    switch(actionId) {
      case 'fetch-news':
        setCurrentPage('news');
        break;
      case 'generate-pattern':
        setCurrentPage('patterns');
        break;
      case 'create-product':
        setCurrentPage('products');
        break;
      case 'publish':
        setCurrentPage('publish');
        break;
    }
  };

  return (
    <Layout title="仪表盘" subtitle="系统概览与快捷操作">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div 
              key={card.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-slide-up"
            >
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
                <span className="text-xs font-medium text-gray-400">{card.label}</span>
              </div>
              <div className="mt-3">
                <p className="text-3xl font-bold text-gray-800">{statValues[card.id as keyof typeof statValues]}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-500" />
            快捷操作
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.id)}
                  className={`p-4 rounded-xl ${action.color} transition-all duration-200 hover:scale-[1.02] flex items-center gap-3 text-left`}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <p className="font-medium">{action.label}</p>
                    <p className="text-xs opacity-70">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary-500" />
            最新新闻
          </h3>
          {recentNews.length > 0 ? (
            <div className="space-y-3">
              {recentNews.map((item) => {
                const newsItem = item as { _id?: string; id?: string };
                const itemKey = newsItem._id || newsItem.id;
                return (
                  <div 
                    key={itemKey}
                    className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                        {item.source}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.publish_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无新闻数据</p>
              <button 
                onClick={() => setCurrentPage('news')}
                className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 mx-auto"
              >
                获取新闻 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            最近产品
          </h3>
          <button 
            onClick={() => setCurrentPage('products')}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            查看全部 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {recentProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">产品名称</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">尺寸</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">成本价</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">售价</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">状态</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => {
                  const prod = product as { _id?: string; id?: string; variants?: any[] };
                  const prodKey = prod._id || prod.id;
                  const firstVariant = prod.variants?.[0];
                  const sizes = prod.variants?.map(v => v.size_cm).join(', ') || '-';
                  const minPrice = prod.variants?.reduce((min, v) => Math.min(min, v.selling_price), Infinity);
                  const maxPrice = prod.variants?.reduce((max, v) => Math.max(max, v.selling_price), 0);
                  return (
                    <tr key={prodKey} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-800">{product.name}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm max-w-[120px] truncate" title={sizes}>{sizes}</td>
                      <td className="py-3 px-4 text-gray-600">¥{firstVariant?.cost_price || '-'}</td>
                      <td className="py-3 px-4 font-semibold text-accent-600">${minPrice?.toFixed(2)} - ${maxPrice?.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.status === 'published' ? 'bg-green-100 text-green-800' :
                          product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {product.status === 'published' ? '已发布' :
                           product.status === 'pending' ? '待发布' : '草稿'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(product.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无产品数据</p>
            <button 
              onClick={() => setCurrentPage('products')}
              className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 mx-auto"
            >
              创建产品 <Play className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
