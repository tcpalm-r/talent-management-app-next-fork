'use client';

import { Settings, Pencil, Save, X, User, Shield, HelpCircle, Search, Trash2, GripVertical, EyeOff, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getActiveUsers, updateUserProfile, UserProfile, supabase } from '@/lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from './unified';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type EditableEmployee = UserProfile & {
  isEditing?: boolean;
};

// Sortable question item component
function SortableQuestionItem({
  id,
  text,
  minWords,
  index,
  onDelete,
  onMinWordsChange,
  onTextChange
}: {
  id: string;
  text: string;
  minWords?: number;
  index: number;
  onDelete: () => void;
  onMinWordsChange: (minWords: number) => void;
  onTextChange: (newText: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md"
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-1"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <span className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-700 text-white rounded-full flex items-center justify-center text-xs font-bold mt-1">
          {index + 1}
        </span>
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y"
            placeholder="Enter question text..."
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-400">Min words:</label>
            <input
              type="number"
              min="10"
              max="500"
              value={minWords || 50}
              onChange={(e) => onMinWordsChange(parseInt(e.target.value) || 50)}
              className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <button
          onClick={onDelete}
          className="flex-shrink-0 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
          title="Delete question"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Component for managing default 360 questions
function Default360QuestionsManager() {
  const { notify } = useToast();
  const [questions, setQuestions] = useState<Array<{ id: string; text: string; minWords?: number }>>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState('');
  const [customMinWords, setCustomMinWords] = useState(50);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadDefaultQuestions();
  }, []);

  const loadDefaultQuestions = async () => {
    try {
      const response = await fetch('/api/360-default-questions');
      if (response.ok) {
        const data = await response.json();
        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions);
        }
      }
    } catch (error) {
      console.error('Error loading default questions:', error);
    }
  };

  const saveDefaultQuestions = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/360-default-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });

      if (response.ok) {
        setIsEditing(false);
        setShowCustomInput(false);
        setCustomQuestionText('');
        notify({
          title: 'Success',
          description: 'Default questions updated successfully!',
          variant: 'success',
        });
      } else {
        const errorData = await response.json();
        notify({
          title: 'Error',
          description: errorData.error || 'Failed to save default questions',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error saving default questions:', error);
      notify({
        title: 'Error',
        description: 'Failed to save default questions',
        variant: 'error',
      });
    }
    setSaving(false);
  };

  const addCustomQuestion = () => {
    if (!customQuestionText.trim()) {
      notify({
        title: 'Validation Error',
        description: 'Please enter a question',
        variant: 'error',
      });
      return;
    }

    const newQuestion = {
      id: `custom-${Date.now()}`,
      text: customQuestionText.trim(),
      minWords: customMinWords
    };

    setQuestions(prev => [...prev, newQuestion]);
    setCustomQuestionText('');
    setCustomMinWords(50);
    setShowCustomInput(false);
  };

  const deleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestionMinWords = (id: string, minWords: number) => {
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, minWords } : q
    ));
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(prev => prev.map(q =>
      q.id === id ? { ...q, text } : q
    ));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2" />
              360 Feedback Default Questions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure the required questions for all 360 feedback sessions
            </p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 text-sm"
            >
              Manage Questions
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={saveDefaultQuestions}
                disabled={saving}
                className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  loadDefaultQuestions();
                }}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm disabled:opacity-50"
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
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Current Required Questions ({questions.length}):
            </p>
            {questions.map((question, index) => (
              <div key={question.id} className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">{question.text}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Minimum words: {question.minWords || 50}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-md p-3 mb-4 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Total Questions: {questions.length}</strong>
              </p>
              <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                Drag and drop to reorder questions
              </p>
            </div>

            {/* Drag and Drop Question List */}
            {questions.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Required Questions</h4>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map(q => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {questions.map((question, index) => (
                        <SortableQuestionItem
                          key={question.id}
                          id={question.id}
                          text={question.text}
                          minWords={question.minWords}
                          index={index}
                          onDelete={() => deleteQuestion(question.id)}
                          onMinWordsChange={(minWords) => updateQuestionMinWords(question.id, minWords)}
                          onTextChange={(text) => updateQuestionText(question.id, text)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Add Custom Question Button/Input */}
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium"
              >
                + Add Question
              </button>
            ) : (
              <div className="p-4 border-2 border-blue-300 dark:border-blue-600 rounded-md bg-blue-50 dark:bg-blue-900/30">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter your question:
                </label>
                <textarea
                  value={customQuestionText}
                  onChange={(e) => setCustomQuestionText(e.target.value)}
                  placeholder="What question should reviewers answer?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Minimum word count:
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={customMinWords}
                    onChange={(e) => setCustomMinWords(parseInt(e.target.value) || 50)}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Reviewers must write at least this many words
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={addCustomQuestion}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 text-sm"
                  >
                    Add Question
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomQuestionText('');
                      setCustomMinWords(50);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { notify } = useToast();
  const [allEmployees, setAllEmployees] = useState<EditableEmployee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EditableEmployee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, Partial<UserProfile>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [hiding, setHiding] = useState<string | null>(null);
  const [showHiddenUsers, setShowHiddenUsers] = useState(false);

  // Confirm dialog state (Teams iframe compatible)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EditableEmployee | null>(null);
  const [hideConfirmOpen, setHideConfirmOpen] = useState(false);
  const [employeeToHide, setEmployeeToHide] = useState<EditableEmployee | null>(null);

  useEffect(() => {
    loadEmployees();
  }, [showHiddenUsers]);

  const loadEmployees = async () => {
    setLoading(true);

    if (showHiddenUsers) {
      // Fetch all active users including hidden ones
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (error) {
        console.error('Error fetching users:', error);
        setAllEmployees([]);
      } else {
        setAllEmployees((data || []).map(u => ({ ...u, isEditing: false })));
      }
    } else {
      // Fetch only non-hidden active users
      const users = await getActiveUsers();
      setAllEmployees(users.map(u => ({ ...u, isEditing: false })));
    }

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
        role: employee.app_role || 'user',
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

  const deleteEmployee = (employee: EditableEmployee) => {
    // Show confirm dialog instead of native confirm (Teams iframe compatible)
    setEmployeeToDelete(employee);
    setDeleteConfirmOpen(true);
  };

  // Handler for confirmed employee deletion
  const handleConfirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    setDeleteConfirmOpen(false);
    setDeleting(employeeToDelete.id);

    try {
      // Soft delete by setting is_active to false
      const result = await updateUserProfile(employeeToDelete.id, { is_active: false });

      if (result) {
        // Remove from both filtered and all employees lists
        setFilteredEmployees(prev => prev.filter(emp => emp.id !== employeeToDelete.id));
        setAllEmployees(prev => prev.filter(emp => emp.id !== employeeToDelete.id));
        notify({
          title: 'User deactivated',
          description: `${employeeToDelete.full_name} has been deactivated successfully.`,
          variant: 'success',
        });
      } else {
        notify({
          title: 'Error',
          description: 'Failed to delete user',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      notify({
        title: 'Error',
        description: 'Failed to delete user',
        variant: 'error',
      });
    }

    setDeleting(null);
    setEmployeeToDelete(null);
  };

  const hideEmployee = (employee: EditableEmployee) => {
    // Show confirm dialog for hiding
    setEmployeeToHide(employee);
    setHideConfirmOpen(true);
  };

  // Handler for confirmed employee hide/unhide
  const handleConfirmHideEmployee = async () => {
    if (!employeeToHide) return;

    setHideConfirmOpen(false);
    setHiding(employeeToHide.id);

    const newHiddenState = !employeeToHide.is_hidden;

    try {
      const result = await updateUserProfile(employeeToHide.id, { is_hidden: newHiddenState });

      if (result) {
        if (newHiddenState && !showHiddenUsers) {
          // If hiding and not showing hidden users, remove from lists
          setFilteredEmployees(prev => prev.filter(emp => emp.id !== employeeToHide.id));
          setAllEmployees(prev => prev.filter(emp => emp.id !== employeeToHide.id));
        } else {
          // Update the employee's is_hidden status in lists
          setFilteredEmployees(prev =>
            prev.map(emp =>
              emp.id === employeeToHide.id ? { ...emp, is_hidden: newHiddenState } : emp
            )
          );
          setAllEmployees(prev =>
            prev.map(emp =>
              emp.id === employeeToHide.id ? { ...emp, is_hidden: newHiddenState } : emp
            )
          );
        }
        notify({
          title: newHiddenState ? 'User hidden' : 'User unhidden',
          description: newHiddenState
            ? `${employeeToHide.full_name} will no longer appear in selection UIs.`
            : `${employeeToHide.full_name} is now visible in selection UIs.`,
          variant: 'success',
        });
      } else {
        notify({
          title: 'Error',
          description: 'Failed to update user visibility',
          variant: 'error',
        });
      }
    } catch (error) {
      console.error('Error updating user visibility:', error);
      notify({
        title: 'Error',
        description: 'Failed to update user visibility',
        variant: 'error',
      });
    }

    setHiding(null);
    setEmployeeToHide(null);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-700';
      case 'slt':
        return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-700';
      case 'leader':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'user':
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <Settings className="w-7 h-7 mr-2 text-blue-600 dark:text-blue-400" />
            Admin Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure system settings and manage organization</p>
        </div>
      </div>

      {/* 360 Feedback Settings */}
      <Default360QuestionsManager />

      {/* Employee Management */}
      <div className="bg-white dark:bg-gray-800 rounded-md shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-4">
            <User className="w-5 h-5 mr-2" />
            Employee Management
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Search and edit employee information and manage access levels</p>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, email, title, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            {searchQuery ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Found {filteredEmployees.length} matching {filteredEmployees.length === 1 ? 'employee' : 'employees'}
              </p>
            ) : (
              <div />
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showHiddenUsers}
                onChange={(e) => setShowHiddenUsers(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <EyeOff className="w-4 h-4" />
              Show hidden users
            </label>
          </div>
        </div>

        {/* Scrollable table container with fixed height */}
        <div className="overflow-x-auto" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading employees...</div>
          ) : !searchQuery ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>Enter a name, email, title, or department to search for employees</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p>No employees found matching &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {employee.isEditing ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.full_name || ''}
                            onChange={(e) => updateEditValue(employee.id, 'full_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="email"
                            value={editValues[employee.id]?.email || ''}
                            onChange={(e) => updateEditValue(employee.id, 'email', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.title || ''}
                            onChange={(e) => updateEditValue(employee.id, 'title', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.department || ''}
                            onChange={(e) => updateEditValue(employee.id, 'department', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editValues[employee.id]?.location || ''}
                            onChange={(e) => updateEditValue(employee.id, 'location', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={editValues[employee.id]?.role || 'user'}
                            onChange={(e) => updateEditValue(employee.id, 'role', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          >
                            <option value="user">User</option>
                            <option value="leader">Leader</option>
                            <option value="slt">SLT</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => saveEdit(employee)}
                              disabled={saving === employee.id}
                              className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded disabled:opacity-50"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => cancelEdit(employee.id)}
                              disabled={saving === employee.id}
                              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            {employee.full_name}
                            {employee.is_hidden && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
                                <EyeOff className="w-3 h-3" />
                                Hidden
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {employee.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {employee.title || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {employee.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {employee.location || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(employee.app_role || 'user')}`}>
                            <Shield className="w-3 h-3 inline mr-1" />
                            {employee.app_role || 'user'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEdit(employee)}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => hideEmployee(employee)}
                              disabled={hiding === employee.id}
                              className={`p-1 rounded disabled:opacity-50 ${
                                employee.is_hidden
                                  ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                                  : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                              }`}
                              title={employee.is_hidden ? 'Unhide (show in selection UIs)' : 'Hide (remove from selection UIs)'}
                            >
                              {employee.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteEmployee(employee)}
                              disabled={deleting === employee.id}
                              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
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

      {/* Confirm Dialog for Delete Employee (Teams iframe compatible) */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={handleConfirmDeleteEmployee}
        title="Delete User"
        message={employeeToDelete
          ? `Are you sure you want to delete ${employeeToDelete.full_name}?\n\nThis will deactivate their account and they will no longer appear in the system.`
          : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Confirm Dialog for Hide/Unhide Employee */}
      <ConfirmDialog
        isOpen={hideConfirmOpen}
        onClose={() => {
          setHideConfirmOpen(false);
          setEmployeeToHide(null);
        }}
        onConfirm={handleConfirmHideEmployee}
        title={employeeToHide?.is_hidden ? 'Unhide User' : 'Hide User'}
        message={employeeToHide
          ? employeeToHide.is_hidden
            ? `Are you sure you want to unhide ${employeeToHide.full_name}?\n\nThey will appear again in reviewer and subject selection UIs.`
            : `Are you sure you want to hide ${employeeToHide.full_name}?\n\nThey will no longer appear when selecting reviewers or survey subjects. Use this for duplicate accounts or inactive users that shouldn't be selectable.`
          : ''}
        confirmText={employeeToHide?.is_hidden ? 'Unhide' : 'Hide'}
        cancelText="Cancel"
        variant={employeeToHide?.is_hidden ? 'info' : 'warning'}
      />
    </div>
  );
}
