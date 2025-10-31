'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Avatar from './Avatar';

interface TopHeaderProps {
  userProfile: any;
  onMenuOpen?: () => void;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
}

export default function TopHeader({ userProfile, onMenuOpen, currentRole, onRoleChange }: TopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setRoleOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setAvatarOpen(false);
      }
    }

    if (menuOpen || roleOpen || avatarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen, roleOpen, avatarOpen]);

  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen);
    onMenuOpen?.();
  };

  return (
    <header className="sticky top-0 z-40 bg-gray-100 border-b border-gray-200">
      <div className="h-16 px-6 flex items-center justify-center relative">
        {/* Centered Title */}
        <h1 className="text-2xl font-semibold text-gray-900">Sonance Talent Management</h1>

        {/* Right Section */}
        <div className="flex items-center gap-3 flex-shrink-0 absolute right-6">
          {/* Role Switcher */}
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setRoleOpen(!roleOpen)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors capitalize"
              title="Switch role for testing"
            >
              {currentRole || 'admin'}
            </button>

            {roleOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button
                  onClick={() => {
                    onRoleChange?.('admin');
                    setRoleOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                    currentRole === 'admin' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Admin
                </button>
                <button
                  onClick={() => {
                    onRoleChange?.('leader');
                    setRoleOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                    currentRole === 'leader' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Leader
                </button>
                <button
                  onClick={() => {
                    onRoleChange?.('user');
                    setRoleOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                    currentRole === 'user' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  User
                </button>
              </div>
            )}
          </div>

          {/* More Options Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMenuToggle}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                  Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                  Help & Support
                </button>
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              title={userProfile?.full_name}
            >
              <Avatar
                name={userProfile?.full_name}
                picture={userProfile?.picture}
                size="sm"
              />
            </button>

            {avatarOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-3 px-3">
                {/* User Info Section */}
                <div className="mb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar
                      name={userProfile?.full_name}
                      picture={userProfile?.picture}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {userProfile?.full_name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {userProfile?.email}
                      </p>
                    </div>
                  </div>
                  <button className="w-full text-left text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors mt-2">
                    View account →
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-2"></div>

                {/* Sign Out */}
                <button className="w-full text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors font-medium">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
