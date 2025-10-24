import { ReactNode, ComponentType } from 'react';
import { CountBadge } from './BadgeSystem';

interface Tab {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number;
  badge?: ReactNode;
  tooltip?: string;
  domId?: string;
}

interface NavigationTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'primary' | 'pills' | 'underline';
  className?: string;
}

export default function NavigationTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  className = '',
}: NavigationTabsProps) {
  if (variant === 'pills') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={tab.domId}
              title={tab.tooltip}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <CountBadge
                  count={tab.count}
                  variant={isActive ? 'neutral' : 'primary'}
                  size="sm"
                />
              )}
              {tab.badge}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: underline variant
  return (
    <div className={`flex border-b border-gray-200 ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={tab.domId}
            title={tab.tooltip}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors
              ${isActive
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <CountBadge
                count={tab.count}
                variant={isActive ? 'primary' : 'neutral'}
                size="sm"
              />
            )}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
