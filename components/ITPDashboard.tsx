'use client';

import { ITPSelfAssessment } from './ITPSelfAssessment';
import type { Employee } from '@/types';

interface ITPDashboardProps {
  currentUser?: Employee;
  organizationId: string;
}

export default function ITPDashboard({ currentUser, organizationId }: ITPDashboardProps) {
  if (!currentUser?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading user information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Ideal Team Player Self-Assessment
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Rate yourself on the 12 core behaviors across Humble, Hungry, and People Smart virtues.
        </p>
      </div>

      {/* ITP Self Assessment Component */}
      <ITPSelfAssessment
        employeeId={currentUser.id}
        employeeName={currentUser.name || 'User'}
        currentUserId={currentUser.id}
        isViewOnly={false}
      />
    </div>
  );
}
