import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import Dashboard from './pages/Dashboard';
import Configuration from './pages/Configuration';
import NewsCenter from './pages/NewsCenter';
import PatternStudio from './pages/PatternStudio';
import ProductManager from './pages/ProductManager';
import ProductDetail from './pages/ProductDetail';
import Publisher from './pages/Publisher';
import CronManager from './pages/CronManager';

const pages: Record<string, React.ComponentType<{ onProductSelect?: (productId: string) => void }>> = {
  dashboard: Dashboard,
  config: Configuration,
  news: NewsCenter,
  patterns: PatternStudio,
  products: ProductManager,
  cron: CronManager,
  publish: Publisher,
};

export default function App() {
  const { currentPage, setNews, setPatterns, setProducts, setPublishTasks, setConfig } = useAppStore();
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const initializeApp = async () => {
      const authStatus = searchParams.get('auth');
      
      if (authStatus === 'success') {
        alert('TikTok Shop授权成功！');
        setSearchParams({});
      } else if (authStatus === 'failed') {
        const error = searchParams.get('error');
        alert('TikTok Shop授权失败: ' + (error || '未知错误'));
        setSearchParams({});
      }

      try {
        const [newsRes, patternsRes, productsRes, tiktokConfigRes] = await Promise.all([
          fetch('/api/news'),
          fetch('/api/patterns'),
          fetch('/api/products'),
          fetch('/api/tiktok/config'),
        ]);

        const newsData = await newsRes.json();
        if (newsData.success && newsData.data) {
          setNews(newsData.data);
        }

        const patternsData = await patternsRes.json();
        if (patternsData.success && patternsData.data) {
          setPatterns(patternsData.data);
        }

        const productsData = await productsRes.json();
        if (productsData.success && productsData.data) {
          setProducts(productsData.data);
        }

        const tiktokConfigData = await tiktokConfigRes.json();
        interface TiktokShopConfig {
        api_key?: string;
        api_secret?: string;
        access_token?: string;
        shop_id?: string;
        shop_cipher?: string;
      }
      if (tiktokConfigData.success && tiktokConfigData.data) {
          setConfig({
            tiktok_shop: tiktokConfigData.data as TiktokShopConfig,
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    initializeApp();
  }, [setNews, setPatterns, setProducts, setPublishTasks, setConfig, searchParams, setSearchParams]);

  if (viewingProductId) {
    return (
      <ProductDetail 
        productId={viewingProductId} 
        onBack={() => setViewingProductId(null)} 
      />
    );
  }

  const PageComponent = pages[currentPage] || Dashboard;

  if (currentPage === 'products') {
    return <PageComponent onProductSelect={setViewingProductId} />;
  }
  
  return <PageComponent />;
}