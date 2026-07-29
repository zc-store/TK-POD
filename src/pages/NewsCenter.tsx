import Layout from '../components/Layout';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { 
  Newspaper, 
  RefreshCw, 
  Search, 
  Filter,
  Sparkles,
  Calendar,
  Tag,
  Palette,
  ArrowRight,
  Loader2,
  TrendingUp,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { NewsItem, ExtractedInfo } from '../types';

export default function NewsCenter() {
  const { news, setNews, addNews, config, setTempPatternData } = useAppStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [generating, setGenerating] = useState(false);

  const categories = ['all', '美国时政政策', '美国经济金融', '美国科技产业', '美国民生社会', '美国突发事件'];

  const filteredNews = news.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFetchNews = async () => {
    if (!config.news_api.api_key) {
      alert('请先配置DeepSeek API密钥');
      return;
    }
    
    setFetching(true);
    try {
      const response = await fetch('/api/news/fetch-via-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: selectedCategory === 'all' ? '' : selectedCategory,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        setNews(data.data);
      } else {
        alert(data.error || '获取新闻失败');
      }
    } catch (error) {
      alert('获取新闻失败: ' + (error as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const handleExtractInfo = async (newsItem: NewsItem) => {
    if (newsItem.extracted_info) {
      setSelectedNews(newsItem);
      return;
    }

    if (!config.news_api.api_key) {
      alert('请先配置DeepSeek API密钥');
      return;
    }

    setExtracting(true);
    try {
      const response = await fetch('/api/news/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          news_id: newsItem.id,
          api_key: config.news_api.api_key,
          title: newsItem.title,
          summary: newsItem.summary,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        const updatedNews = news.map((n) =>
          n.id === newsItem.id ? { ...n, extracted_info: data.data } : n
        );
        setNews(updatedNews);
        setSelectedNews({ ...newsItem, extracted_info: data.data });
      } else {
        alert(data.error || '提取灵感失败');
      }
    } catch (error) {
      alert('提取灵感失败: ' + (error as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const handleGeneratePatternFromNews = async () => {
    if (!selectedNews?.extracted_info) return;
    
    if (!config.deepseek.api_key) {
      alert('请先配置DeepSeek API密钥');
      return;
    }
    
    if (!config.ai_image.api_key || !config.ai_image.api_secret) {
      alert('请先配置即梦AI API密钥');
      return;
    }

    setGenerating(true);
    
    try {
      const response = await fetch('/api/patterns/generate-from-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedNews.title.substring(0, 20) + '...',
          themes: selectedNews.extracted_info.themes,
          colors: selectedNews.extracted_info.colors,
          elements: selectedNews.extracted_info.elements,
          styles: selectedNews.extracted_info.styles,
          sizes: ['37x47cm', '43x53cm'],
          imageSize: config.ai_image.image_size,
        }),
      });
      
      const data = await response.json();
      if (data.success && data.data) {
        setTempPatternData(data.data);
        navigate('/patterns');
      } else {
        alert(data.error || '生成图案失败');
      }
    } catch (error) {
      alert('生成图案失败: ' + (error as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Layout title="新闻中心" subtitle="获取美国最新新闻并提取创作灵感">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleFetchNews}
            disabled={fetching}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {fetching ? '获取中...' : '获取新闻'}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索新闻..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? '全部分类' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredNews.length > 0 ? (
            filteredNews.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedNews(item)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                        {item.source}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {item.category}
                      </span>
                      {item.extracted_info && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          已提取
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {item.summary}
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(item.publish_date).toLocaleDateString()}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.keywords.slice(0, 3).map((keyword) => (
                          <span
                            key={keyword}
                            className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4" />
                          原文
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtractInfo(item);
                    }}
                    disabled={extracting}
                    className="flex-shrink-0 ml-4 px-4 py-2 bg-accent-500 text-white rounded-xl text-sm font-medium hover:bg-accent-600 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {extracting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {item.extracted_info ? '查看灵感' : '提取灵感'}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <Newspaper className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">暂无新闻数据</h3>
              <p className="text-gray-400 mb-4">点击上方按钮获取最新新闻</p>
              <button
                onClick={handleFetchNews}
                className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all"
              >
                获取新闻
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedNews ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
              <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-primary-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                  <h3 className="font-semibold text-primary-800">创作灵感</h3>
                </div>
                <p className="text-sm font-medium text-gray-800 line-clamp-2">
                  {selectedNews.title}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {selectedNews.extracted_info ? (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-700">主题</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedNews.extracted_info.themes.map((theme) => (
                          <span
                            key={theme}
                            className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">配色方案</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedNews.extracted_info.colors.map((color) => (
                          <span
                            key={color}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm"
                          >
                            {color}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-700">视觉元素</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedNews.extracted_info.elements.map((element) => (
                          <span
                            key={element}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm"
                          >
                            {element}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Newspaper className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium text-gray-700">设计风格</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedNews.extracted_info.styles.map((style) => (
                          <span
                            key={style}
                            className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm"
                          >
                            {style}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleGeneratePatternFromNews}
                      disabled={generating}
                      className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          生成图案 <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-400">点击"提取灵感"按钮分析此新闻</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <Newspaper className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400">选择一条新闻查看创作灵感</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
