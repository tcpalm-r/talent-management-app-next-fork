import { useState, useEffect } from 'react';
import { X, FileText, Sparkles, Target, AlertCircle, CheckCircle2, Zap, Brain, Plus, Trash2 } from 'lucide-react';
import { parsePerformanceReview, type ParsedReview } from '../lib/reviewParser';
import { analyzeReviewWithAI, isAnthropicConfigured, type AIAnalysisResult } from '../lib/anthropicService';
import type { Department, Performance, Potential } from '../types';

interface ReviewParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onEmployeeCreated: (employeeData: any, suggestedPlacement: { performance: Performance; potential: Potential }, plan: any) => void;
}

export default function ReviewParserModal({
  isOpen,
  onClose,
  departments,
  onEmployeeCreated
}: ReviewParserModalProps) {
  const anthropicAvailable = isAnthropicConfigured();
  const [reviewText, setReviewText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedReview | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [useAI, setUseAI] = useState(anthropicAvailable);
  const [analysisError, setAnalysisError] = useState('');
  const [anthropicWarning, setAnthropicWarning] = useState<string | null>(
    anthropicAvailable ? null : 'Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI parsing.'
  );
  
  // Editable fields
  const [editedName, setEditedName] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDepartment, setEditedDepartment] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedPerformance, setEditedPerformance] = useState<Performance>('medium');
  const [editedPotential, setEditedPotential] = useState<Potential>('medium');
  
  // Editable plan fields
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [editedActionItems, setEditedActionItems] = useState<any[]>([]);
  const [editedSuccessMetrics, setEditedSuccessMetrics] = useState<string[]>([]);
  const [editedTimeline, setEditedTimeline] = useState('90 days');
  
  useEffect(() => {
    if (isOpen) {
      setUseAI(anthropicAvailable);
      setAnthropicWarning(anthropicAvailable ? null : 'Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI parsing.');
    }
  }, [isOpen, anthropicAvailable]);

  const handleAnalyze = async () => {
    if (!reviewText.trim()) return;
    
    setIsAnalyzing(true);
    setAnalysisError('');
    if (useAI && !anthropicAvailable) {
      setAnthropicWarning('Anthropic API key not configured. Falling back to pattern matching.');
      setUseAI(false);
    } else {
      setAnthropicWarning(null);
    }
    
    try {
      if (useAI && anthropicAvailable) {
        // Use real AI analysis with Claude
        const aiResult = await analyzeReviewWithAI(reviewText);
        setAiAnalysis(aiResult);
        setEditedName(aiResult.employeeName);
        setEditedTitle(aiResult.title);
        setEditedDepartment(aiResult.department);
        setEditedEmail(aiResult.email);
        setEditedPerformance(aiResult.suggestedPerformance);
        setEditedPotential(aiResult.suggestedPotential);
        setEditedObjectives(aiResult.objectives);
        setEditedActionItems(aiResult.actionItems);
        setEditedSuccessMetrics(aiResult.successMetrics);
        setEditedTimeline(aiResult.recommendedTimeline);
      } else {
        // Fallback to pattern matching
        const parsed = parsePerformanceReview(reviewText);
        setParsedData(parsed);
        setEditedName(parsed.employeeName);
        setEditedTitle(parsed.title || '');
        setEditedDepartment(parsed.department || '');
        setEditedEmail(parsed.email || '');
        setEditedPerformance(parsed.suggestedPerformance);
        setEditedPotential(parsed.suggestedPotential);
        setEditedObjectives(parsed.objectives);
        setEditedActionItems(parsed.actionItems);
        setEditedSuccessMetrics(parsed.successMetrics);
        setEditedTimeline(parsed.suggestedPerformance === 'low' ? '60 days' : '90 days');
      }
      
      setStep('review');
    } catch (error: any) {
      setAnalysisError(error.message || 'Analysis failed. Please try again.');
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = () => {
    const data = aiAnalysis || parsedData;
    if (!data) return;
    
    const employeeData = {
      name: editedName,
      title: editedTitle,
      email: editedEmail,
      department_id: departments.find(d => 
        d.name.toLowerCase() === editedDepartment.toLowerCase()
      )?.id || null,
    };
    
    const suggestedPlacement = {
      performance: editedPerformance,
      potential: editedPotential
    };
    
    let plan;
    if (aiAnalysis) {
      // Use edited AI-generated plan (allows customization)
      plan = {
        plan_type: editedPerformance === 'low' ? 'performance_improvement' : 
                   editedPotential === 'high' ? 'development' : 'retention',
        title: `${editedName}'s Personalized Development Plan`,
        objectives: editedObjectives.filter(o => o.trim()),
        action_items: editedActionItems.filter(item => {
          const desc = typeof item === 'string' ? item : item.description;
          return desc && desc.trim();
        }).map((item, i) => ({
          id: `action-${i}`,
          description: typeof item === 'string' ? item : item.description,
          dueDate: typeof item === 'string' ? '90 days' : item.dueDate,
          completed: false,
          owner: editedName,
          priority: typeof item === 'string' ? 'medium' : item.priority
        })),
        timeline: editedTimeline,
        success_metrics: editedSuccessMetrics.filter(m => m.trim()),
        notes: `AI-Analyzed Performance Review for Sonance\n\n` +
               `Reasoning: ${aiAnalysis.reasoning}\n\n` +
               `Key Strengths:\n${aiAnalysis.keyStrengths.map(s => '• ' + s).join('\n')}\n\n` +
               `Development Areas:\n${aiAnalysis.developmentAreas.map(d => '• ' + d).join('\n')}\n\n` +
               `Sonance-Specific Insights:\n${aiAnalysis.sonanceSpecificInsights.map(i => '• ' + i).join('\n')}`
      };
    } else if (parsedData) {
      // Use pattern-matched plan
      plan = {
        plan_type: parsedData.planType,
        title: parsedData.planType === 'development' ? 'Development Plan' : 'Performance Improvement Plan',
        objectives: parsedData.objectives,
        action_items: parsedData.actionItems.map((desc, i) => ({
          id: `action-${i}`,
          description: desc,
          completed: false
        })),
        timeline: parsedData.suggestedPerformance === 'low' ? '60 days' : '90 days',
        success_metrics: parsedData.successMetrics,
        notes: `Extracted from performance review\n\nKey Insights:\n${parsedData.keyInsights.join('\n')}`
      };
    }
    
    onEmployeeCreated(employeeData, suggestedPlacement, plan);
    handleClose();
  };

  const handleClose = () => {
    setReviewText('');
    setParsedData(null);
    setAiAnalysis(null);
    setStep('input');
    setAnalysisError('');
    setEditedObjectives([]);
    setEditedActionItems([]);
    setEditedSuccessMetrics([]);
    setEditedTimeline('90 days');
    onClose();
  };

  const getBoxLabel = (perf: Performance, pot: Potential) => {
    if (perf === 'high' && pot === 'high') return 'Star / Top Talent';
    if (perf === 'high' && pot === 'medium') return 'Performance Leader';
    if (perf === 'high' && pot === 'low') return 'Master Craftsperson';
    if (perf === 'medium' && pot === 'high') return 'Emerging Leader';
    if (perf === 'medium' && pot === 'medium') return 'Steady Contributor';
    if (perf === 'medium' && pot === 'low') return 'Core Foundation';
    if (perf === 'low' && pot === 'high') return 'Rising Talent';
    if (perf === 'low' && pot === 'medium') return 'Evaluate Further';
    return 'Realign & Redirect';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="mb-1 text-2xl font-semibold text-gray-900">AI Performance Review Parser</h2>
                <p className="text-sm text-gray-600">
                  Paste a performance review to extract employee details, suggest a 9-box placement, and draft a development plan.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'input' && (
            <div className="space-y-6">
              {/* AI Status */}
              {anthropicWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {anthropicWarning}
                </div>
              )}

              <div className={`flex items-center justify-between rounded-xl border bg-gray-50 p-3 ${
                useAI && anthropicAvailable ? 'border-green-200' : 'border-gray-200'
              }`}>
                <div className="flex items-center space-x-2">
                  <Brain className={`h-5 w-5 ${useAI && anthropicAvailable ? 'text-green-600' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${useAI && anthropicAvailable ? 'text-green-900' : 'text-gray-700'}`}>
                    {useAI && anthropicAvailable ? 'AI-Powered Analysis (Claude)' : 'Pattern Matching Mode'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseAI(false)}
                    className={`text-xs font-medium underline ${useAI ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400'}`}
                    disabled={!useAI}
                  >
                    Use pattern matching
                  </button>
                  <button
                    onClick={() => {
                      if (anthropicAvailable) {
                        setUseAI(true);
                        setAnthropicWarning(null);
                      } else {
                        setAnthropicWarning('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to enable AI parsing.');
                      }
                    }}
                    className={`text-xs font-medium underline ${useAI && anthropicAvailable ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}`}
                    disabled={useAI && anthropicAvailable}
                  >
                    Enable AI
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {analysisError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-900">Analysis Error</h3>
                      <p className="mt-1 text-sm text-red-800">{analysisError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
                {/* Instructions */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start space-x-3">
                      <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="mb-2 font-semibold text-blue-900">How it works</h3>
                        <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
                          <li>Paste the full performance review.</li>
                          <li>Run analysis to extract the essentials.</li>
                          <li>Tweak the details if anything looks off.</li>
                          <li>Confirm to create the employee and plan.</li>
                        </ol>
                        <p className="mt-3 text-xs text-blue-700">
                          Tip: {useAI ? 'Claude highlights Sonance-specific strengths and risks.' : 'Mention achievements, challenges, and growth areas for better results.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Input */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Performance Review Text
                    </label>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder={`Paste the performance review here...

Example:
Employee: Sarah Johnson
Title: Senior Software Engineer
Department: Engineering

Sarah has been an exceptional performer this year. She consistently exceeded expectations on all major projects, delivering high-quality code ahead of schedule. Her technical leadership and mentoring of junior developers demonstrates strong potential for advancement.

Strengths:
- Exceptional technical skills and problem-solving
- Strong leadership and mentorship abilities
- Takes initiative on challenging projects

Areas for Development:
- Expand cross-functional collaboration
- Develop strategic planning skills...`}
                      rows={14}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {reviewText.length} characters • {reviewText.split(/\s+/).filter(w => w).length} words
                      </span>
                      {reviewText.length > 100 && (
                        <span className="font-medium text-green-600">✓ Ready for analysis</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (aiAnalysis || parsedData) && (
            <div className="space-y-6">
              {/* Confidence Banner */}
              <div className={`rounded-xl border p-4 ${
                (aiAnalysis?.confidence || parsedData?.confidence || 70) >= 80 ? 'bg-green-50 border-green-200' :
                (aiAnalysis?.confidence || parsedData?.confidence || 70) >= 60 ? 'bg-yellow-50 border-yellow-200' :
                'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-center space-x-3">
                  {aiAnalysis ? <Brain className="w-6 h-6 text-green-600" /> : <CheckCircle2 className={`w-6 h-6 ${getConfidenceColor(parsedData?.confidence || 70)}`} />}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">
                      {aiAnalysis ? '🧠 AI Analysis Complete' : `Analysis Complete - ${parsedData?.confidence}% Confidence`}
                    </h3>
                    <p className="text-sm text-gray-700">
                      {aiAnalysis ? aiAnalysis.reasoning : 'Review the extracted information below and make any necessary adjustments'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Sonance-Specific Insights (AI Only) */}
              {aiAnalysis && aiAnalysis.sonanceSpecificInsights.length > 0 && (
                <div className="rounded-xl border border-purple-100 bg-white p-5">
                  <h3 className="mb-3 flex items-center font-semibold text-purple-900">
                    <Sparkles className="mr-2 h-5 w-5 text-purple-600" />
                    Sonance-Specific Insights
                  </h3>
                  <div className="space-y-2">
                    {aiAnalysis.sonanceSpecificInsights.map((insight, i) => (
                      <div key={i} className="flex items-start space-x-3 rounded-lg bg-purple-50 p-3">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500 text-xs font-semibold text-white">
                          {i + 1}
                        </div>
                        <p className="flex-1 text-sm text-purple-900">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employee Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Department
                  </label>
                  <select
                    value={editedDepartment}
                    onChange={(e) => setEditedDepartment(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select department...</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* 9-Box Placement Suggestion */}
              <div className="rounded-xl border border-indigo-100 bg-white p-6">
                <h3 className="mb-4 flex items-center font-semibold text-gray-900">
                  <Target className="mr-2 h-5 w-5 text-indigo-600" />
                  Suggested 9-Box Placement
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Performance Level
                    </label>
                    <select
                      value={editedPerformance}
                      onChange={(e) => setEditedPerformance(e.target.value as Performance)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Potential Level
                    </label>
                    <select
                      value={editedPotential}
                      onChange={(e) => setEditedPotential(e.target.value as Potential)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Will be placed in:</span>
                    <span className="text-lg font-semibold text-indigo-700">
                      {getBoxLabel(editedPerformance, editedPotential)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Insights */}
              {aiAnalysis ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                      Key Strengths
                    </h3>
                    <div className="bg-green-50 rounded-lg p-4 space-y-2">
                      {aiAnalysis.keyStrengths.map((strength, i) => (
                        <div key={i} className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{strength}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                      <Target className="w-5 h-5 text-orange-600 mr-2" />
                      Development Areas
                    </h3>
                    <div className="bg-orange-50 rounded-lg p-4 space-y-2">
                      {aiAnalysis.developmentAreas.map((area, i) => (
                        <div key={i} className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{area}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : parsedData && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
                    Key Insights Extracted
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {parsedData.keyInsights.map((insight, i) => (
                      <div key={i} className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable Plan */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  {aiAnalysis ? 'Edit AI-Generated Plan' : 'Edit Plan'}
                </h3>
                
                {/* Timeline */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Timeline
                  </label>
                  <select
                    value={editedTimeline}
                    onChange={(e) => setEditedTimeline(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="30 days">30 days</option>
                    <option value="60 days">60 days</option>
                    <option value="90 days">90 days</option>
                    <option value="6 months">6 months</option>
                    <option value="12 months">12 months</option>
                  </select>
                </div>

                <div className="space-y-4">
                  {/* Editable Objectives */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-blue-900">Key Objectives</h4>
                      <button
                        onClick={() => setEditedObjectives([...editedObjectives, ''])}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editedObjectives.map((obj, i) => (
                        <div key={i} className="flex items-start space-x-2">
                          <input
                            type="text"
                            value={obj}
                            onChange={(e) => {
                              const updated = [...editedObjectives];
                              updated[i] = e.target.value;
                              setEditedObjectives(updated);
                            }}
                            className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter objective..."
                          />
                          <button
                            onClick={() => setEditedObjectives(editedObjectives.filter((_, idx) => idx !== i))}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Editable Action Items */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-green-900">Action Items</h4>
                      <button
                        onClick={() => setEditedActionItems([...editedActionItems, { description: '', dueDate: '90 days', priority: 'medium' }])}
                        className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </button>
                    </div>
                    <div className="space-y-3">
                      {editedActionItems.map((item, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 border border-green-300">
                          <div className="flex items-start space-x-2 mb-2">
                            <input
                              type="text"
                              value={typeof item === 'string' ? item : item.description}
                              onChange={(e) => {
                                const updated = [...editedActionItems];
                                if (typeof updated[i] === 'string') {
                                  updated[i] = { description: e.target.value, dueDate: '90 days', priority: 'medium' };
                                } else {
                                  updated[i] = { ...updated[i], description: e.target.value };
                                }
                                setEditedActionItems(updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                              placeholder="Action description..."
                            />
                            <button
                              onClick={() => setEditedActionItems(editedActionItems.filter((_, idx) => idx !== i))}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {typeof item !== 'string' && (
                            <div className="flex space-x-2">
                              <select
                                value={item.dueDate}
                                onChange={(e) => {
                                  const updated = [...editedActionItems];
                                  updated[i] = { ...updated[i], dueDate: e.target.value };
                                  setEditedActionItems(updated);
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="30 days">30 days</option>
                                <option value="60 days">60 days</option>
                                <option value="90 days">90 days</option>
                              </select>
                              <select
                                value={item.priority}
                                onChange={(e) => {
                                  const updated = [...editedActionItems];
                                  updated[i] = { ...updated[i], priority: e.target.value };
                                  setEditedActionItems(updated);
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              >
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Editable Success Metrics */}
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-purple-900">Success Metrics</h4>
                      <button
                        onClick={() => setEditedSuccessMetrics([...editedSuccessMetrics, ''])}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editedSuccessMetrics.map((metric, i) => (
                        <div key={i} className="flex items-start space-x-2">
                          <input
                            type="text"
                            value={metric}
                            onChange={(e) => {
                              const updated = [...editedSuccessMetrics];
                              updated[i] = e.target.value;
                              setEditedSuccessMetrics(updated);
                            }}
                            className="flex-1 px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter success metric..."
                          />
                          <button
                            onClick={() => setEditedSuccessMetrics(editedSuccessMetrics.filter((_, idx) => idx !== i))}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6">
          <button
            onClick={step === 'review' ? () => setStep('input') : handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            {step === 'review' ? '← Back' : 'Cancel'}
          </button>
          
          {step === 'input' ? (
            <button
              onClick={handleAnalyze}
              disabled={reviewText.length < 100 || isAnalyzing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Analyze Review</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!editedName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Create Employee & Generate Plan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
