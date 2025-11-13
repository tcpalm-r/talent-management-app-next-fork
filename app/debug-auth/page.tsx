'use client';

import { useEffect, useState } from 'react';

export default function DebugAuthPage() {
  const [cookies, setCookies] = useState<Record<string, any>>({});
  const [apiData, setApiData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    // Parse cookies
    const cookieObj: Record<string, any> = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      try {
        cookieObj[name] = JSON.parse(decodeURIComponent(value));
      } catch {
        cookieObj[name] = decodeURIComponent(value);
      }
    });
    setCookies(cookieObj);

    // Fetch auth data
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setApiData(data))
      .catch(err => setApiData({ error: err.message }));

    // Fetch dashboard data
    fetch('/api/dashboard/data?organization_id=0f66e3c1-daf1-4f40-8cff-6eee3e3d72e3')
      .then(res => res.json())
      .then(data => {
        const thomas = data.employees?.find((e: any) =>
          e.email?.toLowerCase() === 'thomas.palmer@sonance.com'
        );
        setDashboardData({
          totalEmployees: data.employees?.length || 0,
          thomasPalmer: thomas || null
        });
      })
      .catch(err => setDashboardData({ error: err.message }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Auth Debug Page</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Browser Cookies
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify(cookies, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            /api/auth/me Response
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {apiData ? JSON.stringify(apiData, null, 2) : 'Loading...'}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            /api/dashboard/data Response (Thomas Palmer)
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {dashboardData ? JSON.stringify(dashboardData, null, 2) : 'Loading...'}
          </pre>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">
            Expected ID
          </h2>
          <p className="text-sm text-blue-800 font-mono">
            5b1e1ee7-5850-4b7f-8881-9304c17ab63f
          </p>
          <h2 className="text-xl font-semibold text-blue-900 mb-2 mt-4">
            Old Wrong ID
          </h2>
          <p className="text-sm text-blue-800 font-mono">
            7c511164-a69c-4a8c-913d-a691d3b169b5
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-2">
            To clear all auth state:
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
            <li>Open DevTools (F12)</li>
            <li>Go to Application → Cookies</li>
            <li>Delete all cookies for this site</li>
            <li>Go to Application → Local Storage → Clear</li>
            <li>Go to Application → Session Storage → Clear</li>
            <li>Do a hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
