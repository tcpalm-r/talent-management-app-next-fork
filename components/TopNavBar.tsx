'use client';

import { useState, useRef, useEffect, useContext } from 'react';
import { Settings, LogOut, User, ChevronDown, Check, Loader2 } from 'lucide-react';
import { ThreeSixtyLogo } from './icons/ThreeSixtyLogo';
import Avatar from './Avatar';
import { UserContext } from '@/context/UserContext';
import { AUTH_DISABLED } from '@/lib/auth';
import { useToast } from './unified';

interface TestUser {
  id: string;
  email: string;
  full_name: string;
  app_role: string;
  department: string | null;
  title: string | null;
}

interface TopNavBarProps {
  userProfile: any;
  userRole?: string;
  showAdminSettings?: boolean;
  onAdminClick?: () => void;
  isAdminView?: boolean;
}

const roleColors: Record<string, string> = {
  admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  slt: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  leader: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  user: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function TopNavBar({
  userProfile,
  userRole,
  showAdminSettings,
  onAdminClick,
  isAdminView,
}: TopNavBarProps) {
  const { notify } = useToast();
  const userContext = useContext(UserContext);

  const [devSwitcherOpen, setDevSwitcherOpen] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [switching, setSwitching] = useState(false);
  const devSwitcherRef = useRef<HTMLDivElement>(null);

  // Fetch test users when dev switcher opens
  useEffect(() => {
    if (devSwitcherOpen && AUTH_DISABLED && testUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true);
      fetch('/api/auth/switch-user')
        .then(res => res.json())
        .then(data => {
          if (data.users) setTestUsers(data.users);
        })
        .catch(err => {
          console.error('[TopNavBar] Failed to fetch test users:', err);
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [devSwitcherOpen]);

  // Click outside to close dev switcher
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (devSwitcherRef.current && !devSwitcherRef.current.contains(event.target as Node)) {
        setDevSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    if (userContext?.logout) {
      await userContext.logout();
    }
  };

  const handleSwitchUser = async (email: string) => {
    if (!AUTH_DISABLED || email === userProfile?.email) {
      setDevSwitcherOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <header className="bg-sonance-charcoal text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Left: Logo + User Name */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/90 backdrop-blur-sm">
            <ThreeSixtyLogo size={32} />
          </div>
          <span className="text-base font-medium">{userProfile?.full_name || userProfile?.email || 'User'}</span>
        </div>

        {/* Right: Admin + Dev Switch + Sign Out */}
        <div className="flex items-center gap-2">
          {/* Admin Settings Button */}
          {showAdminSettings && (
            <button
              onClick={onAdminClick}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                isAdminView
                  ? 'text-white bg-white/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {/* Dev User Switcher */}
          {AUTH_DISABLED && (
            <div className="relative" ref={devSwitcherRef}>
              <button
                onClick={() => setDevSwitcherOpen(!devSwitcherOpen)}
                disabled={switching}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white/80
                           hover:text-white hover:bg-white/10 rounded-lg transition-all
                           duration-200 disabled:opacity-50 border border-yellow-500/50
                           bg-yellow-500/10"
              >
                {switching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Dev Switch</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${devSwitcherOpen ? 'rotate-180' : ''}`} />
              </button>

              {devSwitcherOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-sonance-charcoal-dark
                                border border-white/20 rounded-lg shadow-xl z-50
                                overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10">
                    <span className="text-xs text-yellow-400 font-medium">
                      DEV MODE - Switch User
                    </span>
                  </div>

                  {loadingUsers ? (
                    <div className="px-3 py-4 text-center text-white/60 text-sm">
                      Loading users...
                    </div>
                  ) : testUsers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-white/60 text-sm">
                      No test users found
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {testUsers.map(user => {
                        const isCurrent = user.email === userProfile?.email;
                        const roleClass = roleColors[user.app_role] || roleColors.user;

                        return (
                          <button
                            key={user.id}
                            onClick={() => handleSwitchUser(user.email)}
                            disabled={switching}
                            className={`w-full px-3 py-2.5 text-left hover:bg-white/10
                                        transition-colors flex items-start gap-3
                                        disabled:opacity-50
                                        ${isCurrent ? 'bg-white/5' : ''}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white font-medium truncate">
                                  {user.full_name}
                                </span>
                                {isCurrent && (
                                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                )}
                              </div>
                              <div className="text-xs text-white/50 truncate">
                                {user.email}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${roleClass}`}>
                                  {user.app_role}
                                </span>
                                {user.title && (
                                  <span className="text-xs text-white/40 truncate">
                                    {user.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-white/80
                       hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
