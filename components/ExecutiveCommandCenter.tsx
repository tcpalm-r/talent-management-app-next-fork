import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight, Sparkles, Target, AlertTriangle, Clock } from 'lucide-react';
import type { Employee, EmployeePlan, Department } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import { 
  calculateTalentHealthScore, 
  getComponentLabel, 
  getComponentDescription,
  getScoreStatus,
  getStatusColor,
  type HealthScoreComponents,
} from '../lib/talentHealthScore';
import { useQuickAction } from '../context/QuickActionContext';
import CriticalDecisionsPriority from './CriticalDecisionsPriority';
import TalentPortfolioWidget from './TalentPortfolioWidget';

interface ExecutiveCommandCenterProps {
  employees: Employee[];
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  employeePlans: Record<string, EmployeePlan>;
  departments: Department[];
  onNavigate: (view: string) => void;
  onCreateRetentionPlans?: (employeeIds: string[]) => void;
  onViewEmployees?: (employees: Employee[]) => void;
}

export default function ExecutiveCommandCenter({
  employees,
  performanceReviews,
  employeePlans,
  departments,
  onNavigate,
  onCreateRetentionPlans,
  onViewEmployees,
}: ExecutiveCommandCenterProps) {
  const { executeAction } = useQuickAction();

  // Calculate health score
  const healthScore = useMemo(() => {
    return calculateTalentHealthScore(employees, performanceReviews, employeePlans, departments);
  }, [employees, performanceReviews, employeePlans, departments]);

  const TrendIcon = 
    healthScore.trend === 'improving' ? TrendingUp :
    healthScore.trend === 'declining' ? TrendingDown :
    Minus;

  const trendColor =
    healthScore.trend === 'improving' ? 'text-green-600' :
    healthScore.trend === 'declining' ? 'text-red-600' :
    'text-gray-600';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Executive Command Center</h1>
        <p className="text-gray-600 mt-2">
          Your talent health at a glance - track what matters, act on what's urgent
        </p>
      </div>

      {/* Hero Metric - The One Number */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl shadow-2xl p-8 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-sm uppercase tracking-wider opacity-90 mb-2">
              Organizational Talent Health
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="text-8xl font-bold">
                {healthScore.overall}
              </div>
              <div className="text-4xl font-light opacity-75">/100</div>
            </div>
            
            {/* Trend */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <TrendIcon className="w-6 h-6" />
              <span className="text-lg font-semibold">
                {healthScore.changeFromPrevious > 0 && '+'}
                {healthScore.changeFromPrevious} from last calculation
              </span>
              <span className="ml-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                {healthScore.trend === 'improving' ? '📈 Improving' :
                 healthScore.trend === 'declining' ? '📉 Declining' :
                 '➡️ Stable'}
              </span>
            </div>

            {/* Quick Summary */}
            <div className="mt-6 text-sm opacity-90">
              {healthScore.breakdown.strengths.length > 0 && (
                <div className="mb-2">
                  ✓ {healthScore.breakdown.strengths[0]}
                </div>
              )}
              {healthScore.breakdown.concerns.length > 0 && (
                <div>
                  ⚠ {healthScore.breakdown.concerns[0]}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Health Score Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {(Object.keys(healthScore.components) as Array<keyof HealthScoreComponents>).map(key => {
            const score = healthScore.components[key];
            const status = getScoreStatus(score);
            const color = getStatusColor(status);
            
            return (
              <ComponentCard
                key={key}
                label={getComponentLabel(key)}
                description={getComponentDescription(key)}
                score={score}
                status={status}
                color={color}
                onClick={() => {
                  // Navigate to relevant view
                  if (key === 'talentQuality') onNavigate('evaluate');
                  else if (key === 'developmentMomentum') onNavigate('follow');
                  else if (key === 'reviewDiscipline') onNavigate('prepare');
                  else if (key === 'successionReadiness') onNavigate('admin');
                  else if (key === 'culturalFit') onNavigate('prepare');
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Critical Decisions */}
      <div>
        <CriticalDecisionsPriority
          employees={employees}
          performanceReviews={performanceReviews}
          employeePlans={employeePlans}
          departments={departments}
          onCreateRetentionPlans={onCreateRetentionPlans}
          onViewEmployees={onViewEmployees}
          onNavigate={onNavigate}
        />
      </div>

      {/* Quick Wins */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Wins to Improve Score</h2>
        <QuickWinsSection
          employees={employees}
          performanceReviews={performanceReviews}
          employeePlans={employeePlans}
          currentScore={healthScore.overall}
          onNavigate={onNavigate}
        />
      </div>

      {/* Talent Portfolio */}
      <div>
        <TalentPortfolioWidget
          employees={employees}
          employeePlans={employeePlans}
        />
      </div>

      {/* Insights Summary */}
      {(healthScore.breakdown.strengths.length > 0 || healthScore.breakdown.concerns.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          {healthScore.breakdown.strengths.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                What's Working Well
              </h3>
              <ul className="space-y-2">
                {healthScore.breakdown.strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-green-800">
                    <span className="text-green-600 flex-shrink-0 mt-0.5">✓</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns & Recommendations */}
          {healthScore.breakdown.concerns.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Areas for Improvement
              </h3>
              <div className="space-y-4">
                {healthScore.breakdown.concerns.map((concern, idx) => (
                  <div key={idx}>
                    <div className="flex items-start gap-2 text-sm text-amber-800 mb-1">
                      <span className="text-amber-600 flex-shrink-0 mt-0.5">⚠</span>
                      <span className="font-medium">{concern}</span>
                    </div>
                    {healthScore.breakdown.recommendations[idx] && (
                      <div className="ml-5 text-xs text-amber-700">
                        → {healthScore.breakdown.recommendations[idx]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Component Score Card
 */
interface ComponentCardProps {
  label: string;
  description: string;
  score: number;
  status: 'excellent' | 'good' | 'needs-improvement' | 'critical';
  color: string;
  onClick: () => void;
}

function ComponentCard({ label, description, score, status, color, onClick }: ComponentCardProps) {
  const bgColors = {
    green: 'bg-green-50 border-green-200 hover:bg-green-100',
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    red: 'bg-red-50 border-red-200 hover:bg-red-100',
  };

  const textColors = {
    green: 'text-green-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  };

  const scoreColors = {
    green: 'text-green-900',
    blue: 'text-blue-900',
    amber: 'text-amber-900',
    red: 'text-red-900',
  };

  return (
    <div
      onClick={onClick}
      className={`${bgColors[color as keyof typeof bgColors]} border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md group`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide mb-2 ${textColors[color as keyof typeof textColors]}">
        {label}
      </div>
      <div className={`text-4xl font-bold mb-2 ${scoreColors[color as keyof typeof scoreColors]}`}>
        {score}
      </div>
      <div className="text-xs text-gray-600 mb-3">
        {description}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${textColors[color as keyof typeof textColors]}`}>
          {status === 'excellent' && '🌟 Excellent'}
          {status === 'good' && '✓ Good'}
          {status === 'needs-improvement' && '⚠ Needs Work'}
          {status === 'critical' && '🔴 Critical'}
        </span>
        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

/**
 * Quick Wins Section
 */
interface QuickWinsSectionProps {
  employees: Employee[];
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  employeePlans: Record<string, EmployeePlan>;
  currentScore: number;
  onNavigate: (view: string) => void;
}

function QuickWinsSection({
  employees,
  performanceReviews,
  employeePlans,
  currentScore,
  onNavigate,
}: QuickWinsSectionProps) {
  const quickWins = useMemo(() => {
    const wins: Array<{
      impact: number;
      title: string;
      effort: string;
      action: () => void;
    }> = [];

    // Pending reviews
    const pendingReviews = employees.filter(e => {
      const record = performanceReviews[e.id];
      return e.assessment && (!record?.manager || record.manager.status !== 'completed');
    });

    if (pendingReviews.length > 0) {
      wins.push({
        impact: Math.min(pendingReviews.length * 0.4, 5),
        title: `Complete ${pendingReviews.length} pending manager reviews`,
        effort: `${Math.ceil(pendingReviews.length / 6)} hour${pendingReviews.length > 6 ? 's' : ''}`,
        action: () => onNavigate('prepare'),
      });
    }

    // Missing plans
    const needsPlans = employees.filter(e => e.assessment && !employeePlans[e.id]);
    if (needsPlans.length > 0) {
      wins.push({
        impact: Math.min(needsPlans.length * 0.35, 5),
        title: `Create ${needsPlans.length} development plans with AI assist`,
        effort: `${Math.ceil(needsPlans.length / 8)} hour${needsPlans.length > 8 ? 's' : ''}`,
        action: () => onNavigate('follow'),
      });
    }

    // Unassessed employees
    const unassessed = employees.filter(e => !e.assessment);
    if (unassessed.length > 0) {
      wins.push({
        impact: Math.min(unassessed.length * 0.5, 6),
        title: `Assess ${unassessed.length} employees on 9-box grid`,
        effort: `${Math.ceil(unassessed.length / 10)} hour${unassessed.length > 10 ? 's' : ''}`,
        action: () => onNavigate('evaluate'),
      });
    }

    // Sort by impact
    return wins.sort((a, b) => b.impact - a.impact).slice(0, 3);
  }, [employees, performanceReviews, employeePlans, onNavigate]);

  if (quickWins.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <Sparkles className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-green-900 mb-2">You're All Caught Up!</h3>
        <p className="text-sm text-green-800">
          No immediate actions needed. Your talent management is running smoothly.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {quickWins.map((win, idx) => (
        <button
          key={idx}
          onClick={win.action}
          className="text-left p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-lg transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                +{Math.round(win.impact)}
              </div>
              <div className="text-xs text-gray-600">points</div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>

          <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            {win.title}
          </h4>

          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Clock className="w-3.5 h-3.5" />
            <span>{win.effort} effort</span>
          </div>

          <div className="mt-3 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Click to take action →
          </div>
        </button>
      ))}
    </div>
  );
}

