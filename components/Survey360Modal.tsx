import { useState, useEffect } from 'react';
import {
  X,
  Users,
  Plus,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  Loader2,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Calendar,
  Mail,
  Copy,
  Check,
  Sparkles,
  Edit2,
} from 'lucide-react';
import type {
  Employee,
  Survey360,
  Survey360Participant,
  Survey360Response,
  Survey360Report,
  ParticipantRelationship,
  SurveyQuestion,
} from '../types';
import { getDefault360Questions, analyzeSurvey360Responses } from '../lib/survey360Analyzer';
import {
  QUESTION_LIBRARY,
  DEFAULT_QUESTION_IDS,
  getQuestionById,
} from '../lib/feedback360QuestionBank';
import { EmployeeNameLink } from './unified';

interface Survey360ModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  organizationId: string;
}

type ModalStep = 'list' | 'create' | 'tracking' | 'report';

interface ParticipantForm {
  name: string;
  email: string;
  relationship: ParticipantRelationship;
}

interface SelectedQuestion {
  id: string;
  text: string;
  isEditing: boolean;
  isCustom: boolean;
}

export default function Survey360Modal({
  isOpen,
  onClose,
  employee,
  organizationId,
}: Survey360ModalProps) {
  const [step, setStep] = useState<ModalStep>('list');
  const [surveys, setSurveys] = useState<Survey360[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey360 | null>(null);

  // Create survey state
  const [surveyTitle, setSurveyTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [participants, setParticipants] = useState<ParticipantForm[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>(getDefault360Questions());
  const [selectedQuestions, setSelectedQuestions] = useState<SelectedQuestion[]>([]);
  const [showQuestionLibrary, setShowQuestionLibrary] = useState(true);

  // Tracking state
  const [surveyParticipants, setSurveyParticipants] = useState<Survey360Participant[]>([]);
  const [responses, setResponses] = useState<Survey360Response[]>([]);

  // Report state
  const [report, setReport] = useState<Survey360Report | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // UI state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && step === 'list') {
      loadSurveys();
    }
  }, [isOpen, step, employee.id]);

  useEffect(() => {
    if (!isOpen) {
      setStep('list');
      setSelectedSurvey(null);
      setSurveyParticipants([]);
      setResponses([]);
      setReport(null);
      setSurveyTitle('');
      setDueDate('');
      setParticipants([]);
      setQuestions(getDefault360Questions());
      setSelectedQuestions([]);
      setShowQuestionLibrary(true);
    }
  }, [isOpen]);

  const loadSurveys = () => {
    // In real implementation, fetch from Supabase
    // For now, using mock data
    const mockSurveys: Survey360[] = [];
    setSurveys(mockSurveys);
  };

  const buildQuestionFromLibrary = (questionId: string): SelectedQuestion | null => {
    const libraryItem = getQuestionById(questionId);
    if (!libraryItem) return null;

    return {
      id: libraryItem.id,
      text: libraryItem.text,
      isEditing: false,
      isCustom: false,
    };
  };

  const initializeDefaultQuestions = () => {
    const defaults = DEFAULT_QUESTION_IDS
      .map((id) => buildQuestionFromLibrary(id))
      .filter((item): item is SelectedQuestion => Boolean(item));

    setSelectedQuestions(defaults);
    setShowQuestionLibrary(true);
  };

  const addLibraryQuestion = (questionId: string) => {
    const selected = buildQuestionFromLibrary(questionId);
    if (!selected) return;

    setSelectedQuestions((prev) => (
      prev.some((item) => item.id === selected.id)
        ? prev
        : [...prev, selected]
    ));
  };

  const addCustomQuestion = () => {
    setSelectedQuestions((prev) => ([
      ...prev,
      {
        id: `custom-${Date.now()}`,
        text: '',
        isEditing: true,
        isCustom: true,
      },
    ]));
  };

  const toggleQuestionEdit = (id: string) => {
    setSelectedQuestions((prev) => prev.map((q) => (
      q.id === id ? { ...q, isEditing: !q.isEditing } : q
    )));
  };

  const updateSelectedQuestion = (id: string, text: string) => {
    setSelectedQuestions((prev) => prev.map((q) => (
      q.id === id ? { ...q, text } : q
    )));
  };

  const removeSelectedQuestion = (id: string) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleCreateNewSurvey = () => {
    setSurveyTitle(`360 Feedback for ${employee.name}`);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setDueDate(nextMonth.toISOString().split('T')[0]);
    setParticipants([]);
    initializeDefaultQuestions();
    setQuestions([]);
    setStep('create');
  };

  const addParticipant = () => {
    setParticipants([
      ...participants,
      { name: '', email: '', relationship: 'peer' },
    ]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof ParticipantForm, value: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

  const handleLaunchSurvey = async () => {
    if (!surveyTitle || participants.length === 0) {
      alert('Please provide a survey title and at least one participant.');
      return;
    }

    if (selectedQuestions.length === 0) {
      alert('Add at least one survey question before launching.');
      return;
    }

    if (selectedQuestions.some((q) => !q.text.trim())) {
      alert('Please complete or remove any blank questions before launching.');
      return;
    }

    setIsSaving(true);

    try {
      const finalQuestions: SurveyQuestion[] = selectedQuestions.map((question, index) => ({
        id: question.id || `question-${index}`,
        question: question.text,
        type: 'text',
        required: true,
      }));

      // In real implementation, save to Supabase
      const mockSurvey: Survey360 = {
        id: `survey-${Date.now()}`,
        organization_id: organizationId,
        employee_id: employee.id,
        employee_name: employee.name,
        created_by: 'current-user',
        status: 'active',
        survey_title: surveyTitle,
        custom_questions: finalQuestions,
        due_date: dueDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockParticipants: Survey360Participant[] = participants.map((p, i) => ({
        id: `participant-${Date.now()}-${i}`,
        survey_id: mockSurvey.id,
        participant_name: p.name,
        participant_email: p.email,
        relationship: p.relationship,
        status: 'pending',
        access_token: `token-${Date.now()}-${i}`,
        invited_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      setSelectedSurvey(mockSurvey);
      setSurveyParticipants(mockParticipants);
      setQuestions(finalQuestions);
      setStep('tracking');
    } catch (error) {
      console.error('Error launching survey:', error);
      alert('Failed to launch survey. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedSurvey) return;

    setIsGeneratingReport(true);

    try {
      const reportData = await analyzeSurvey360Responses({
        survey: selectedSurvey,
        responses,
        participants: surveyParticipants,
        questions,
      });

      const fullReport: Survey360Report = {
        ...reportData,
        id: `report-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setReport(fullReport);
      setStep('report');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const copyLinkToClipboard = (token: string) => {
    const surveyLink = `${window.location.origin}/survey/${token}`;
    navigator.clipboard.writeText(surveyLink);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const renderListView = () => (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          360 Surveys for{' '}
          <EmployeeNameLink
            employee={employee}
            className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
          />
        </h3>
        <p className="text-sm text-gray-600">
          Create a new survey or view existing feedback for this employee.
        </p>
      </div>

      {surveys.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No 360 Surveys Yet</h3>
          <p className="text-sm text-gray-600 mb-6">
            Launch a 360-degree feedback survey to gather insights from multiple perspectives.
          </p>
          <button
            onClick={handleCreateNewSurvey}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Create 360 Survey
          </button>
        </div>
      ) : (
        <div>
          <button
            onClick={handleCreateNewSurvey}
            className="mb-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            New Survey
          </button>
          <div className="space-y-3">
            {surveys.map(survey => (
              <div
                key={survey.id}
                className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-all"
                onClick={() => {
                  setSelectedSurvey(survey);
                  setStep('tracking');
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{survey.survey_title}</h4>
                    <p className="text-sm text-gray-600">
                      Status: <span className="font-medium">{survey.status}</span>
                    </p>
                  </div>
                  <div className="text-sm text-gray-600">
                    {new Date(survey.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCreateView = () => (
    <div className="p-6 max-h-[70vh] overflow-y-auto">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create 360 Survey</h3>

        {/* Survey Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Survey Title</label>
          <input
            type="text"
            value={surveyTitle}
            onChange={(e) => setSurveyTitle(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., 360 Feedback for Q1 2025"
          />
        </div>

        {/* Due Date */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Participants */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              <Users className="w-4 h-4 inline mr-1" />
              Participants
            </label>
            <button
              onClick={addParticipant}
              className="px-3 py-1 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add Participant
            </button>
          </div>

          <div className="space-y-3">
            {participants.map((participant, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={participant.name}
                      onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="email"
                      value={participant.email}
                      onChange={(e) => updateParticipant(index, 'email', e.target.value)}
                      placeholder="Email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={participant.relationship}
                      onChange={(e) => updateParticipant(index, 'relationship', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="manager">Manager</option>
                      <option value="peer">Peer</option>
                      <option value="direct_report">Direct Report</option>
                      <option value="self">Self</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <button
                      onClick={() => removeParticipant(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {participants.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No participants added yet</p>
          )}
        </div>

        {/* Question Builder */}
        <div className="mb-6 space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Build Your Question Set
            </h4>
            <p className="text-xs text-purple-700">
              Start with our hand-picked prompts or add your own. Edit any question inline to tailor it to{' '}
              <EmployeeNameLink
                employee={employee}
                className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
              />
              .
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Selected Questions ({selectedQuestions.length})
              </label>
              <button
                onClick={addCustomQuestion}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Custom
              </button>
            </div>

            {selectedQuestions.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500">
                No questions yet. Pick from the library below or add your own prompt.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedQuestions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-semibold text-blue-600 mt-1">{index + 1}.</span>
                      <div className="flex-1">
                        {question.isEditing ? (
                          <textarea
                            value={question.text}
                            onChange={(e) => updateSelectedQuestion(question.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            placeholder="Enter your question..."
                            autoFocus
                          />
                        ) : (
                          <p className="text-gray-900">
                            {question.text}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleQuestionEdit(question.id)}
                          className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                          title={question.isEditing ? 'Save' : 'Edit'}
                        >
                          {question.isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => removeSelectedQuestion(question.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {showQuestionLibrary ? (
              <div className="border-2 border-purple-300 rounded-lg p-5 bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h5 className="font-bold text-purple-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Question Library
                    </h5>
                    <p className="text-xs text-purple-700 mt-1">Tap any prompt to add it to this survey.</p>
                  </div>
                  <button
                    onClick={() => setShowQuestionLibrary(false)}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                  >
                    Hide Library
                  </button>
                </div>
                {QUESTION_LIBRARY.map((group) => (
                  <div key={group.id} className="mb-5 last:mb-0">
                    <div className="bg-purple-100 px-3 py-2 rounded-t-lg border-b-2 border-purple-300">
                      <p className="text-sm font-bold text-purple-900">{group.title}</p>
                    </div>
                    <div className="space-y-2 mt-2">
                      {group.questions.map((q) => {
                        const isAdded = selectedQuestions.some((sq) => sq.id === q.id);
                        return (
                          <button
                            key={q.id}
                            onClick={() => addLibraryQuestion(q.id)}
                            disabled={isAdded}
                            className={`w-full text-left p-3 rounded-lg text-sm transition-all border-2 ${
                              isAdded
                                ? 'bg-green-100 text-green-900 border-green-400 cursor-default font-medium'
                                : 'bg-white hover:bg-blue-100 hover:border-blue-400 text-gray-800 border-gray-200 hover:shadow-md'
                            }`}
                          >
                            {isAdded ? '✓ Added: ' : '+ '}{q.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setShowQuestionLibrary(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Show question library
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between space-x-3">
          <button
            onClick={() => setStep('list')}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunchSurvey}
            disabled={isSaving || !surveyTitle || participants.length === 0 || selectedQuestions.length === 0}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Launching...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Launch Survey
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderTrackingView = () => {
    if (!selectedSurvey) return null;

    const completedCount = surveyParticipants.filter(p => p.status === 'completed').length;
    const completionPercentage = surveyParticipants.length > 0
      ? Math.round((completedCount / surveyParticipants.length) * 100)
      : 0;

    return (
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedSurvey.survey_title}</h3>
          <p className="text-sm text-gray-600">Track survey responses and view progress</p>
        </div>

        {/* Progress Overview */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Response Progress</span>
            <span className="text-sm font-bold text-blue-600">{completionPercentage}%</span>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {completedCount} of {surveyParticipants.length} participants responded
          </p>
        </div>

        {/* Participants List */}
        <div className="space-y-3 mb-6">
          {surveyParticipants.map((participant) => (
            <div
              key={participant.id}
              className="p-4 bg-white border-2 border-gray-200 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{participant.participant_name}</p>
                      <p className="text-sm text-gray-600">{participant.participant_email}</p>
                      <span className="inline-block mt-1 px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded">
                        {participant.relationship}
                      </span>
                    </div>
                    <div className="text-right">
                      {participant.status === 'completed' ? (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-5 h-5 mr-1" />
                          <span className="text-sm font-semibold">Completed</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-yellow-600">
                          <Clock className="w-5 h-5 mr-1" />
                          <span className="text-sm font-semibold">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Survey Link */}
                  <div className="mt-3 flex items-center space-x-2">
                    <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                      {`${window.location.origin}/survey/${participant.access_token}`}
                    </div>
                    <button
                      onClick={() => copyLinkToClipboard(participant.access_token)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                      title="Copy survey link"
                    >
                      {copiedToken === participant.access_token ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={`mailto:${participant.participant_email}?subject=${encodeURIComponent(
                        `360 Feedback Survey for ${employee.name}`
                      )}&body=${encodeURIComponent(
                        `Hi ${participant.participant_name},\n\nYou've been invited to provide 360-degree feedback for ${employee.name}.\n\nPlease complete the survey at:\n${window.location.origin}/survey/${participant.access_token}\n\nThank you for your participation!`
                      )}`}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                      title="Send email invitation"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-between space-x-3">
          <button
            onClick={() => setStep('list')}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to List
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={completedCount === 0 || isGeneratingReport}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center"
          >
            {isGeneratingReport ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Generating Report...
              </>
            ) : (
              <>
                <BarChart3 className="w-5 h-5 mr-2" />
                Generate AI Report
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderReportView = () => {
    if (!report) return null;

    return (
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">360 Feedback Report</h3>
          <p className="text-sm text-gray-600">
            AI-powered analysis of feedback for{' '}
            <EmployeeNameLink
              employee={employee}
              className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
            />
          </p>
        </div>

        {/* Overall Strengths */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-900 mb-3 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Overall Strengths
          </h4>
          <ul className="space-y-2">
            {report.overall_strengths.map((strength, i) => (
              <li key={i} className="text-sm text-green-900">✓ {strength}</li>
            ))}
          </ul>
        </div>

        {/* Development Areas */}
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="font-semibold text-yellow-900 mb-3 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Development Areas
          </h4>
          <ul className="space-y-2">
            {report.development_areas.map((area, i) => (
              <li key={i} className="text-sm text-yellow-900">→ {area}</li>
            ))}
          </ul>
        </div>

        {/* Key Themes */}
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Key Themes</h4>
          <div className="space-y-3">
            {report.themes.map((theme, i) => (
              <div key={i} className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-900">{theme.theme}</h5>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded ${
                      theme.sentiment === 'positive'
                        ? 'bg-green-100 text-green-800'
                        : theme.sentiment === 'negative'
                        ? 'bg-red-100 text-red-800'
                        : theme.sentiment === 'mixed'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {theme.sentiment}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">Mentioned by {theme.frequency} participants</p>
                {theme.supporting_quotes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {theme.supporting_quotes.slice(0, 2).map((quote, qi) => (
                      <p key={qi} className="text-sm text-gray-700 italic pl-4 border-l-2 border-blue-300">
                        "{quote}"
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-blue-900">• {rec}</li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => setStep('tracking')}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Tracking
          </button>
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Print Report
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">360° Feedback</h2>
              <p className="text-sm text-gray-600 mt-1">Gather multi-perspective insights</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 'list' && renderListView()}
          {step === 'create' && renderCreateView()}
          {step === 'tracking' && renderTrackingView()}
          {step === 'report' && renderReportView()}
        </div>
      </div>
    </div>
  );
}
