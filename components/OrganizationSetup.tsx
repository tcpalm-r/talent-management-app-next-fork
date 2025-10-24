import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Building2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User, Organization } from '../types';

interface OrganizationSetupProps {
  user: SupabaseUser;
  userProfile: User;
  onOrganizationCreated: (org: Organization) => void;
}

export default function OrganizationSetup({
  user,
  userProfile,
  onOrganizationCreated,
}: OrganizationSetupProps) {
  const [organizationName, setOrganizationName] = useState(
    user.user_metadata?.organization_name || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationName.trim()) {
      setError('Organization name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create organization
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName.trim(),
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create user profile or update existing one
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          organization_id: organization.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || userProfile?.full_name,
          role: 'org_admin',
        });

      if (userError) throw userError;

      // Insert default box definitions for the organization
      const { error: boxError } = await supabase.rpc(
        'insert_default_box_definitions',
        { org_id: organization.id }
      );

      if (boxError) {
        console.warn('Could not create default box definitions:', boxError);
      }

      onOrganizationCreated(organization);
    } catch (err: any) {
      setError(err.message);
      console.error('Error creating organization:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Set up your organization
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Let's create your organization to get started with talent assessment
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleCreateOrganization}>
          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
              Organization Name
            </label>
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter your company name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !organizationName.trim()}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Organization...
              </div>
            ) : (
              <div className="flex items-center">
                Create Organization
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-gray-500">
          <p>
            Welcome, <strong>{user.email}</strong>
          </p>
          <p className="mt-1">
            You'll be set up as the organization administrator
          </p>
        </div>
      </div>
    </div>
  );
}