'use client';

import { Settings, Pencil, Save, X, User, Shield, HelpCircle, Search, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getActiveUsers, updateUserProfile, UserProfile } from '@/lib/supabase';
import { QUESTION_LIBRARY, DEFAULT_QUESTION_IDS } from '@/lib/feedback360QuestionBank';

type EditableEmployee = UserProfile & {
  isEditing?: boolean;
};

// Component for managing default 360 questions
function Default360QuestionsManager() {
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(DEFAULT_QUESTION_IDS);
  const [customQuestions, setCustomQuestions] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState('');

  useEffect(() => {
    loadDefaultQuestions();
  }, []);

  const loadDefaultQuestions = async () => {
    try {
      const response = await fetch('/api/360-default-questions');
      if (response.ok) {
        const data = await response.json();
        if (data.defaultQuestionIds && data.defaultQuestionIds.length === 3) {
          setSelectedQuestions(data.defaultQuestionIds);
        }
        if (data.customQuestions) {
          setCustomQuestions(data.customQuestions);
        }
      }
    } catch (error) {
      console.error('Error loading default questions:', error);
    }
  };

  const saveDefaultQuestions = async () => {
    if (selectedQuestions.length !== 3) {
      alert('Please select exactly 3 questions');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/360-default-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultQuestionIds: selectedQuestions,
          customQuestions: customQuestions
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        setShowCustomInput(false);
        setCustomQuestionText('');
        alert('Default questions updated successfully!');
      } else {
        alert('Failed to save default questions');
      }
    } catch (error) {
      console.error('Error saving default questions:', error);
      alert('Failed to save default questions');
    }
    setSaving(false);
  };

  const addCustomQuestion = () => {
    if (!customQuestionText.trim()) {
      alert('Please enter a question');
      return;
    }

    const customId = `custom-${Date.now()}`;
    setCustomQuestions(prev => ({
      ...prev,
      [customId]: customQuestionText.trim()
    }));

    if (selectedQuestions.length < 3) {
      setSelectedQuestions(prev => [...prev, customId]);
    }

    setCustomQuestionText('');
    setShowCustomInput(false);
  };

  const toggleQuestion = (questionId: string) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(prev => prev.filter(id => id !== questionId));
    } else {
      if (selectedQuestions.length < 3) {
        setSelectedQuestions(prev => [...prev, questionId]);
      }
    }
  };

  const getQuestionText = (questionId: string): string => {
    // Check if it's a custom question
    if (customQuestions[questionId]) {
      return customQuestions[questionId];
    }

    // Check template questions
    for (const category of QUESTION_LIBRARY) {
      const question = category.questions.find(q => q.id === questionId);
      if (question) return question.text;
    }
    return questionId;
  };

  const isCustomQuestion = (questionId: string): boolean => {
    return questionId.startsWith('custom-');
  };

  const deleteCustomQuestion = (questionId: string) => {
    setCustomQuestions(prev => {
      const newCustom = { ...prev };
      delete newCustom[questionId];
      return newCustom;
    });
    setSelectedQuestions(prev => prev.filter(id => id !== questionId));
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              360 Review Default Questions
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Select 3 questions that everyone must answer in 360 reviews
            </p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Change Questions
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={saveDefaultQuestions}
                disabled={saving || selectedQuestions.length !== 3}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  loadDefaultQuestions();
                }}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {!isEditing ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700 mb-3">Current Default Questions:</p>
            {selectedQuestions.map((qId, index) => (
              <div key={qId} className="flex items-start p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">{getQuestionText(qId)}</p>
                  {isCustomQuestion(qId) && (
                    <span className="text-xs text-blue-600 font-medium mt-1 inline-block">Custom Question</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Selected: {selectedQuestions.length}/3</strong>
                {selectedQuestions.length < 3 && ' - Please select 3 questions'}
                {selectedQuestions.length === 3 && ' - Ready to save!'}
              </p>
            </div>

            {/* Custom Questions Section */}
            {Object.keys(customQuestions).length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-gray-900 text-sm">Your Custom Questions</h4>
                <div className="space-y-2">
                  {Object.entries(customQuestions).map(([id, text]) => {
                    const isSelected = selectedQuestions.includes(id);
                    const canSelect = selectedQuestions.length < 3 || isSelected;

                    return (
                      <div
                        key={id}
                        className={`flex items-start p-3 border rounded-lg ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => canSelect && toggleQuestion(id)}
                          disabled={!canSelect}
                          className="mt-1 mr-3"
                        />
                        <span className="text-sm text-gray-700 flex-1">{text}</span>
                        <button
                          onClick={() => deleteCustomQuestion(id)}
                          className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete custom question"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Custom Question Button/Input */}
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 text-sm font-medium"
              >
                + Add Custom Question
              </button>
            ) : (
              <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Write your custom question:
                </label>
                <textarea
                  value={customQuestionText}
                  onChange={(e) => setCustomQuestionText(e.target.value)}
                  placeholder="Enter your custom question here..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={addCustomQuestion}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Add Question
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomQuestionText('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Template Questions */}
            <h4 className="font-semibold text-gray-900 text-sm pt-4 border-t">Template Questions</h4>
            {QUESTION_LIBRARY.map((category) => (
              <div key={category.id} className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">{category.title}</h4>
                <div className="space-y-2">
                  {category.questions.map((question) => {
                    const isSelected = selectedQuestions.includes(question.id);
                    const canSelect = selectedQuestions.length < 3 || isSelected;

                    return (
                      <label
                        key={question.id}
                        className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500'
                            : canSelect
                            ? 'bg-white border-gray-200 hover:bg-gray-50'
                            : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => canSelect && toggleQuestion(question.id)}
                          disabled={!canSelect}
                          className="mt-1 mr-3"
                        />
                        <span className="text-sm text-gray-700">{question.text}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [allEmployees, setAllEmployees] = useState<EditableEmployee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EditableEmployee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, Partial<UserProfile>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    const users = await getActiveUsers();
    setAllEmployees(users.map(u => ({ ...u, isEditing: false })));
    setLoading(false);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmployees([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const matches = allEmployees.filter(emp =>
      emp.full_name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      (emp.title && emp.title.toLowerCase().includes(query)) ||
      (emp.department && emp.department.toLowerCase().includes(query))
    );

    setFilteredEmployees(matches);
  }, [searchQuery, allEmployees]);

  const startEdit = (employee: EditableEmployee) => {
    setFilteredEmployees(prev =>
      prev.map(emp =>
        emp.id === employee.id ? { ...emp, isEditing: true } : emp
      )
    );
    setEditValues(prev => ({
      ...prev,
      [employee.id]: {
        full_name: employee.full_name,
        email: employee.email,
        title: employee.title || '',
        department: employee.department || '',
        location: employee.location || '',
        role: employee.role || 'user',
      },
    }));
  };

  const cancelEdit = (employeeId: string) => {
    setFilteredEmployees(prev =>
      prev.map(emp =>
        emp.id === employeeId ? { ...emp, isEditing: false } : emp
      )
    );
    setEditValues(prev => {
      const newValues = { ...prev };
      delete newValues[employeeId];
      return newValues;
    });
  };

  const saveEdit = async (employee: EditableEmployee) => {
    const updates = editValues[employee.id];
    if (!updates) return;

    setSaving(employee.id);
    const result = await updateUserProfile(employee.id, updates);

    if (result) {
      // Update both filtered and all employees
      setFilteredEmployees(prev =>
        prev.map(emp =>
          emp.id === employee.id ? { ...result, isEditing: false } : emp
        )
      );
      setAllEmployees(prev =>
        prev.map(emp =>
          emp.id === employee.id ? { ...result, isEditing: false } : emp
        )
      );
      setEditValues(prev => {
        const newValues = { ...prev };
        delete newValues[employee.id];
        return newValues;
      });
    }
    setSaving(null);
  };

  const updateEditValue = (employeeId: string, field: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const deleteEmployee = async (employee: EditableEmployee) => {
    const confirmDelete = confirm(
      `Are you sure you want to delete ${employee.full_name}?\n\nThis will deactivate their account and they will no longer appear in the system.`
    );

    if (!confirmDelete) return;

    setDeleting(employee.id);

    try {
      // Soft delete by setting is_active to false
      const result = await updateUserProfile(employee.id, { is_active: false });

      if (result) {
        // Remove from both filtered and all employees lists
        setFilteredEmployees(prev => prev.filter(emp => emp.id !== employee.id));
        setAllEmployees(prev => prev.filter(emp => emp.id !== employee.id));
        alert('User deactivated successfully');
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }

    setDeleting(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'leader':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'user':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

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

      {/* 360 Review Settings */}
      <Default360QuestionsManager />

      {/* Employee Management */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
            <User className="w-5 h-5 mr-2" />
            Employee Management
          </h3>
          <p className="text-sm text-gray-600 mb-4">Search and edit employee information and manage access levels</p>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, title, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-2">
              Found {filteredEmployees.length} matching {filteredEmployees.length === 1 ? 'employee' : 'employees'}
            </p>
          )}
        </div>

        {/* Scrollable table container with fixed height */}
        <div className="overflow-x-auto" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading employees...</div>
          ) : !searchQuery ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Enter a name, email, title, or department to search for employees</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No employees found matching &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    {employee.isEditing ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.full_name || ''}
                            onChange={(e) => updateEditValue(employee.id, 'full_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="email"
                            value={editValues[employee.id]?.email || ''}
                            onChange={(e) => updateEditValue(employee.id, 'email', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.title || ''}
                            onChange={(e) => updateEditValue(employee.id, 'title', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.department || ''}
                            onChange={(e) => updateEditValue(employee.id, 'department', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.location || ''}
                            onChange={(e) => updateEditValue(employee.id, 'location', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={editValues[employee.id]?.role || 'user'}
                            onChange={(e) => updateEditValue(employee.id, 'role', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="user">User</option>
                            <option value="leader">Leader</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => saveEdit(employee)}
                              disabled={saving === employee.id}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => cancelEdit(employee.id)}
                              disabled={saving === employee.id}
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {employee.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.title || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {employee.location || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(employee.role || 'user')}`}>
                            <Shield className="w-3 h-3 inline mr-1" />
                            {employee.role || 'user'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEdit(employee)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteEmployee(employee)}
                              disabled={deleting === employee.id}
                              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
