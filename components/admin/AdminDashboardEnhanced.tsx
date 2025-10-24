import { useState } from 'react';
import { BarChart3, AlertTriangle, Settings as SettingsIcon, Upload, Activity, Palette } from 'lucide-react';
import type { Department, UserRole } from '../../types';
import OrganizationMetrics from './OrganizationMetrics';
import DataQualityPanel from './DataQualityPanel';
import BoxDefinitionsManager from './BoxDefinitionsManager';
import ActivityAuditLog from './ActivityAuditLog';
import DepartmentManager from '../DepartmentManager';
import ImportModal from '../ImportModal';

interface AdminDashboardEnhancedProps {
  departments: Department[];
  onDepartmentUpdate: () => void;
  userRole: UserRole;
  organizationId: string;
  employees: any[];
  employeePlans: Record<string, any>;
  onPlansUpdate: (plans: Record<string, any>) => void;
  onImportComplete: () => void;
}

type AdminView = 'overview' | 'data-quality' | 'departments' | 'box-config' | 'audit-log' | 'import';

export default function AdminDashboardEnhanced({
  departments,
  onDepartmentUpdate,
  userRole,
  organizationId,
  employees,
  employeePlans,
  onPlansUpdate,
  onImportComplete,
}: AdminDashboardEnhancedProps) {
  const [activeView, setActiveView] = useState<AdminView>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3, color: 'blue' },
    { id: 'data-quality', label: 'Data Quality', icon: AlertTriangle, color: 'amber' },
    { id: 'departments', label: 'Departments', icon: SettingsIcon, color: 'purple' },
    { id: 'box-config', label: '9-Box Config', icon: Palette, color: 'pink' },
    { id: 'audit-log', label: 'Audit Log', icon: Activity, color: 'teal' },
    { id: 'import', label: 'Import Data', icon: Upload, color: 'green' },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setActiveView(id as AdminView)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeView === id
                  ? `border-${color}-600 text-${color}-600 bg-${color}-50`
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeView === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h2>
                <p className="text-gray-600">
                  Monitor organization health, manage data quality, and configure system settings
                </p>
              </div>
              <OrganizationMetrics
                employees={employees}
                departments={departments}
                employeePlans={employeePlans}
              />
            </div>
          )}

          {activeView === 'data-quality' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Quality</h2>
                <p className="text-gray-600">
                  Identify and resolve data completeness and accuracy issues
                </p>
              </div>
              <DataQualityPanel
                employees={employees}
                departments={departments}
              />
            </div>
          )}

          {activeView === 'departments' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Department Management</h2>
                <p className="text-gray-600">
                  Create, edit, and organize departments across your organization
                </p>
              </div>
              <DepartmentManager
                departments={departments}
                onDepartmentUpdate={onDepartmentUpdate}
                userRole={userRole}
                organizationId={organizationId}
                employeePlans={employeePlans}
                onPlansUpdate={onPlansUpdate}
              />
            </div>
          )}

          {activeView === 'box-config' && (
            <div className="space-y-6">
              <BoxDefinitionsManager
                organizationId={organizationId}
                onUpdate={onDepartmentUpdate}
              />
            </div>
          )}

          {activeView === 'audit-log' && (
            <div className="space-y-6">
              <ActivityAuditLog organizationId={organizationId} />
            </div>
          )}

          {activeView === 'import' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Data</h2>
                <p className="text-gray-600">
                  Bulk import employees and assessments from CSV files
                </p>
              </div>
              <ImportModal
                organizationId={organizationId}
                departments={departments}
                onImportComplete={onImportComplete}
                onClose={() => setActiveView('overview')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {activeView === 'overview' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveView('data-quality')}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
            >
              <AlertTriangle className="w-6 h-6 text-amber-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900 group-hover:text-amber-900">
                Check Data Quality
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Identify missing or incomplete data
              </p>
            </button>

            <button
              onClick={() => setActiveView('import')}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left group"
            >
              <Upload className="w-6 h-6 text-green-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900 group-hover:text-green-900">
                Import Employees
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Bulk upload from CSV file
              </p>
            </button>

            <button
              onClick={() => setActiveView('departments')}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
            >
              <SettingsIcon className="w-6 h-6 text-purple-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900 group-hover:text-purple-900">
                Manage Departments
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Add or edit department structure
              </p>
            </button>

            <button
              onClick={() => setActiveView('box-config')}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-all text-left group"
            >
              <Palette className="w-6 h-6 text-pink-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900 group-hover:text-pink-900">
                Customize 9-Box
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Change labels, colors & descriptions
              </p>
            </button>

            <button
              onClick={() => setActiveView('audit-log')}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all text-left group"
            >
              <Activity className="w-6 h-6 text-teal-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900 group-hover:text-teal-900">
                View Audit Log
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Track all system changes
              </p>
            </button>

            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-left opacity-50">
              <div className="w-6 h-6 bg-gray-200 rounded mb-2" />
              <p className="text-sm font-semibold text-gray-600">
                More Features
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coming soon...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
