import { useState, useMemo, useEffect } from 'react';
import { Zap, Palette, BarChart3, ChevronDown, ChevronRight, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import type { Employee, EmployeePlan } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';

interface EmployeeProgress {
  employee: Employee;
  has360: boolean;
  has360InProgress: boolean;
  hasReview: boolean;
  hasPlan: boolean;
  hasJobDescription: boolean;
  completionPercentage: number;
}

interface SuggestedNextStepsProps {
  employeeProgress: EmployeeProgress[];
  surveys360: any[];
  onOpenReviewModal: (employee: Employee) => void;
  onOpenPlanModal: (employee: Employee) => void;
  onOpen360Modal: (employee: Employee) => void;
  onOpenDetailModal: (employee: Employee) => void;
  organizationId: string;
  onOpenBatchReviewFlow?: (employees: Employee[], title: string, description: string) => void;
}

type SuggestionCategory = 'quick-win' | 'build-context' | 'analyze';

interface Suggestion {
  id: string;
  category: SuggestionCategory;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: number;
  enabled: boolean;
  employeeIds: string[];
  employeeNames: string[];
  action: () => void;
}

const STORAGE_KEY_PREFIX = 'sonance-next-steps-completed';

export default function SuggestedNextSteps({
  employeeProgress,
  surveys360,
  onOpenReviewModal,
  onOpenPlanModal,
  onOpen360Modal,
  onOpenDetailModal,
  organizationId,
  onOpenBatchReviewFlow,
}: SuggestedNextStepsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SuggestionCategory>>(
    new Set(['quick-win', 'build-context'])
  );
  const [completedToday, setCompletedToday] = useState<Set<string>>(() => loadCompletedFromStorage(organizationId));

  // Save completed suggestions to localStorage
  useEffect(() => {
    saveCompletedToStorage(organizationId, completedToday);
  }, [completedToday, organizationId]);

  // Generate suggestions based on employee progress
  const suggestions = useMemo(() => {
    return generateSuggestions(
      employeeProgress,
      surveys360,
      onOpenReviewModal,
      onOpenPlanModal,
      onOpen360Modal,
      onOpenDetailModal,
      onOpenBatchReviewFlow
    );
  }, [employeeProgress, surveys360, onOpenReviewModal, onOpenPlanModal, onOpen360Modal, onOpenDetailModal, onOpenBatchReviewFlow]);

  const toggleSection = (category: SuggestionCategory) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedSections(newExpanded);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    // Mark as completed
    const newCompleted = new Set(completedToday);
    newCompleted.add(suggestion.id);
    setCompletedToday(newCompleted);

    // Execute the action
    suggestion.action();
  };

  const quickWins = suggestions.filter(s => s.category === 'quick-win');
  const buildContext = suggestions.filter(s => s.category === 'build-context');
  const analyze = suggestions.filter(s => s.category === 'analyze');

  const totalSuggestions = suggestions.length;
  const completedCount = suggestions.filter(s => completedToday.has(s.id)).length;

  if (totalSuggestions === 0) {
    return null; // Don't show if no suggestions
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Suggested Next Steps
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {completedCount > 0 ? (
              <span className="text-green-700 font-medium">
                {completedCount} of {totalSuggestions} completed today
              </span>
            ) : (
              <span>
                {totalSuggestions} action{totalSuggestions !== 1 ? 's' : ''} to complete team profiles
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Quick Wins Section */}
      {quickWins.length > 0 && (
        <SuggestionSection
          category="quick-win"
          title="Quick Wins"
          subtitle="5-10 min each"
          icon={Zap}
          iconColor="text-yellow-600"
          bgColor="bg-yellow-50"
          borderColor="border-yellow-200"
          suggestions={quickWins}
          isExpanded={expandedSections.has('quick-win')}
          onToggle={() => toggleSection('quick-win')}
          onSuggestionClick={handleSuggestionClick}
          completedIds={completedToday}
        />
      )}

      {/* Build Context Section */}
      {buildContext.length > 0 && (
        <SuggestionSection
          category="build-context"
          title="Build Context"
          subtitle="15-30 min each"
          icon={Palette}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
          suggestions={buildContext}
          isExpanded={expandedSections.has('build-context')}
          onToggle={() => toggleSection('build-context')}
          onSuggestionClick={handleSuggestionClick}
          completedIds={completedToday}
        />
      )}

      {/* Analyze Section */}
      {analyze.length > 0 && (
        <SuggestionSection
          category="analyze"
          title="Analyze"
          subtitle="When 360s are ready"
          icon={BarChart3}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
          suggestions={analyze}
          isExpanded={expandedSections.has('analyze')}
          onToggle={() => toggleSection('analyze')}
          onSuggestionClick={handleSuggestionClick}
          completedIds={completedToday}
        />
      )}
    </div>
  );
}

// Suggestion Section Component
interface SuggestionSectionProps {
  category: SuggestionCategory;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  suggestions: Suggestion[];
  isExpanded: boolean;
  onToggle: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  completedIds: Set<string>;
}

function SuggestionSection({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  bgColor,
  borderColor,
  suggestions,
  isExpanded,
  onToggle,
  onSuggestionClick,
  completedIds,
}: SuggestionSectionProps) {
  const incompleteSuggestions = suggestions.filter(s => !completedIds.has(s.id));
  const completedSuggestions = suggestions.filter(s => completedIds.has(s.id));

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 mt-3`}>
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="font-semibold text-gray-900">{title}</span>
          <span className="text-sm text-gray-600">({subtitle})</span>
          {incompleteSuggestions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs font-medium text-gray-700">
              {incompleteSuggestions.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Suggestions List */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {incompleteSuggestions.map(suggestion => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              isCompleted={false}
            />
          ))}
          {completedSuggestions.map(suggestion => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onClick={() => {}}
              isCompleted={true}
            />
          ))}
          {suggestions.length === 0 && (
            <p className="text-sm text-gray-500 italic">No suggestions in this category</p>
          )}
        </div>
      )}
    </div>
  );
}

// Individual Suggestion Item
interface SuggestionItemProps {
  suggestion: Suggestion;
  onClick: () => void;
  isCompleted: boolean;
}

function SuggestionItem({ suggestion, onClick, isCompleted }: SuggestionItemProps) {
  const disabled = !suggestion.enabled;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isCompleted}
      className={`w-full flex items-start justify-between p-3 rounded-lg border transition-all text-left ${
        isCompleted
          ? 'bg-gray-50 border-gray-200 opacity-60'
          : disabled
          ? 'bg-white border-gray-200 opacity-50 cursor-not-allowed'
          : 'bg-white border-gray-300 hover:border-blue-400 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-start gap-3 flex-1">
        {/* Checkbox */}
        <div className="mt-0.5">
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : disabled ? (
            <Clock className="w-5 h-5 text-gray-400" />
          ) : (
            <div className="w-5 h-5 rounded border-2 border-gray-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
              {suggestion.title}
            </span>
            {!isCompleted && (
              <span className="text-xs text-gray-500">
                ~{suggestion.estimatedMinutes} min
              </span>
            )}
          </div>
          {suggestion.description && (
            <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
          )}
          {suggestion.employeeNames.length > 0 && suggestion.employeeNames.length <= 3 && (
            <p className="text-sm text-blue-600 mt-1">
              {suggestion.employeeNames.join(', ')}
            </p>
          )}
        </div>

        {/* Arrow */}
        {!isCompleted && !disabled && (
          <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}

// Suggestion Generation Logic
function generateSuggestions(
  employeeProgress: EmployeeProgress[],
  surveys360: any[],
  onOpenReviewModal: (employee: Employee) => void,
  onOpenPlanModal: (employee: Employee) => void,
  onOpen360Modal: (employee: Employee) => void,
  onOpenDetailModal: (employee: Employee) => void,
  onOpenBatchReviewFlow?: (employees: Employee[], title: string, description: string) => void
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const now = new Date();
  const hour = now.getHours();

  // Employees missing reviews
  const needsReview = employeeProgress.filter(ep => !ep.hasReview);
  if (needsReview.length > 0) {
    const names = needsReview.slice(0, 3).map(ep => ep.employee.name);
    const showNames = needsReview.length <= 3;
    const employees = needsReview.map(ep => ep.employee);
    
    suggestions.push({
      id: 'add-reviews',
      category: 'quick-win',
      title: `Add performance reviews for ${needsReview.length} team member${needsReview.length !== 1 ? 's' : ''}`,
      description: showNames ? '' : `${names.join(', ')}${needsReview.length > 3 ? ` and ${needsReview.length - 3} more` : ''}`,
      estimatedMinutes: 10,
      priority: 8 + needsReview.length * 2,
      enabled: true,
      employeeIds: needsReview.map(ep => ep.employee.id),
      employeeNames: showNames ? names : [],
      action: () => {
        // Use batch flow for multiple employees, single modal for one
        if (needsReview.length > 1 && onOpenBatchReviewFlow) {
          onOpenBatchReviewFlow(
            employees,
            'Add Performance Reviews',
            `Review all ${needsReview.length} team members sequentially. Click through each person to add their review.`
          );
        } else {
          onOpenReviewModal(needsReview[0].employee);
        }
      },
    });
  }

  // Employees missing job descriptions
  const needsJobDesc = employeeProgress.filter(ep => !ep.hasJobDescription);
  if (needsJobDesc.length > 0) {
    const names = needsJobDesc.slice(0, 3).map(ep => ep.employee.name);
    const showNames = needsJobDesc.length <= 3;

    suggestions.push({
      id: 'add-job-descriptions',
      category: 'quick-win',
      title: `Complete job descriptions for ${needsJobDesc.length} team member${needsJobDesc.length !== 1 ? 's' : ''}`,
      description: showNames ? '' : '',
      estimatedMinutes: 8,
      priority: 6 + needsJobDesc.length * 2,
      enabled: true,
      employeeIds: needsJobDesc.map(ep => ep.employee.id),
      employeeNames: showNames ? names : [],
      action: () => onOpenDetailModal(needsJobDesc[0].employee),
    });
  }

  // Employees missing development plans (but have reviews)
  const needsPlan = employeeProgress.filter(ep => ep.hasReview && !ep.hasPlan);
  if (needsPlan.length > 0) {
    suggestions.push({
      id: 'create-dev-plans',
      category: 'build-context',
      title: `Create development plans for ${needsPlan.length} team member${needsPlan.length !== 1 ? 's' : ''}`,
      description: 'Turn performance feedback into actionable growth roadmaps',
      estimatedMinutes: 20,
      priority: 7 + needsPlan.length * 2,
      enabled: true,
      employeeIds: needsPlan.map(ep => ep.employee.id),
      employeeNames: [],
      action: () => onOpenPlanModal(needsPlan[0].employee),
    });
  }

  // Employees without 360s
  const needs360 = employeeProgress.filter(ep => !ep.has360 && !ep.has360InProgress);
  if (needs360.length > 0 && needs360.length <= 5) {
    suggestions.push({
      id: 'launch-360s',
      category: 'quick-win',
      title: `Launch 360 reviews for ${needs360.length} team member${needs360.length !== 1 ? 's' : ''}`,
      description: 'Get multi-source feedback to inform talent decisions',
      estimatedMinutes: 10,
      priority: 9 + needs360.length * 2,
      enabled: true,
      employeeIds: needs360.map(ep => ep.employee.id),
      employeeNames: [],
      action: () => onOpen360Modal(needs360[0].employee),
    });
  }

  // 360s completed - ready to analyze
  const completed360s = employeeProgress.filter(ep => ep.has360);
  if (completed360s.length > 0) {
    suggestions.push({
      id: 'review-360-feedback',
      category: 'analyze',
      title: `Review 360 feedback for ${completed360s.length} team member${completed360s.length !== 1 ? 's' : ''}`,
      description: 'Analyze multi-source feedback and update profiles',
      estimatedMinutes: 30,
      priority: 10,
      enabled: true,
      employeeIds: completed360s.map(ep => ep.employee.id),
      employeeNames: [],
      action: () => onOpenDetailModal(completed360s[0].employee),
    });
  }

  // Pending 360s - suggest building context
  const pending360s = employeeProgress.filter(ep => ep.has360InProgress);
  if (pending360s.length > 0 && hour < 14) { // Before 2pm
    suggestions.push({
      id: 'build-context-while-waiting',
      category: 'build-context',
      title: `Add context while ${pending360s.length} 360 review${pending360s.length !== 1 ? 's are' : ' is'} pending`,
      description: 'Complete reviews and plans to be ready when feedback arrives',
      estimatedMinutes: 25,
      priority: 5,
      enabled: true,
      employeeIds: pending360s.map(ep => ep.employee.id),
      employeeNames: [],
      action: () => {
        // Find first employee with pending 360 that needs a review or plan
        const needsWork = pending360s.find(ep => !ep.hasReview || !ep.hasPlan);
        if (needsWork) {
          if (!needsWork.hasReview) {
            onOpenReviewModal(needsWork.employee);
          } else if (!needsWork.hasPlan) {
            onOpenPlanModal(needsWork.employee);
          }
        }
      },
    });
  }

  // Sort by priority (highest first)
  return suggestions.sort((a, b) => b.priority - a.priority);
}

// LocalStorage helpers
function loadCompletedFromStorage(organizationId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  
  try {
    const key = `${STORAGE_KEY_PREFIX}-${organizationId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return new Set();

    const data = JSON.parse(stored);
    const today = new Date().toDateString();

    // Reset if it's a new day
    if (data.date !== today) {
      return new Set();
    }

    return new Set(data.completed);
  } catch (error) {
    console.error('Error loading completed suggestions:', error);
    return new Set();
  }
}

function saveCompletedToStorage(organizationId: string, completed: Set<string>) {
  if (typeof window === 'undefined') return;

  try {
    const key = `${STORAGE_KEY_PREFIX}-${organizationId}`;
    const today = new Date().toDateString();
    const data = {
      date: today,
      completed: Array.from(completed),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving completed suggestions:', error);
  }
}

