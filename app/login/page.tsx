'use client';

import { useEffect } from 'react';

/**
 * Login Page
 * Redirects to Auth0 login endpoint
 */
export default function LoginPage() {
  useEffect(() => {
    // Redirect to Auth0 login
    window.location.href = '/api/auth/login';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-md shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sonance Talent Management</h1>
        <p className="text-gray-600 mb-6">Redirecting to login...</p>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  );
}
