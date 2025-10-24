import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Palette, ArrowLeft, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateRandomColor } from '../lib/utils';
import type { Department, UserRole, Employee } from '../types';
import EmployeeCard from './EmployeeCard';
import EmployeeDetailModal from './EmployeeDetailModal';

interface DepartmentManagerProps {
  departments: Department[];
  onDepartmentUpdate: () => void;
  userRole: UserRole;
  organizationId: string;
  employeePlans?: Record<string, any>;
  onPlansUpdate?: (plans: Record<string, any>) => void;
}

interface EditingDepartment {
  id?: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280',
  '#1F2937', '#059669', '#DC2626', '#7C3AED', '#0891B2'
];

export default function DepartmentManager({
  departments,
  onDepartmentUpdate,
  userRole,
  organizationId,
  employeePlans = {},
  onPlansUpdate,
}: DepartmentManagerProps) {
  const [editing, setEditing] = useState<EditingDepartment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [departmentEmployees, setDepartmentEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});

  const canEdit = userRole === 'org_admin';

  // Load employee counts for all departments
  useEffect(() => {
    loadEmployeeCounts();
  }, [departments]);

  const loadEmployeeCounts = async () => {
    const counts: Record<string, number> = {};

    for (const dept of departments) {
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('department_id', dept.id);

      counts[dept.id] = count || 0;
    }

    setEmployeeCounts(counts);
  };

  const handleDepartmentDoubleClick = async (department: Department) => {
    setSelectedDepartment(department);
    setLoadingEmployees(true);

    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(*),
          assessment:assessments(*)
        `)
        .eq('department_id', department.id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      setDepartmentEmployees(data || []);
    } catch (err) {
      console.error('Error loading department employees:', err);
      setError('Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleBackToDepartments = () => {
    setSelectedDepartment(null);
    setDepartmentEmployees([]);
  };

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  const handleSavePlan = (plan: any) => {
    if (selectedEmployee && onPlansUpdate) {
      const updatedPlans = {
        ...employeePlans,
        [selectedEmployee.id]: plan
      };
      onPlansUpdate(updatedPlans);
    }
  };

  const startEditing = (department?: Department) => {
    if (!canEdit) return;
    
    setEditing({
      id: department?.id,
      name: department?.name || '',
      color: department?.color || generateRandomColor(),
    });
    setError('');
  };

  const cancelEditing = () => {
    setEditing(null);
    setError('');
  };

  const saveDepartment = async () => {
    if (!editing || !editing.name.trim()) {
      setError('Department name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editing.id) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: editing.name.trim(),
            color: editing.color,
          })
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert({
            organization_id: organizationId,
            name: editing.name.trim(),
            color: editing.color,
          });

        if (error) throw error;
      }

      setEditing(null);
      onDepartmentUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDepartment = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department? This will remove the department from all employees.')) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;

      onDepartmentUpdate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // If a department is selected, show the drill-down view
  if (selectedDepartment) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDepartments}
                className="flex items-center px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Departments
              </button>
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full mr-3 border-2 border-gray-200"
                  style={{ backgroundColor: selectedDepartment.color }}
                />
                <div>
                  <h2 className="text-xl font-semibold">{selectedDepartment.name}</h2>
                  <p className="text-sm text-gray-500">
                    {departmentEmployees.length} {departmentEmployees.length === 1 ? 'employee' : 'employees'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loadingEmployees ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading employees...</p>
            </div>
          ) : departmentEmployees.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UsersIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No employees in this department</h3>
              <p className="text-sm">Employees will appear here once they are assigned to this department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {departmentEmployees.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  department={selectedDepartment}
                  showMenu={false}
                  onCardClick={handleEmployeeClick}
                  employeePlan={employeePlans[employee.id]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Employee Detail Modal */}
        {selectedEmployee && (
          <EmployeeDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false);
              setSelectedEmployee(null);
            }}
            employee={selectedEmployee}
            department={selectedDepartment}
            employeePlan={employeePlans[selectedEmployee.id]}
            initialTab="details"
            initialReviewType="manager"
            onSavePlan={handleSavePlan}
            onUpdateEmployee={() => {
              // Reload department employees
              handleDepartmentDoubleClick(selectedDepartment);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Departments ({departments.length})</h2>
          {canEdit && (
            <button
              onClick={() => startEditing()}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Department
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
      
      <div className="p-6">
        {/* New/Edit Department Form */}
        {editing && (
          <div className="border border-blue-200 rounded-lg p-4 mb-6 bg-blue-50">
            <h3 className="text-lg font-medium mb-4">
              {editing.id ? 'Edit Department' : 'Add New Department'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter department name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-gray-300"
                    style={{ backgroundColor: editing.color }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditing({ ...editing, color })}
                        className={`w-6 h-6 rounded-full border-2 ${
                          editing.color === color ? 'border-gray-900' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <input
                  type="color"
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="mt-2 w-16 h-8 border border-gray-300 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={cancelEditing}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="w-4 h-4 mr-2 inline" />
                Cancel
              </button>
              <button
                onClick={saveDepartment}
                disabled={loading || !editing.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2 inline" />
                {loading ? 'Saving...' : editing.id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Departments List */}
        {departments.length === 0 && !editing ? (
          <div className="text-center py-8 text-gray-500">
            <Palette className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No departments yet</h3>
            <p className="text-sm">
              {canEdit ? 'Create your first department to organize employees.' : 'No departments have been created.'}
            </p>
            {canEdit && (
              <button
                onClick={() => startEditing()}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Department
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {departments.map((department) => (
              <div
                key={department.id}
                onClick={() => handleDepartmentDoubleClick(department)}
                className="border rounded-lg p-4 hover:bg-gray-50 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                title="Click to view employees in this department"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center flex-1">
                    <div
                      className="w-8 h-8 rounded-full mr-4 border-2 border-gray-200 group-hover:border-gray-300 transition-colors"
                      style={{ backgroundColor: department.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {department.name}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <UsersIcon className="w-3 h-3 mr-1" />
                          {employeeCounts[department.id] || 0} {employeeCounts[department.id] === 1 ? 'employee' : 'employees'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Created {new Date(department.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 group-hover:text-blue-500 transition-colors">
                        💡 Click to view employees
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(department);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Edit department"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDepartment(department.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && departments.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Processing...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}