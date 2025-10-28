import { Settings } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Settings className="w-7 h-7 mr-2 text-blue-600" />
            Admin Settings
          </h2>
          <p className="text-gray-600 mt-1">Configure system settings and manage organization</p>
        </div>
      </div>

      {/* Settings sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placeholder cards for settings sections */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Organization Settings</h3>
          <p className="text-sm text-gray-600">Manage organization details and preferences</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">User Management</h3>
          <p className="text-sm text-gray-600">Add, edit, and manage user accounts</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">360 Review Settings</h3>
          <p className="text-sm text-gray-600">Configure review templates and questions</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications</h3>
          <p className="text-sm text-gray-600">Manage email notifications and reminders</p>
        </div>
      </div>
    </div>
  );
}
