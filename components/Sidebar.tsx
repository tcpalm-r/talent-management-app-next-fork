'use client';

import { RotateCw, Users, Settings, Lightbulb } from 'lucide-react';
import { useMemo } from 'react';

type View = '360-feedback' | 'directory' | 'admin-settings' | 'insights';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  userRole?: string;
}

export default function Sidebar({ currentView, onViewChange, userRole }: SidebarProps) {
  const baseNavItems = [
    { id: '360-feedback', label: '360°', icon: RotateCw },
    { id: 'directory', label: 'Talent', icon: Users },
  ] as const;

  const leaderNavItems = [
    { id: 'insights', label: 'Insights', icon: Lightbulb },
  ] as const;

  const adminNavItems = [
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'admin-settings', label: 'Admin', icon: Settings },
  ] as const;

  const navItems = useMemo(() => {
    const role = userRole?.toLowerCase();
    if (role === 'admin') {
      return [...baseNavItems, ...adminNavItems];
    } else if (role === 'leader') {
      return [...baseNavItems, ...leaderNavItems];
    }
    return baseNavItems;
  }, [userRole]);

  return (
    <aside className="w-20 bg-gray-50 border-r border-gray-200 flex flex-col items-center">
      {/* Navigation */}
      <nav className="flex-1 pt-0 pb-4 space-y-0 flex flex-col items-center w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={`w-full flex flex-col items-center justify-center py-3 px-2 rounded-none transition-colors relative ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {/* Left indicator bar with padding */}
              {isActive && (
                <div className="absolute left-1 top-1 bottom-1 w-1 bg-blue-600" style={{ borderRadius: '1px' }} />
              )}
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-normal text-center leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pb-4 border-t border-gray-200 w-full flex items-center justify-center pt-4">
        <p className="text-xs text-gray-500">v1</p>
      </div>
    </aside>
  );
}
