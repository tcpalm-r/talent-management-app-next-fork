import { useState, useEffect } from 'react';
import {
  X,
  Shield,
  MessageSquare,
  TrendingUp,
  Award,
  Calendar,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle2,
  Target,
  ChevronRight,
} from 'lucide-react';
import type {
  Employee,
  EmployeePlan,
  StayInterviewNote,
  RetentionStrategy,
  LTIPDetails,
  RetentionPlanData,
  ActionItem,
} from '../types';
import { EmployeeNameLink } from './unified';

interface RetentionPlanModalProps {
  isOpen: boolean;
  employee: Employee;
  onClose: () => void;
  onSave: (plan: Partial<EmployeePlan>) => void;
  existingPlan?: EmployeePlan;
  flightRiskScore?: number;
}

type TabKey = 'stay-interview' | 'risk-assessment' | 'strategies' | 'ltip' | 'career';

const STAY_INTERVIEW_QUESTIONS = [
  "What do you look forward to when you come to work each day?",
  "What are you learning here?",
  "Why do you stay with our company?",
  "When was the last time you thought about leaving? What prompted it?",
  "What would make you leave this company?",
  "What can we do to keep you here?",
  "What are your career aspirations for the next 1-3 years?",
  "Is there anything making you less engaged at work lately?",
];

