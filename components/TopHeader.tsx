'use client';

import { useState, useRef, useEffect, useContext } from 'react';
import Avatar from './Avatar';
import { UserContext } from '@/context/UserContext';
import { AUTH_DISABLED, TEST_USERS } from '@/lib/auth';
import { useToast } from './unified';

interface TestUser {
  id: string;
  email: string;
  full_name: string;
  app_role: string;
  department: string | null;
  title: string | null;
}

interface TopHeaderProps {
  userProfile: any;
  onMenuOpen?: () => void;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
}

export default function TopHeader({ userProfile, onMenuOpen, currentRole, onRoleChange }: TopHeaderProps) {
  const { notify } = useToast();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const userContext = useContext(UserContext);

  // Fetch test users when avatar menu opens (only in dev mode)
  useEffect(() => {
    if (avatarOpen && AUTH_DISABLED && testUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true);
      fetch('/api/auth/switch-user')
        .then(res => res.json())
        .then(data => {
          if (data.users) {
            setTestUsers(data.users);
          }
        })
        .catch(() => {
          // Silent fail for test user fetch
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [avatarOpen]); // Remove testUsers.length and loadingUsers from deps to prevent loop

  const handleSignOut = async () => {
    setAvatarOpen(false);
    if (userContext?.logout) {
      await userContext.logout();
    }
  };

  const handleSwitchUser = async (email: string) => {
    if (!AUTH_DISABLED) return; // Safety check

    setSwitching(true);
    try {
      const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        // Reload page to apply new user context
        window.location.reload();
      } else {
        const data = await response.json();
        console.error('Failed to switch user:', data.error);
        notify({
          title: 'Error',
          description: 'Failed to switch user: ' + data.error,
          variant: 'error',
        });
        setSwitching(false);
      }
    } catch (error) {
      console.error('Error switching user:', error);
      notify({
        title: 'Error',
        description: 'Error switching user',
        variant: 'error',
      });
      setSwitching(false);
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
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              title={userProfile?.full_name}
            >
              <Avatar
                name={userProfile?.full_name}
                picture={userProfile?.picture}
                size="sm"
              />
            </button>

            {avatarOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-3 px-3">
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

                {/* User Switcher - Development Only */}
                {AUTH_DISABLED && (
                  <>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
                        Switch User (Dev)
                      </p>
                      {loadingUsers ? (
                        <div className="px-2 py-4 text-center text-sm text-gray-500">
                          Loading users...
                        </div>
                      ) : testUsers.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-gray-500">
                          No test users found
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {testUsers.map((user) => {
                            const isCurrentUser = user.email === userProfile?.email;
                            const roleColors = {
                              admin: 'bg-purple-100 text-purple-700',
                              leader: 'bg-blue-100 text-blue-700',
                              user: 'bg-gray-100 text-gray-700',
                            };
                            const roleColor = roleColors[user.app_role as keyof typeof roleColors] || roleColors.user;

                            return (
                              <button
                                key={user.email}
                                onClick={() => handleSwitchUser(user.email)}
                                disabled={isCurrentUser || switching}
                                className={`w-full text-left px-2 py-2 text-sm rounded transition-colors ${
                                  isCurrentUser
                                    ? 'bg-blue-50 border border-blue-200 cursor-default'
                                    : switching
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-medium text-gray-900">
                                    {user.full_name}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>
                                    {user.app_role}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                  {user.title}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                  </>
                )}

                {/* Return to Hub */}
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-2 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium"
                >
                  Return to Hub
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
