'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  app_role: string;
  department: string | null;
}

interface UserSwitcherProps {
  currentUserId: string;
  onUserSwitch: () => void;
}

/**
 * UserSwitcher Component
 * 
 * Only visible in local development mode (when NEXT_PUBLIC_DISABLE_AUTH=true).
 * Allows switching between different users for testing purposes.
 */
export default function UserSwitcher({ currentUserId, onUserSwitch }: UserSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check if we're in dev mode (client-side check)
  // Only NEXT_PUBLIC_ prefixed env vars are available on the client
  // Double safety: Check both NODE_ENV and DISABLE_AUTH to prevent showing in production
  const isDevMode = typeof window !== 'undefined' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true';

  // Fetch users when dropdown opens
  useEffect(() => {
    if (isOpen && users.length === 0) {
      fetchUsers();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Don't render if not in dev mode (moved AFTER hooks to comply with Rules of Hooks)
  if (!isDevMode) {
    return null;
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/users/list');
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('[UserSwitcher] Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to switch user');
      }

      const data = await response.json();
      console.log('[UserSwitcher] Switched to user:', data.user.email);
      
      setIsOpen(false);
      
      // Refresh the page to apply the new user context
      window.location.reload();
    } catch (err) {
      console.error('[UserSwitcher] Error switching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch user');
    } finally {
      setLoading(false);
    }
  };

  const currentUser = users.find(u => u.id === currentUserId);

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.app_role.toLowerCase().includes(query) ||
      (user.department && user.department.toLowerCase().includes(query))
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        title="Switch user (dev mode only)"
      >
        <span className="text-[10px] uppercase text-gray-500 font-semibold">Dev:</span>
        <span className="truncate max-w-[120px]">
          {currentUser?.full_name || 'Switch User'}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700">Switch User (Dev Mode)</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Only visible in local development</p>
          </div>

          {/* Search Bar */}
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 rounded-md focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && users.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                Loading users...
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-center text-sm text-red-600">
                {error}
              </div>
            ) : users.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No users found
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No users match your search
              </div>
            ) : (
              <div className="py-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSwitchUser(user.id)}
                    disabled={loading || user.id === currentUserId}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      user.id === currentUserId
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-gray-50 text-gray-900'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{user.full_name}</span>
                        {user.id === currentUserId && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {user.email}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded uppercase font-semibold">
                          {user.app_role}
                        </span>
                        {user.department && (
                          <span className="text-[10px] text-gray-500 truncate">
                            {user.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

