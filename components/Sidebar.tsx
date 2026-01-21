'use client';

import { RotateCw, Users, Settings, FileText } from 'lucide-react';
import { VennDiagramIcon } from './icons/VennDiagramIcon';
import { useMemo, useState, useRef, useEffect, useContext } from 'react';
import Avatar from './Avatar';
import { UserContext } from '@/context/UserContext';
import { useTeams } from '@/context/TeamsContext';
import { AUTH_DISABLED } from '@/lib/auth';
import { ThemeToggle, useToast } from './unified';

type View = '360-feedback' | 'my-report' | 'itp' | 'directory' | 'admin-settings';

interface TestUser {
  id: string;
  email: string;
  full_name: string;
  app_role: string;
  department: string | null;
  title: string | null;
}

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  userRole?: string;
  userProfile: any;
}

export default function Sidebar({ currentView, onViewChange, userRole, userProfile }: SidebarProps) {
  const { notify } = useToast();
  const { isInTeams } = useTeams();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const userContext = useContext(UserContext);

  const baseNavItems = [
    // { id: 'directory', label: 'Talent', icon: Users }, // Hidden for now
    { id: '360-feedback', label: '360°', icon: RotateCw },
    // { id: 'itp', label: 'ITP', icon: VennDiagramIcon }, // Moved to standalone app
    { id: 'my-report', label: 'Review', icon: FileText },
  ] as const;

  const leaderNavItems = [] as const;

  const adminNavItems = [
    { id: 'admin-settings', label: 'Admin', icon: Settings },
  ] as const;

  const navItems = useMemo(() => {
    const role = userRole?.toLowerCase();
    if (role === 'admin') {
      return [...baseNavItems, ...adminNavItems];
    } else if (role === 'leader' || role === 'slt') {
      return [...baseNavItems, ...leaderNavItems];
    }
    return baseNavItems;
  }, [userRole]);

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
        .catch(err => {
          console.error('[Sidebar] Failed to fetch test users:', err);
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [avatarOpen]);

  const handleSignOut = async () => {
    setAvatarOpen(false);
    if (userContext?.logout) {
      await userContext.logout();
    }
  };

  const handleSwitchUser = async (email: string) => {
    if (!AUTH_DISABLED) return;

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
    <aside className="w-20 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center">
      {/* User Profile Section */}
      <div className="w-full pt-4 pb-4 border-b border-gray-200 dark:border-gray-700 flex flex-col items-center relative" ref={avatarRef}>
        <button
          onClick={() => setAvatarOpen(!avatarOpen)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          title={userProfile?.full_name}
        >
          <Avatar
            name={userProfile?.full_name}
            picture={userProfile?.picture}
            size="md"
          />
        </button>

        {avatarOpen && (
          <div className="absolute left-20 top-4 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-3 px-3 z-50">
            {/* User Info Section */}
            <div className="mb-3">
              <div className="flex items-center gap-3">
                <Avatar
                  name={userProfile?.full_name}
                  picture={userProfile?.picture}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {userProfile?.full_name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {userProfile?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* User Switcher - Development Only */}
            {AUTH_DISABLED && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-2">
                    Switch User (Dev)
                  </p>
                  {loadingUsers ? (
                    <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading users...
                    </div>
                  ) : testUsers.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No test users found
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {testUsers.map((user) => {
                        const isCurrentUser = user.email === userProfile?.email;
                        const roleColors = {
                          admin: 'bg-purple-100 text-purple-700',
                          slt: 'bg-teal-100 text-teal-700',
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
                                ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 cursor-default'
                                : switching
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                                {user.full_name}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>
                                {user.app_role}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {user.title}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              </>
            )}

            {/* Return to Hub */}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors font-medium"
            >
              Return to Hub
            </button>
          </div>
        )}
      </div>

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
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {/* Left indicator bar with padding */}
              {isActive && (
                <div className="absolute left-1 top-1 bottom-1 w-1 bg-blue-600 dark:bg-blue-400" style={{ borderRadius: '1px' }} />
              )}
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[0.65rem] font-normal text-center leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pb-4 border-t border-gray-200 dark:border-gray-700 w-full flex flex-col items-center justify-center pt-4 gap-3">
        {/* Hide theme toggle in Teams - Teams controls the theme */}
        {!isInTeams && <ThemeToggle />}
        <p className="text-xs text-gray-500 dark:text-gray-400">v1</p>
      </div>
    </aside>
  );
}
