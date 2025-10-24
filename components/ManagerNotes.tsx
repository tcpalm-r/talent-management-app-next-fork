import { useState } from 'react';
import { Plus, Trash2, Calendar, Tag, Lock, Sparkles, AlertCircle, CheckCircle, Bell, AlertTriangle } from 'lucide-react';
import type { ManagerNote } from '../types';

interface ManagerNotesProps {
  employeeId: string;
  employeeName: string;
  notes: ManagerNote[];
  onAddNote?: (note: Omit<ManagerNote, 'id' | 'created_at' | 'updated_at'>) => void;
  onDeleteNote?: (noteId: string) => void;
  onAcknowledgeNote?: (noteId: string) => void;
  currentUserName?: string;
  isEmployeeView?: boolean; // True if the employee is viewing their own feedback
}

export default function ManagerNotes({
  employeeId,
  employeeName,
  notes = [],
  onAddNote,
  onDeleteNote,
  onAcknowledgeNote,
  currentUserName = 'Manager',
  isEmployeeView = false,
}: ManagerNotesProps) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  const availableTags = [
    'Performance',
    'Feedback',
    'Achievement',
    'Concern',
    'Goal',
    'Training',
    'Recognition',
    'Development',
  ];

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;

    const newNote: Omit<ManagerNote, 'id' | 'created_at' | 'updated_at'> = {
      employee_id: employeeId,
      note: newNoteText,
      created_by: currentUserName,
      is_private: !requiresAcknowledgment, // If requires ack, it's not fully private
      tags: selectedTags,
      requires_acknowledgment: requiresAcknowledgment,
      severity: requiresAcknowledgment ? severity : undefined,
    };

    if (onAddNote) {
      onAddNote(newNote);
    }

    // Reset form
    setNewNoteText('');
    setSelectedTags([]);
    setRequiresAcknowledgment(false);
    setSeverity('medium');
    setIsAddingNote(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)} weeks ago`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)} months ago`;
    } else {
      return `${Math.floor(diffDays / 365)} years ago`;
    }
  };

  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      Performance: 'bg-blue-100 text-blue-800',
      Feedback: 'bg-purple-100 text-purple-800',
      Achievement: 'bg-green-100 text-green-800',
      Concern: 'bg-red-100 text-red-800',
      Goal: 'bg-indigo-100 text-indigo-800',
      Training: 'bg-yellow-100 text-yellow-800',
      Recognition: 'bg-pink-100 text-pink-800',
      Development: 'bg-cyan-100 text-cyan-800',
    };
    return colors[tag] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (sev: string) => {
    const colors: Record<string, string> = {
      low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      medium: 'bg-orange-100 text-orange-800 border-orange-300',
      high: 'bg-red-100 text-red-800 border-red-300',
      critical: 'bg-red-600 text-white border-red-700',
    };
    return colors[sev] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Filter notes based on view
  const visibleNotes = isEmployeeView
    ? notes.filter(note => note.requires_acknowledgment || !note.is_private)
    : notes;

  // Sort notes: unacknowledged first, then by date (newest first)
  const sortedNotes = [...visibleNotes].sort((a, b) => {
    // Unacknowledged notes first
    if (a.requires_acknowledgment && !a.acknowledged_at && !(b.requires_acknowledgment && !b.acknowledged_at)) return -1;
    if (b.requires_acknowledgment && !b.acknowledged_at && !(a.requires_acknowledgment && !a.acknowledged_at)) return 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Count pending acknowledgments
  const pendingCount = notes.filter(n => n.requires_acknowledgment && !n.acknowledged_at).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            {isEmployeeView ? (
              <>
                <Bell className="w-5 h-5 mr-2 text-blue-600" />
                Manager Feedback
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 mr-2 text-purple-600" />
                Manager Notes
              </>
            )}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {isEmployeeView ? (
              <>
                Feedback from your manager • {pendingCount > 0 && (
                  <span className="text-red-600 font-semibold">{pendingCount} pending acknowledgment</span>
                )}
              </>
            ) : (
              <>Private notes visible only to managers • {sortedNotes.length} note{sortedNotes.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        {!isAddingNote && !isEmployeeView && (
          <button
            onClick={() => setIsAddingNote(true)}
            className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Note
          </button>
        )}
      </div>

      {/* Pending Acknowledgments Alert (Employee View) */}
      {isEmployeeView && pendingCount > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-5">
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-red-900 mb-1">
                Action Required: {pendingCount} Feedback Item{pendingCount > 1 ? 's' : ''} Pending
              </h4>
              <p className="text-sm text-red-800">
                Your manager has shared important feedback that requires your acknowledgment. Please review and acknowledge each item below to confirm you've received and understood the feedback.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Form (Manager View Only) */}
      {isAddingNote && !isEmployeeView && (
        <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note for {employeeName}
            </label>
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Enter your note here..."
              className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-32"
              maxLength={5000}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500">
                {newNoteText.length} / 5000 characters
              </span>
              <span className="text-xs text-purple-600 font-medium">
                <Calendar className="w-3 h-3 inline mr-1" />
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                    selectedTags.includes(tag)
                      ? getTagColor(tag) + ' ring-2 ring-purple-400'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Formal Concern Toggle */}
          <div className="mb-3 p-4 bg-white rounded-lg border-2 border-orange-300">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresAcknowledgment}
                onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <div className="flex-1">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-orange-600 mr-2" />
                  <span className="text-sm font-bold text-gray-900">
                    Formal Concern - Requires Employee Acknowledgment
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Employee will be alerted and must formally acknowledge receipt of this feedback
                </p>
              </div>
            </label>

            {/* Severity Selector (shown when acknowledgment is required) */}
            {requiresAcknowledgment && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severity Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSeverity(sev)}
                      className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border-2 ${
                        severity === sev
                          ? getSeverityColor(sev) + ' ring-2 ring-offset-2 ring-orange-400'
                          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {sev.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsAddingNote(false);
                setNewNoteText('');
                setSelectedTags([]);
                setRequiresAcknowledgment(false);
                setSeverity('medium');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              disabled={!newNoteText.trim()}
              className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {requiresAcknowledgment ? 'Send Formal Feedback' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          {isEmployeeView ? (
            <>
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">No feedback yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Your manager hasn't shared any feedback requiring acknowledgment
              </p>
            </>
          ) : (
            <>
              <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">No manager notes yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Add private notes to track important information for performance reviews
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => {
            const needsAck = note.requires_acknowledgment && !note.acknowledged_at;
            const isAcknowledged = note.acknowledged_at;

            return (
              <div
                key={note.id}
                className={`p-5 rounded-xl border-2 transition-all ${
                  needsAck
                    ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300 shadow-lg'
                    : isAcknowledged
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                    : 'bg-white border-gray-200 hover:border-purple-300'
                }`}
              >
                {/* Header with Acknowledgment Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="text-xs font-semibold text-gray-600">
                        {note.created_by}
                      </span>

                      {note.requires_acknowledgment && (
                        <>
                          {needsAck ? (
                            <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full flex items-center shadow-md animate-pulse">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              ACKNOWLEDGMENT REQUIRED
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              ACKNOWLEDGED
                            </span>
                          )}
                          {note.severity && (
                            <span className={`px-2 py-1 text-xs font-bold rounded ${getSeverityColor(note.severity)}`}>
                              {note.severity.toUpperCase()}
                            </span>
                          )}
                        </>
                      )}

                      {!note.requires_acknowledgment && note.is_private && !isEmployeeView && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded flex items-center">
                          <Lock className="w-3 h-3 mr-1" />
                          Private
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDate(note.created_at)}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({formatRelativeDate(note.created_at)})
                      </span>
                    </div>

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {note.tags.map((tag, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${getTagColor(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {onDeleteNote && !isEmployeeView && (
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Note Content */}
                <div className={`p-4 rounded-lg mb-3 ${
                  needsAck ? 'bg-white border-2 border-orange-200' : 'bg-gray-50'
                }`}>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                    {note.note}
                  </p>
                </div>

                {/* Acknowledgment Section */}
                {note.requires_acknowledgment && (
                  <div className={`p-4 rounded-lg border-2 ${
                    needsAck ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'
                  }`}>
                    {needsAck ? (
                      isEmployeeView ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-gray-900 mb-1">
                                Action Required
                              </p>
                              <p className="text-xs text-gray-700">
                                Please acknowledge that you have received and understood this feedback
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => onAcknowledgeNote && onAcknowledgeNote(note.id)}
                            className="ml-4 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all"
                          >
                            Acknowledge
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Bell className="w-5 h-5 text-orange-600" />
                          <p className="text-sm font-semibold text-orange-900">
                            Pending employee acknowledgment
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm font-semibold text-green-900">
                            Acknowledged by {note.acknowledged_by}
                          </p>
                          <p className="text-xs text-green-700">
                            on {formatDate(note.acknowledged_at!)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Helper Text */}
      {sortedNotes.length > 0 && !isEmployeeView && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
          <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-blue-900">Pro Tip</p>
            <p className="text-xs text-blue-800 mt-1">
              Use "Formal Concern" for important feedback that requires employee acknowledgment. This creates a documented trail and ensures they've received the feedback.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
