import { useState } from 'react';
import { Settings, Upload } from 'lucide-react';
import type { Department, UserRole } from '../types';
import DepartmentManager from './DepartmentManager';
import ImportModal from './ImportModal';
import { NavigationTabs } from './unified';

interface AdminDashboardProps {
  departments: Department[];
  onDepartmentUpdate: () => void;
  userRole: UserRole;
  organizationId: string;
  employeePlans: Record<string, any>;
  onPlansUpdate: (plans: Record<string, any>) => void;
  onImportComplete: () => void;
}

type AdminView = 'departments' | 'import';

export default function AdminDashboard({
  departments,
  onDepartmentUpdate,
  userRole,
  organizationId,
  employeePlans,
  onPlansUpdate,
  onImportComplete,
}: AdminDashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('departments');

  const tabs = [
    { id: 'departments', label: 'Departments', icon: Settings },
    { id: 'import', label: 'Import Data', icon: Upload },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <NavigationTabs
          tabs={tabs}
          activeTab={activeView}
          onTabChange={(tabId) => setActiveView(tabId as AdminView)}
        />

        {/* Content */}
        <div className="p-6">
          {activeView === 'departments' && (
            <DepartmentManager
              departments={departments}
              onDepartmentUpdate={onDepartmentUpdate}
              userRole={userRole}
              organizationId={organizationId}
              employeePlans={employeePlans}
              onPlansUpdate={onPlansUpdate}
            />
          )}

          {activeView === 'import' && (
            <ImportModal
              organizationId={organizationId}
              departments={departments}
              onImportComplete={onImportComplete}
              onClose={() => setActiveView('departments')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
