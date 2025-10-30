'use client';

import { Search, MoreVertical } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Avatar from './Avatar';

interface TopHeaderProps {
  title: string;
  userProfile: any;
  onMenuOpen?: () => void;
}

export default function TopHeader({ title, userProfile, onMenuOpen }: TopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen);
    onMenuOpen?.();
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="h-16 px-6 flex items-center justify-between gap-4">
        {/* Title */}
        <div className="flex-shrink-0 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* More Options Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMenuToggle}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                  Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                  Help & Support
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                  About
                </button>
                <div className="border-t border-gray-200 my-1"></div>
                <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Avatar */}
          <button
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title={userProfile?.full_name}
          >
            <Avatar
              name={userProfile?.full_name}
              picture={userProfile?.picture}
              size="sm"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
