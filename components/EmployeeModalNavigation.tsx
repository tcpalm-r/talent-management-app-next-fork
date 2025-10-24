import { User, ClipboardList, TrendingUp, Lock, Sparkles, FileCode, FileText, UsersIcon, Calendar, AlertTriangle, Shield } from 'lucide-react';

type TabKey = 'overview' | 'performance' | 'development' | 'notes' | 'tools';

interface NavTab {
  key: TabKey;
  label: string;
  icon: any;
  items: Array<{
    id: string;
    label: string;
    icon: any;
    badge?: number;
    onClick: () => void;
  }>;
}

interface EmployeeModalNavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  activeItem: string;
  reviewCount: number;
  notesCount: number;
  onItemClick: (itemId: string) => void;
}

export default function EmployeeModalNavigation({
  activeTab,
  onTabChange,
  activeItem,
  reviewCount,
  notesCount,
  onItemClick,
}: EmployeeModalNavigationProps) {
  const tabs: NavTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: User,
      items: [
        { id: 'details', label: 'Contact & Info', icon: User, onClick: () => onItemClick('details') },
        { id: 'job-description', label: 'Job Description', icon: FileCode, onClick: () => onItemClick('job-description') },
      ],
    },
    {
      key: 'performance',
      label: 'Performance',
      icon: ClipboardList,
      items: [
        { id: 'perf-review', label: 'Reviews & ITP', icon: ClipboardList, badge: reviewCount, onClick: () => onItemClick('perf-review') },
        { id: '360', label: '360 Feedback', icon: UsersIcon, onClick: () => onItemClick('360') },
      ],
    },
    {
      key: 'development',
      label: 'Development',
      icon: TrendingUp,
      items: [
        { id: 'plan', label: 'Development Plan', icon: FileText, onClick: () => onItemClick('plan') },
        { id: 'one-on-one', label: '1:1 Meetings', icon: Calendar, onClick: () => onItemClick('one-on-one') },
      ],
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: Lock,
      items: [
        { id: 'notes', label: 'Manager Notes', icon: Lock, badge: notesCount, onClick: () => onItemClick('notes') },
      ],
    },
    {
      key: 'tools',
      label: 'Tools',
      icon: Sparkles,
      items: [
        { id: 'ingest', label: 'AI Ingest', icon: Sparkles, onClick: () => onItemClick('ingest') },
        { id: 'pip', label: 'Performance Plan', icon: AlertTriangle, onClick: () => onItemClick('pip') },
        { id: 'succession', label: 'Succession', icon: Shield, onClick: () => onItemClick('succession') },
      ],
    },
  ];

  const activeTabData = tabs.find(t => t.key === activeTab);

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200">
      {/* Main Tabs */}
      <div className="flex items-center gap-1 px-6 border-b border-gray-100">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative px-6 py-3 text-sm font-semibold transition-all ${
                isActive 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sub-navigation for active tab */}
      {activeTabData && activeTabData.items.length > 1 && (
        <div className="flex items-center gap-2 px-6 py-2 bg-gray-50">
          {activeTabData.items.map((item) => {
            const ItemIcon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <ItemIcon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