export default function RetentionPlanModal({
  isOpen,
  employee,
  onClose,
  onSave,
  existingPlan,
  flightRiskScore = 0,
}: RetentionPlanModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('stay-interview');
  const [isSaving, setIsSaving] = useState(false);

  // Retention-specific state
  const [stayInterviewNotes, setStayInterviewNotes] = useState<StayInterviewNote[]>(
    existingPlan?.retention_data?.stay_interview_notes || []
  );
  const [retentionStrategies, setRetentionStrategies] = useState<RetentionStrategy[]>(
    existingPlan?.retention_data?.retention_strategies || []
  );
  const [ltipDetails, setLtipDetails] = useState<LTIPDetails>(
    existingPlan?.retention_data?.ltip_details || {
      eligible: false,
    }
  );
  const [careerAspirations, setCareerAspirations] = useState(
    existingPlan?.retention_data?.career_aspirations || ''
  );
  const [concerns, setConcerns] = useState<string[]>(
    existingPlan?.retention_data?.concerns || []
  );
  const [nextStayInterview, setNextStayInterview] = useState(
    existingPlan?.retention_data?.next_stay_interview || ''
  );
  const [compensationReviewDate, setCompensationReviewDate] = useState(
    existingPlan?.retention_data?.compensation_review_date || ''
  );

  // Calculate risk level
  const getRiskLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const riskLevel = getRiskLevel(flightRiskScore);

  // Risk factors based on employee data
  const getRiskFactors = (): string[] => {
    const factors: string[] = [];
    
    if (flightRiskScore >= 60) factors.push('High flight risk score');
    if (employee.assessment?.performance === 'high' && employee.assessment?.potential === 'high') {
      factors.push('Top talent - critical to retain');
    }
    if (!existingPlan) factors.push('No development plan');
    
    const joinDate = new Date(employee.created_at);
    const monthsWithCompany = Math.floor(
      (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    if (monthsWithCompany < 12) factors.push('Tenure less than 1 year');
    if (monthsWithCompany > 48) factors.push('Long tenure - may seek change');
    
    if (concerns.length > 0) factors.push(`${concerns.length} documented concerns`);
    
    return factors;
  };

  const handleSave = () => {
    setIsSaving(true);

    // Build retention data
    const retentionData: RetentionPlanData = {
      flight_risk_score: flightRiskScore,
      risk_level: riskLevel,
      risk_factors: getRiskFactors(),
      stay_interview_notes: stayInterviewNotes,
      retention_strategies: retentionStrategies,
      ltip_details: ltipDetails,
      last_stay_interview: stayInterviewNotes.length > 0 
        ? stayInterviewNotes[stayInterviewNotes.length - 1].recorded_date 
        : undefined,
      next_stay_interview: nextStayInterview || undefined,
      compensation_review_date: compensationReviewDate || undefined,
      career_aspirations: careerAspirations || undefined,
      concerns,
    };

    // Convert retention strategies to action items
    const actionItems: ActionItem[] = retentionStrategies.map(strategy => ({
      id: strategy.id,
      description: strategy.action,
      dueDate: strategy.target_date,
      completed: strategy.status === 'completed',
      owner: strategy.owner,
      priority: strategy.category === 'compensation' || strategy.category === 'career_growth' ? 'high' : 'medium',
      status: strategy.status === 'completed' ? 'completed' : 
              strategy.status === 'in_progress' ? 'in_progress' : 'not_started',
      skillArea: strategy.category,
    }));

    const plan: Partial<EmployeePlan> = {
      ...existingPlan,
      employee_id: employee.id,
      plan_type: 'retention',
      title: existingPlan?.title || `Retention Plan for ${employee.name}`,
      objectives: [
        'Maintain employee engagement and satisfaction',
        'Address retention concerns proactively',
        'Clarify career path and growth opportunities',
        ...concerns.map(c => `Resolve: ${c}`),
      ],
      action_items: actionItems,
      success_metrics: [
        'Employee remains with company through review period',
        'Positive feedback in stay interviews',
        'Increased engagement scores',
        'Career development progress visible',
      ],
      notes: `Flight Risk Score: ${flightRiskScore}\nRisk Level: ${riskLevel.toUpperCase()}`,
      timeline: '6 months',
      status: 'active',
      retention_data: retentionData,
      created_at: existingPlan?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: existingPlan?.created_by || 'current-user',
    };

    onSave(plan);
    setIsSaving(false);
    onClose();
  };

  const addStayInterviewNote = (question: string) => {
    const newNote: StayInterviewNote = {
      id: `note-${Date.now()}`,
      question,
      answer: '',
      sentiment: 'neutral',
      follow_up_needed: false,
      recorded_date: new Date().toISOString(),
    };
    setStayInterviewNotes([...stayInterviewNotes, newNote]);
  };

  const updateStayInterviewNote = (id: string, updates: Partial<StayInterviewNote>) => {
    setStayInterviewNotes(
      stayInterviewNotes.map(note => (note.id === id ? { ...note, ...updates } : note))
    );
  };

  const deleteStayInterviewNote = (id: string) => {
    setStayInterviewNotes(stayInterviewNotes.filter(note => note.id !== id));
  };

  const addRetentionStrategy = () => {
    const newStrategy: RetentionStrategy = {
      id: `strategy-${Date.now()}`,
      category: 'career_growth',
      action: '',
      target_date: '',
      status: 'planned',
      owner: 'Manager',
    };
    setRetentionStrategies([...retentionStrategies, newStrategy]);
  };

  const updateRetentionStrategy = (id: string, updates: Partial<RetentionStrategy>) => {
    setRetentionStrategies(
      retentionStrategies.map(strategy => (strategy.id === id ? { ...strategy, ...updates } : strategy))
    );
  };

  const deleteRetentionStrategy = (id: string) => {
    setRetentionStrategies(retentionStrategies.filter(strategy => strategy.id !== id));
  };

  const addConcern = () => {
    setConcerns([...concerns, '']);
  };

  const updateConcern = (index: number, value: string) => {
    const updated = [...concerns];
    updated[index] = value;
    setConcerns(updated);
  };

  const deleteConcern = (index: number) => {
    setConcerns(concerns.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Retention Plan</h2>
                <EmployeeNameLink
                  employee={employee}
                  className="text-sm font-semibold text-gray-800 hover:text-blue-600 focus-visible:ring-blue-500"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {riskLevel.toUpperCase()} RISK ({flightRiskScore})
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6 bg-gray-50">
            <TabButton
              active={activeTab === 'stay-interview'}
              onClick={() => setActiveTab('stay-interview')}
              icon={MessageSquare}
              label="Stay Interview"
              count={stayInterviewNotes.length}
            />
            <TabButton
              active={activeTab === 'risk-assessment'}
              onClick={() => setActiveTab('risk-assessment')}
              icon={AlertTriangle}
              label="Risk Assessment"
            />
            <TabButton
              active={activeTab === 'strategies'}
              onClick={() => setActiveTab('strategies')}
              icon={Target}
              label="Strategies"
              count={retentionStrategies.length}
            />
            <TabButton
              active={activeTab === 'ltip'}
              onClick={() => setActiveTab('ltip')}
              icon={Award}
              label="LTIP"
            />
            <TabButton
              active={activeTab === 'career'}
              onClick={() => setActiveTab('career')}
              icon={TrendingUp}
              label="Career Path"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Stay Interview Tab */}
            {activeTab === 'stay-interview' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Stay Interview Questions</h3>
                      <p className="text-sm text-gray-600">Understand what motivates and concerns this employee</p>
                    </div>
                    <button
                      onClick={() => setNextStayInterview(
                        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                      )}
                      className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Schedule Next Interview
                    </button>
                  </div>

                  {nextStayInterview && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-900">
                        Next stay interview scheduled: {new Date(nextStayInterview).toLocaleDateString()}
                      </span>
                      <input
                        type="date"
                        value={nextStayInterview}
                        onChange={(e) => setNextStayInterview(e.target.value)}
                        className="ml-auto px-2 py-1 border border-blue-300 rounded"
                      />
                    </div>
                  )}

                  {STAY_INTERVIEW_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      onClick={() => addStayInterviewNote(question)}
                      className="mb-2 w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors flex items-center justify-between group"
                    >
                      <span className="text-gray-700">{question}</span>
                      <Plus className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Interview Notes</h4>
                  {stayInterviewNotes.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No interview notes yet. Click a question above to add notes.
                    </p>
                  ) : (
                    stayInterviewNotes.map((note) => (
                      <div key={note.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-gray-900 text-sm flex-1">{note.question}</p>
                          <button
                            onClick={() => deleteStayInterviewNote(note.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea
                          value={note.answer}
                          onChange={(e) => updateStayInterviewNote(note.id, { answer: e.target.value })}
                          placeholder="Employee's response..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          rows={3}
                        />
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600">Sentiment:</label>
                            <select
                              value={note.sentiment}
                              onChange={(e) =>
                                updateStayInterviewNote(note.id, {
                                  sentiment: e.target.value as 'positive' | 'neutral' | 'concerning',
                                })
                              }
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="positive">Positive</option>
                              <option value="neutral">Neutral</option>
                              <option value="concerning">Concerning</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={note.follow_up_needed}
                              onChange={(e) =>
                                updateStayInterviewNote(note.id, { follow_up_needed: e.target.checked })
                              }
                              className="rounded"
                            />
                            Follow-up needed
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Risk Assessment Tab */}
            {activeTab === 'risk-assessment' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${
                      riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                      riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {flightRiskScore}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Flight Risk Score</h3>
                      <p className="text-sm text-gray-600">
                        {riskLevel === 'high' && 'High risk - immediate attention needed'}
                        {riskLevel === 'medium' && 'Medium risk - monitor closely'}
                        {riskLevel === 'low' && 'Low risk - maintain engagement'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900 text-sm">Risk Factors:</h4>
                    <ul className="space-y-1">
                      {getRiskFactors().map((factor, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Documented Concerns</h4>
                    <button
                      onClick={addConcern}
                      className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Concern
                    </button>
                  </div>
                  <div className="space-y-2">
                    {concerns.map((concern, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={concern}
                          onChange={(e) => updateConcern(index, e.target.value)}
                          placeholder="Describe the concern..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <button
                          onClick={() => deleteConcern(index)}
                          className="p-2 hover:bg-red-50 rounded text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {concerns.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No concerns documented</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Compensation Review Date
                  </label>
                  <input
                    type="date"
                    value={compensationReviewDate}
                    onChange={(e) => setCompensationReviewDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Retention Strategies Tab */}
            {activeTab === 'strategies' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Retention Strategies</h3>
                    <p className="text-sm text-gray-600">Specific actions to retain this employee</p>
                  </div>
                  <button
                    onClick={addRetentionStrategy}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Strategy
                  </button>
                </div>

                {retentionStrategies.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">No retention strategies yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {retentionStrategies.map((strategy) => (
                      <div key={strategy.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <select
                            value={strategy.category}
                            onChange={(e) =>
                              updateRetentionStrategy(strategy.id, {
                                category: e.target.value as RetentionStrategy['category'],
                              })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="compensation">Compensation</option>
                            <option value="career_growth">Career Growth</option>
                            <option value="work_life_balance">Work-Life Balance</option>
                            <option value="recognition">Recognition</option>
                            <option value="culture">Culture</option>
                          </select>

                          <input
                            type="text"
                            value={strategy.action}
                            onChange={(e) => updateRetentionStrategy(strategy.id, { action: e.target.value })}
                            placeholder="Describe the action..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />

                          <button
                            onClick={() => deleteRetentionStrategy(strategy.id)}
                            className="p-2 hover:bg-red-50 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                              type="date"
                              value={strategy.target_date}
                              onChange={(e) => updateRetentionStrategy(strategy.id, { target_date: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>

                          <select
                            value={strategy.status}
                            onChange={(e) =>
                              updateRetentionStrategy(strategy.id, {
                                status: e.target.value as RetentionStrategy['status'],
                              })
                            }
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="planned">Planned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>

                          <input
                            type="text"
                            value={strategy.owner}
                            onChange={(e) => updateRetentionStrategy(strategy.id, { owner: e.target.value })}
                            placeholder="Owner"
                            className="px-2 py-1 border border-gray-300 rounded text-sm w-32"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LTIP Tab */}
            {activeTab === 'ltip' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Long Term Incentive Plan (LTIP)</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Track phantom stock grants and vesting schedules for leadership retention
                  </p>

                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={ltipDetails.eligible}
                        onChange={(e) => setLtipDetails({ ...ltipDetails, eligible: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <span className="font-semibold text-gray-900">LTIP Eligible</span>
                    </label>

                    {ltipDetails.eligible && (
                      <>
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={ltipDetails.enrolled || false}
                            onChange={(e) => setLtipDetails({ ...ltipDetails, enrolled: e.target.checked })}
                            className="w-5 h-5 rounded"
                          />
                          <span className="font-semibold text-gray-900">Currently Enrolled</span>
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Grant Date</label>
                            <input
                              type="date"
                              value={ltipDetails.grant_date || ''}
                              onChange={(e) => setLtipDetails({ ...ltipDetails, grant_date: e.target.value })}
                              className="w-full px-3 py-2 border border-purple-300 rounded-lg"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phantom Shares</label>
                            <input
                              type="number"
                              value={ltipDetails.phantom_shares || ''}
                              onChange={(e) =>
                                setLtipDetails({ ...ltipDetails, phantom_shares: parseInt(e.target.value) || 0 })
                              }
                              className="w-full px-3 py-2 border border-purple-300 rounded-lg"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Vesting Schedule</label>
                          <input
                            type="text"
                            value={ltipDetails.vesting_schedule || ''}
                            onChange={(e) => setLtipDetails({ ...ltipDetails, vesting_schedule: e.target.value })}
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg"
                            placeholder="e.g., 4 years with 1-year cliff"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                          <textarea
                            value={ltipDetails.notes || ''}
                            onChange={(e) => setLtipDetails({ ...ltipDetails, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg"
                            rows={3}
                            placeholder="Additional LTIP details..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Career Path Tab */}
            {activeTab === 'career' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Career Aspirations</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Document career goals and growth opportunities
                  </p>
                  <textarea
                    value={careerAspirations}
                    onChange={(e) => setCareerAspirations(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    rows={6}
                    placeholder="Where does this employee want to be in 1-3 years? What roles are they interested in? What skills do they want to develop?"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Career Development Actions
                  </h4>
                  <p className="text-sm text-blue-800 mb-4">
                    Use the Retention Strategies tab to add specific career growth actions
                  </p>
                  <button
                    onClick={() => setActiveTab('strategies')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Go to Strategies
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Retention Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon: Icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-600 bg-white'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium text-sm">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
          {count}
        </span>
      )}
    </button>
  );
}
