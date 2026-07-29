import { 
  LayoutDashboard, 
  Settings, 
  Newspaper, 
  Palette, 
  Package, 
  Upload,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

const navItems = [
  { id: 'dashboard' as const, label: '仪表盘', icon: LayoutDashboard },
  { id: 'news' as const, label: '新闻中心', icon: Newspaper },
  { id: 'patterns' as const, label: '图案工作室', icon: Palette },
  { id: 'products' as const, label: '产品管理', icon: Package },
  { id: 'cron' as const, label: '定时任务', icon: Clock },
  { id: 'publish' as const, label: '发布中心', icon: Upload },
  { id: 'config' as const, label: '系统配置', icon: Settings },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-primary-800 text-white transition-all duration-300 z-50 flex flex-col ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="p-4 flex items-center justify-between border-b border-primary-700">
        <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold">智能上架</h1>
              <p className="text-xs text-primary-300">Smart Listing</p>
            </div>
          )}
        </div>
        {!sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-1 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                isActive 
                  ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/30' 
                  : 'text-primary-200 hover:bg-primary-700 hover:text-white'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
              {!sidebarCollapsed && (
                <span className="font-medium animate-fade-in">{item.label}</span>
              )}
              {isActive && !sidebarCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent-400 rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-primary-700">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center p-2 hover:bg-primary-700 rounded-lg transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </aside>
  );
}