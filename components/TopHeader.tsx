'use client';

import { useState, useRef, useEffect, useContext } from 'react';
import Avatar from './Avatar';
import { UserContext } from '@/context/UserContext';

interface TopHeaderProps {
  userProfile: any;
  onMenuOpen?: () => void;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
}

export default function TopHeader({ userProfile, onMenuOpen, currentRole, onRoleChange }: TopHeaderProps) {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const userContext = useContext(UserContext);

  const handleSignOut = async () => {
    setAvatarOpen(false);
    if (userContext?.logout) {
      await userContext.logout();
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setAvatarOpen(false);
      }
    }

    if (avatarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [avatarOpen]);

  return (
    <header className="sticky top-0 z-40 bg-gray-100 border-b border-gray-200">
      <div className="h-12 px-6 flex items-center justify-end relative">
        {/* Right Section */}
        <div className="flex items-center gap-2 flex-shrink-0 absolute right-6">
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
                  <div className="flex items-center gap-3">
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
                </div>

                {/* Sign Out */}
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors font-medium"
                >
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
