'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  app_role: string;
  department: string | null;
}

interface UserSwitcherProps {
  currentUser: {
    id: string;
    full_name: string;
    email: string;
  };
}

export default function UserSwitcher({ currentUser }: UserSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users/list');
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleSwitchUser = async (userId: string) => {
    try {
      const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error('Failed to switch user');

      // Reload page to apply new user context
      window.location.reload();
    } catch (err) {
      console.error('Error switching user:', err);
      alert('Failed to switch user');
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
        title="Switch user (dev only)"
      >
        <Users className="w-4 h-4" />
        <span className="hidden sm:inline">Dev: Switch User</span>
        <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
          {/* Current User */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Currently logged in as:</p>
            <p className="font-semibold text-gray-900">{currentUser.full_name}</p>
            <p className="text-xs text-gray-500">{currentUser.email}</p>
          </div>

          {/* User List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading users...</div>
            ) : error ? (
              <div className="px-4 py-3 text-sm text-red-600">{error}</div>
            ) : users.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSwitchUser(user.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition ${
                    user.id === currentUser.id ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 rounded">
                          {user.app_role}
                        </span>
                        {user.department && (
                          <span className="inline-block px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded">
                            {user.department}
                          </span>
                        )}
                      </div>
                    </div>
                    {user.id === currentUser.id && (
                      <div className="text-green-600 font-bold">✓</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border-t border-gray-200 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
