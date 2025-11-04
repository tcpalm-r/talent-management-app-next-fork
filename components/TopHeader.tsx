'use client';

import { useState, useRef, useEffect, useContext } from 'react';
import Avatar from './Avatar';
import { UserContext } from '@/context/UserContext';
import { ChevronDown } from 'lucide-react';

interface TopHeaderProps {
  userProfile: any;
  onMenuOpen?: () => void;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  app_role: string;
  department?: string;
}

export default function TopHeader({ userProfile, onMenuOpen, currentRole, onRoleChange }: TopHeaderProps) {
  const [roleOpen, setRoleOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [switchedUser, setSwitchedUser] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const roleRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const userContext = useContext(UserContext);

  const handleSignOut = async () => {
    setAvatarOpen(false);
    if (userContext?.logout) {
      await userContext.logout();
    }
  };

  // Fetch users list when user dropdown opens
  useEffect(() => {
    if (userOpen && users.length === 0 && !loadingUsers) {
      fetchUsers();
    }
  }, [userOpen]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users/list');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserSwitch = async (user: User) => {
    try {
      const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        setSwitchedUser(user);
        setUserOpen(false);
        // Reload page to apply new user context
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to switch user:', error);
    }
  };

  const handleClearUserSwitch = () => {
    // Clear the x-switched-user cookie
    document.cookie = 'x-switched-user=; Max-Age=0; path=/;';
    setSwitchedUser(null);
    window.location.reload();
  };

  // Filter users - prioritize [TEST] users
  const filteredUsers = users.filter(u => {
    const query = userSearchQuery.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }).sort((a, b) => {
    // Sort to show [TEST] users first
    const aIsTest = a.full_name.includes('[TEST]');
    const bIsTest = b.full_name.includes('[TEST]');
    if (aIsTest && !bIsTest) return -1;
    if (!aIsTest && bIsTest) return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setRoleOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(event.target as Node)) {
        setAvatarOpen(false);
      }
    }

    if (roleOpen || userOpen || avatarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [roleOpen, userOpen, avatarOpen]);

  return (
    <header className="sticky top-0 z-40 bg-gray-100 border-b border-gray-200">
      <div className="h-12 px-6 flex items-center justify-end relative">
        {/* Right Section */}
        <div className="flex items-center gap-2 flex-shrink-0 absolute right-6">
          {/* User Switcher */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen(!userOpen)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors flex items-center gap-1"
              title="Switch test user for testing"
            >
              <span className="truncate max-w-[150px]">
                {switchedUser
                  ? switchedUser.full_name.replace('[TEST]', '').trim()
                  : userProfile?.full_name?.replace('[TEST]', '').trim() || 'User'}
              </span>
              <ChevronDown size={14} />
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                {/* Search Input */}
                <div className="px-3 py-2 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>

                {/* Users List */}
                <div className="max-h-64 overflow-y-auto">
                  {loadingUsers ? (
                    <div className="px-4 py-3 text-xs text-gray-500 text-center">
                      Loading users...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-500 text-center">
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleUserSwitch(user)}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {user.full_name}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {user.email} • {user.app_role}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Clear Switch Button */}
                {switchedUser && (
                  <div className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={handleClearUserSwitch}
                      className="w-full px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Clear user switch
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
