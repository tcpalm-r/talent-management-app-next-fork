import { useState } from 'react';
import { X, Shield, Users, AlertTriangle, Plus, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';
import type { Employee, Department } from '../types';
import { EmployeeNameLink } from './unified';

interface CriticalRoleSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  department?: Department;
  onSave: (data: {
    hasEmergencyBackup: boolean;
    emergencyBackupId?: string;
    successorIds: string[];
    developmentPlan: string;
    timelineMonths: number;
    keyResponsibilities: string[];
  }) => void;
  availableEmployees: Employee[];
}

export default function CriticalRoleSetupModal({
  isOpen,
  onClose,
  employee,
  department,
  onSave,
  availableEmployees
}: CriticalRoleSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<'backup' | 'successors' | 'plan'>(('backup'));
  const [hasEmergencyBackup, setHasEmergencyBackup] = useState(false);
  const [emergencyBackupId, setEmergencyBackupId] = useState<string>('');
  const [successorIds, setSuccessorIds] = useState<string[]>([]);
  const [developmentPlan, setDevelopmentPlan] = useState('');
  const [timelineMonths, setTimelineMonths] = useState(12);
  const [keyResponsibilities, setKeyResponsibilities] = useState<string[]>(['']);

  if (!isOpen) return null;

  const handleAddResponsibility = () => {
    setKeyResponsibilities([...keyResponsibilities, '']);
  };

  const handleRemoveResponsibility = (index: number) => {
    setKeyResponsibilities(keyResponsibilities.filter((_, i) => i !== index));
  };

  const handleResponsibilityChange = (index: number, value: string) => {
    const updated = [...keyResponsibilities];
    updated[index] = value;
    setKeyResponsibilities(updated);
  };

  const handleSave = () => {
    onSave({
      hasEmergencyBackup,
      emergencyBackupId: hasEmergencyBackup ? emergencyBackupId : undefined,
      successorIds,
      developmentPlan,
      timelineMonths,
      keyResponsibilities: keyResponsibilities.filter(r => r.trim() !== '')
    });
    onClose();
  };

  const canProceed = () => {
    if (currentStep === 'backup') {
      return !hasEmergencyBackup || (hasEmergencyBackup && emergencyBackupId);
    }
    if (currentStep === 'successors') {
      return successorIds.length > 0;
    }
    return true;
  };

  const filteredEmployees = availableEmployees.filter(e =>
    e.id !== employee.id &&
    e.department_id === employee.department_id
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Setup Critical Role</h2>
                <p className="text-sm text-amber-100">
                  <EmployeeNameLink
                    employee={employee}
                    className="font-semibold text-white/90 hover:text-white focus-visible:ring-white"
                    onClick={(event) => event.stopPropagation()}
                  />{' '}
                  - {employee.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex-1 h-2 rounded-full ${currentStep === 'backup' ? 'bg-white' : 'bg-white/60'}`} />
            <div className={`flex-1 h-2 rounded-full ${currentStep === 'successors' ? 'bg-white' : 'bg-white/40'}`} />
            <div className={`flex-1 h-2 rounded-full ${currentStep === 'plan' ? 'bg-white' : 'bg-white/40'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Emergency Backup */}
          {currentStep === 'backup' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">Emergency Backup Required</h3>
                    <p className="text-sm text-amber-800">
                      Identify someone who can temporarily cover this role in case of unexpected absence (vacation, sick leave, etc.)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="hasBackup"
                    checked={hasEmergencyBackup}
                    onChange={(e) => {
                      setHasEmergencyBackup(e.target.checked);
                      if (!e.target.checked) setEmergencyBackupId('');
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="hasBackup" className="text-sm font-medium text-gray-900">
                    I have identified an emergency backup person
                  </label>
                </div>

                {hasEmergencyBackup && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Emergency Backup
                    </label>
                    <select
                      value={emergencyBackupId}
                      onChange={(e) => setEmergencyBackupId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Choose someone...</option>
                      {filteredEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} - {emp.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!hasEmergencyBackup && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      You can skip this step and add an emergency backup later. However, it's recommended to identify one as soon as possible.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Successor Identification */}
          {currentStep === 'successors' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Identify Potential Successors</h3>
                    <p className="text-sm text-blue-800">
                      Select 1-3 employees who could potentially fill this role in the future. These are people you'll develop as successors.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Successor Candidates (at least 1)
                </label>
                <div className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {filteredEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No other employees in {department?.name || 'this department'} to select as successors.
                    </p>
                  ) : (
                    filteredEmployees.map(emp => (
                      <label
                        key={emp.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={successorIds.includes(emp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSuccessorIds([...successorIds, emp.id]);
                            } else {
                              setSuccessorIds(successorIds.filter(id => id !== emp.id));
                            }
                          }}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{emp.name}</p>
                          <p className="text-sm text-gray-600">{emp.title}</p>
                          {emp.assessment && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                Perf: {emp.assessment.performance?.toUpperCase()}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                Pot: {emp.assessment.potential?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>

                {successorIds.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-900">
                      ✓ {successorIds.length} successor candidate{successorIds.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Development Plan */}
          {currentStep === 'plan' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-purple-900 mb-1">Succession Development Plan</h3>
                    <p className="text-sm text-purple-800">
                      Define how you'll develop the selected successors and key responsibilities they need to master.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Development Timeline (months)
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="36"
                    value={timelineMonths}
                    onChange={(e) => setTimelineMonths(parseInt(e.target.value) || 12)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">How long to develop successors (3-36 months)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall Development Plan
                  </label>
                  <textarea
                    value={developmentPlan}
                    onChange={(e) => setDevelopmentPlan(e.target.value)}
                    placeholder="Describe the overall approach to developing successors (training, mentoring, stretch assignments, etc.)"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Key Responsibilities to Master
                    </label>
                    <button
                      onClick={handleAddResponsibility}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {keyResponsibilities.map((resp, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={resp}
                          onChange={(e) => handleResponsibilityChange(index, e.target.value)}
                          placeholder={`Responsibility ${index + 1}`}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        {keyResponsibilities.length > 1 && (
                          <button
                            onClick={() => handleRemoveResponsibility(index)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Step {currentStep === 'backup' ? '1' : currentStep === 'successors' ? '2' : '3'} of 3
          </div>
          <div className="flex gap-3">
            {currentStep !== 'backup' && (
              <button
                onClick={() => {
                  if (currentStep === 'successors') setCurrentStep('backup');
                  if (currentStep === 'plan') setCurrentStep('successors');
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            {currentStep !== 'plan' ? (
              <button
                onClick={() => {
                  if (currentStep === 'backup') setCurrentStep('successors');
                  if (currentStep === 'successors') setCurrentStep('plan');
                }}
                disabled={!canProceed()}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 font-medium transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Setup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
