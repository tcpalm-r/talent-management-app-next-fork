'use client';

import { MessageSquare, Users, Settings } from 'lucide-react';

type View = '360-feedback' | 'directory' | 'admin-settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navItems = [
    { id: '360-feedback', label: '360°', icon: MessageSquare },
    { id: 'directory', label: 'Talent', icon: Users },
    { id: 'admin-settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center">
      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-2 flex flex-col items-center w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={`flex items-center justify-center p-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
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
