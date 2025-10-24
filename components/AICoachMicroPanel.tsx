import { useState, useEffect, ComponentType } from 'react';
import { Sparkles, X, Lightbulb, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';
import { useUnifiedAICoach } from '../context/UnifiedAICoachContext';

interface MicroSuggestion {
  id: string;
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  priority?: 'high' | 'medium' | 'low';
  action?: () => void;
  actionLabel?: string;
  autoHideAfter?: number;
}

interface AICoachMicroPanelProps {
  context: string;
  suggestions: MicroSuggestion[];
  maxVisible?: number;
  position?: 'top' | 'bottom' | 'inline';
  compact?: boolean;
}

export function AICoachMicroPanel({
  context,
  suggestions,
  maxVisible = 2,
  position = 'inline',
  compact = false,
}: AICoachMicroPanelProps) {
  const { dismissSuggestion, trackAction } = useUnifiedAICoach();
  const [visibleSuggestions, setVisibleSuggestions] = useState<MicroSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Filter out dismissed suggestions
    const activeSuggestions = suggestions.filter(s => !dismissed.has(s.id));
    setVisibleSuggestions(activeSuggestions.slice(0, maxVisible));

    // Auto-hide suggestions with timeout
    activeSuggestions.forEach(suggestion => {
      if (suggestion.autoHideAfter) {
        setTimeout(() => {
          handleDismiss(suggestion.id);
        }, suggestion.autoHideAfter);
      }
    });
  }, [suggestions, dismissed, maxVisible]);

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    dismissSuggestion(id);
    trackAction('micro-suggestion-dismissed', { context, suggestionId: id });
  };

  const handleAction = (suggestion: MicroSuggestion) => {
    if (suggestion.action) {
      suggestion.action();
      trackAction('micro-suggestion-action', { context, suggestionId: suggestion.id });
      handleDismiss(suggestion.id);
    }
  };

  if (visibleSuggestions.length === 0) return null;

  const priorityColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    low: 'border-blue-200 bg-blue-50',
  };

  const iconMap = {
    high: AlertCircle,
    medium: Lightbulb,
    low: TrendingUp,
  };

  // Compact mode - single line with icon
  if (compact) {
    return (
      <div className="space-y-2">
        {visibleSuggestions.map(suggestion => {
          const Icon = suggestion.icon || iconMap[suggestion.priority || 'low'];
          const colorClass = priorityColors[suggestion.priority || 'low'];

          return (
            <div
              key={suggestion.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass} text-sm animate-slide-in`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 text-purple-600" />
              <span className="flex-1 font-medium text-gray-800">{suggestion.title}</span>
              {suggestion.action && (
                <button
                  onClick={() => handleAction(suggestion)}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                >
                  {suggestion.actionLabel || 'View'}
                </button>
              )}
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // Full mode - detailed cards
  return (
    <div className={`space-y-3 ${position === 'top' ? 'mb-4' : position === 'bottom' ? 'mt-4' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-purple-600">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">AI Coach</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-purple-200 to-transparent" />
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        {visibleSuggestions.map(suggestion => {
          const Icon = suggestion.icon || iconMap[suggestion.priority || 'low'];
          const colorClass = priorityColors[suggestion.priority || 'low'];

          return (
            <div
              key={suggestion.id}
              className={`rounded-lg border p-3 ${colorClass} animate-slide-in shadow-sm hover:shadow-md transition-all`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 text-purple-600" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-gray-900 mb-1">
                    {suggestion.title}
                  </h4>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {suggestion.description}
                  </p>
                  {suggestion.action && (
                    <button
                      onClick={() => handleAction(suggestion)}
                      className="mt-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-colors shadow-sm hover:shadow inline-flex items-center gap-1"
                    >
                      {suggestion.actionLabel || 'Take action'}
                      <CheckCircle className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="p-1 hover:bg-white/50 rounded transition-colors flex-shrink-0"
                  title="Dismiss"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function to generate common micro-suggestions
export function getEmployeeModalSuggestions(data: {
  employeeId: string;
  employeeName: string;
  hasPlan: boolean;
  hasReview: boolean;
  hasRecentOneOnOne: boolean;
  hasWorkingGenius: boolean;
}): MicroSuggestion[] {
  const suggestions: MicroSuggestion[] = [];

  if (!data.hasRecentOneOnOne) {
    suggestions.push({
      id: `quick-win-1on1-${data.employeeId}`,
      title: 'Schedule next 1:1',
      description: `Keep momentum with ${data.employeeName} by scheduling regular check-ins.`,
      icon: Lightbulb,
      priority: 'medium',
      actionLabel: 'Open calendar',
    });
  }

  if (!data.hasPlan) {
    suggestions.push({
      id: `missing-plan-${data.employeeId}`,
      title: 'Create development plan',
      description: 'Turn your assessment into actionable growth objectives.',
      icon: TrendingUp,
      priority: 'high',
      actionLabel: 'AI draft plan',
    });
  }

  if (!data.hasWorkingGenius) {
    suggestions.push({
      id: `missing-wg-${data.employeeId}`,
      title: 'Add Working Genius profile',
      description: 'Understand their strengths to assign the right work.',
      icon: Lightbulb,
      priority: 'low',
      actionLabel: 'Add profile',
    });
  }

  return suggestions;
}

// Helper for 9-box placement tips
export function getPlacementTip(performance: string, potential: string): MicroSuggestion {
  const key = `${performance}-${potential}`;

  const tips: Record<string, { title: string; description: string; priority: 'high' | 'medium' | 'low' }> = {
    'high-high': {
      title: 'High Performer, High Potential',
      description: 'This is a key retention risk. Consider succession planning, stretch assignments, and proactive career conversations.',
      priority: 'high',
    },
    'high-medium': {
      title: 'High Performer, Medium Potential',
      description: 'Strong contributor. Focus on deepening expertise and expanding impact in their current role.',
      priority: 'medium',
    },
    'high-low': {
      title: 'High Performer, Low Potential',
      description: 'Valuable specialist. Keep them engaged with technical challenges and recognition.',
      priority: 'medium',
    },
    'medium-high': {
      title: 'Medium Performer, High Potential',
      description: 'Growth opportunity. Invest in skill development, coaching, and removing blockers.',
      priority: 'high',
    },
    'medium-medium': {
      title: 'Medium Performer, Medium Potential',
      description: 'Solid contributor. Clarify expectations and provide targeted development.',
      priority: 'medium',
    },
    'medium-low': {
      title: 'Medium Performer, Low Potential',
      description: 'Steady contributor. Set clear expectations and monitor performance trends.',
      priority: 'low',
    },
    'low-high': {
      title: 'Low Performer, High Potential',
      description: 'Underperforming but capable. Focus on skill gaps, coaching, and alignment. High priority.',
      priority: 'high',
    },
    'low-medium': {
      title: 'Low Performer, Medium Potential',
      description: 'Performance concerns. Create improvement plan with clear milestones and timelines.',
      priority: 'high',
    },
    'low-low': {
      title: 'Low Performer, Low Potential',
      description: 'Critical situation. Determine if this is the right role or if a performance improvement plan is needed.',
      priority: 'high',
    },
  };

  const tip = tips[key] || {
    title: 'Employee Placed',
    description: 'Consider creating a development plan to support their growth.',
    priority: 'medium' as const,
  };

  return {
    id: `placement-tip-${key}`,
    ...tip,
    icon: AlertCircle,
    autoHideAfter: 8000, // Auto-hide after 8 seconds
  };
}
