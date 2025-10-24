'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as AppUser, Organization } from '@/types';
import Dashboard from '@/components/Dashboard';
import { TalentAppProvider } from '@/context/TalentAppContext';

// Fixed organization ID (no auth needed)
const FIXED_ORG_ID = 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f';

// Mock user for components that expect one
const mockUser = {
  id: 'mock-user-123',
  email: 'admin@test.com',
  user_metadata: { full_name: 'Admin User' }
} as any;

const mockUserProfile: AppUser = {
  id: 'mock-user-123',
  email: 'admin@test.com',
  full_name: 'Admin User',
  role: 'admin',
  organization_id: FIXED_ORG_ID
} as any;

export default function AppWrapper() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeePlans, setEmployeePlans] = useState<Record<string, any>>({});
  const [performanceReviews, setPerformanceReviews] = useState<Record<string, any>>({});
  const dashboardNavigatorRef = useRef<((view: string) => void) | null>(null);

  const handleRegisterNavigator = useCallback((fn: ((view: string) => void) | null) => {
    dashboardNavigatorRef.current = fn;
  }, []);

  const handleNavigateToView = useCallback((view: string) => {
    setCurrentView(view);
    dashboardNavigatorRef.current?.(view);
  }, []);

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load organization - first try to get any organization
      const { data: allOrgs, error: listError } = await supabase
        .from('organizations')
        .select('*');

      console.log('All organizations:', allOrgs);

      if (listError) {
        throw new Error(`Organization query failed: ${listError.message}`);
      }

      // Find our specific organization
      const org = allOrgs?.find(o => o.id === FIXED_ORG_ID) || allOrgs?.[0];

      if (!org) {
        throw new Error(`No organization found. Available: ${allOrgs?.map(o => o.id).join(', ')}`);
      }

      setOrganization(org);
    } catch (error) {
      console.error('Error loading organization:', error);
      setError(error instanceof Error ? error.message : 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-gray-200" aria-label="Sonance Talent Management is loading">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="sr-only">Sonance Talent Management</span>
                <div className="skeleton-text w-48 h-6" aria-hidden></div>
                <div className="skeleton-text w-24 h-5" aria-hidden></div>
              </div>
              <div className="skeleton-text w-32 h-10 rounded-lg" aria-hidden></div>
            </div>
          </div>
        </header>

        {/* Nav Skeleton */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton-text w-24 h-12"></div>
              ))}
            </div>
          </div>
        </nav>

        {/* Content Skeleton */}
        <main className="max-w-[1800px] mx-auto px-6 py-8">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <div key={i} className="skeleton-box h-48 rounded-lg"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full">
          <div className="text-red-500 text-center mb-6">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-center mb-3 text-gray-900">Sonance workspace unavailable</h2>
          <p className="text-sm text-gray-600 text-center mb-6">{error}</p>

          <div className="flex justify-center mb-6">
            <button
              onClick={loadOrganization}
              className="btn-primary"
            >
              Retry Connection
            </button>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-900 mb-2">
              First time setting up Sonance?
            </p>
            <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1">
              <li>Run <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">supabase-schema.sql</code></li>
              <li>Run <code className="px-1 py-0.5 bg-amber-100 rounded text-xs">supabase-seed.sql</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="text-lg font-semibold mb-2 text-gray-900">Sonance workspace not found</h2>
          <p className="text-sm text-gray-600 mb-6">We couldn’t load the sample organization for Sonance Talent Management.</p>
          <button
            onClick={loadOrganization}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <TalentAppProvider
      currentView={currentView}
      selectedDepartments={selectedDepartments}
      employees={employees}
      employeePlans={employeePlans}
      performanceReviews={performanceReviews}
      onNavigateToView={handleNavigateToView}
    >
      <div className="min-h-screen bg-gray-50">
        <Dashboard
          user={mockUser}
          userProfile={mockUserProfile}
          organization={organization}
          onViewChange={setCurrentView}
          onDepartmentsChange={setSelectedDepartments}
          onEmployeesChange={setEmployees}
          onPlansChange={setEmployeePlans}
          onReviewsChange={setPerformanceReviews}
          onRegisterNavigate={handleRegisterNavigator}
        />
      </div>
    </TalentAppProvider>
  );
}

