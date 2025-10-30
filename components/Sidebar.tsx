'use client';

import { MessageSquare, Users, Settings } from 'lucide-react';

type View = '360-feedback' | 'directory' | 'admin-settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navItems = [
    { id: '360-feedback', label: '360° Feedback', icon: MessageSquare },
    { id: 'directory', label: 'Talent', icon: Users },
    { id: 'admin-settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo/Brand */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Sonance</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">v1.0.0</p>
      </div>
    </aside>
  );
}
