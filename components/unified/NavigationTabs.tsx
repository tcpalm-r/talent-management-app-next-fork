import { ReactNode, ComponentType } from 'react';
import { CountBadge } from './BadgeSystem';
import { Tooltip } from './Tooltip';

interface Tab {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
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

          const button = (
            <button
              key={tab.id}
              id={tab.domId}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all
                ${isActive
                  ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
                }
              `}
            >
              {Icon && <Icon className="w-4 h-4" />}
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

          return tab.tooltip ? (
            <Tooltip key={tab.id} content={tab.tooltip} side="bottom">
              {button}
            </Tooltip>
          ) : button;
        })}
      </div>
    );
  }

  // Default: underline variant
  return (
    <div className={`flex border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        const button = (
          <button
            key={tab.id}
            id={tab.domId}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors
              ${isActive
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
          >
            {Icon && <Icon className="w-4 h-4" />}
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

        return tab.tooltip ? (
          <Tooltip key={tab.id} content={tab.tooltip} side="bottom">
            {button}
          </Tooltip>
        ) : button;
      })}
    </div>
  );
}
