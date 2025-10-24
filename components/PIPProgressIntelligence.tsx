import { useMemo } from 'react';
import { Brain, ChevronDown, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calendar, Bell } from 'lucide-react';
import { useState } from 'react';
import type { PerformanceImprovementPlan, PIPExpectation, PIPCheckIn, PIPMilestoneReview } from '../types';

interface PIPProgressIntelligenceProps {
  pip: PerformanceImprovementPlan;
  expectations: PIPExpectation[];
  checkIns: PIPCheckIn[];
  milestoneReviews: PIPMilestoneReview[];
  employeeName: string;
}

type PIPTrajectory = 'on_track' | 'at_risk' | 'failing' | 'uncertain';
type AlertSeverity = 'critical' | 'warning' | 'info';

interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommendation: string;
}

interface RecommendedAction {
  id: string;
  priority: 'urgent' | 'high' | 'medium';
  action: string;
  why: string;
}

export default function PIPProgressIntelligence({
  pip,
  expectations,
  checkIns,
  milestoneReviews,
  employeeName,
}: PIPProgressIntelligenceProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Analyze PIP progress and generate insights
  const analysis = useMemo(() => {
    const startDate = new Date(pip.start_date);
    const today = new Date();
    const daysInPIP = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = 90 - daysInPIP;

    // Expectation analysis
    const metExpectations = expectations.filter(e => e.status === 'met').length;
    const partialExpectations = expectations.filter(e => e.status === 'partially_met').length;
    const notMetExpectations = expectations.filter(e => e.status === 'not_met').length;
    const totalExpectations = expectations.length;

    // Check-in analysis
    const expectedCheckIns = Math.max(1, Math.floor(daysInPIP / 7));
    const actualCheckIns = checkIns.length;
    const checkInGap = actualCheckIns < expectedCheckIns;

    // Recent check-in
    let daysSinceLastCheckIn = 999;
    if (checkIns.length > 0) {
      const sorted = checkIns.sort((a, b) => 
        new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
      );
      daysSinceLastCheckIn = Math.floor(
        (today.getTime() - new Date(sorted[0].check_in_date).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Progress trend
    const recentCheckIns = checkIns
      .filter(c => {
        const checkInDate = new Date(c.check_in_date);
        const daysAgo = Math.floor((today.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysAgo <= 14;
      })
      .sort((a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime());

    const recentStatusCounts = {
      on_track: recentCheckIns.filter(c => c.overall_status === 'on_track').length,
      at_risk: recentCheckIns.filter(c => c.overall_status === 'at_risk').length,
      off_track: recentCheckIns.filter(c => c.overall_status === 'off_track').length,
    };

    // Determine overall trajectory
    let trajectory: PIPTrajectory = 'uncertain';
    const completionRate = totalExpectations > 0 ? metExpectations / totalExpectations : 0;

    if (completionRate >= 0.7 && recentStatusCounts.on_track > recentStatusCounts.off_track) {
      trajectory = 'on_track';
    } else if (completionRate >= 0.4 && recentStatusCounts.at_risk > 0) {
      trajectory = 'at_risk';
    } else if (completionRate < 0.4 || recentStatusCounts.off_track > recentStatusCounts.on_track) {
      trajectory = 'failing';
    }

    // Generate alerts
    const alerts: Alert[] = [];

    if (daysSinceLastCheckIn > 7) {
      alerts.push({
        id: 'overdue-checkin',
        severity: 'critical',
        title: 'Check-In Overdue',
        description: `Last check-in was ${daysSinceLastCheckIn} days ago. Weekly check-ins are required.`,
        recommendation: 'Schedule and conduct check-in today. Document the conversation within 24 hours.',
      });
    }

    if (checkInGap) {
      alerts.push({
        id: 'insufficient-checkins',
        severity: 'warning',
        title: 'Below Required Check-In Frequency',
        description: `${actualCheckIns} check-ins for ${daysInPIP} days (expected ${expectedCheckIns} minimum)`,
        recommendation: 'Increase check-in frequency to weekly. Gaps weaken legal defensibility.',
      });
    }

    if (notMetExpectations > totalExpectations / 2 && daysInPIP > 30) {
      alerts.push({
        id: 'majority-failing',
        severity: 'critical',
        title: 'Majority of Expectations Not Being Met',
        description: `${notMetExpectations} of ${totalExpectations} expectations not met at day ${daysInPIP}`,
        recommendation: 'Escalate to HR immediately. Begin preparing for potential termination.',
      });
    }

    // Milestone alerts
    if (daysInPIP >= 25 && daysInPIP < 30 && !milestoneReviews.some(r => r.milestone === '30_day')) {
      alerts.push({
        id: 'approaching-30day',
        severity: 'warning',
        title: '30-Day Review Approaching',
        description: `30-day milestone review due in ${30 - daysInPIP} days`,
        recommendation: 'Schedule 30-day review meeting with HR present. Prepare formal assessment.',
      });
    }

    if (daysInPIP > 30 && !milestoneReviews.some(r => r.milestone === '30_day')) {
      alerts.push({
        id: 'missed-30day',
        severity: 'critical',
        title: '30-Day Review Overdue',
        description: '30-day milestone review was not completed',
        recommendation: 'Complete 30-day review immediately with HR. This is legally required.',
      });
    }

    // Stagnant expectations
    const stagnantExpectations = expectations.filter(e => 
      e.status === 'not_met' && e.progress_percentage === 0 && daysInPIP > 14
    );

    if (stagnantExpectations.length > 0) {
      alerts.push({
        id: 'stagnant-expectations',
        severity: 'warning',
        title: 'No Progress on Some Expectations',
        description: `${stagnantExpectations.length} expectation(s) showing zero progress after ${daysInPIP} days`,
        recommendation: 'Re-clarify these expectations with employee. Consider if they need different resources or if termination is appropriate.',
      });
    }

    // Generate recommended actions
    const recommendations: RecommendedAction[] = [];

    if (daysSinceLastCheckIn > 7) {
      recommendations.push({
        id: 'urgent-checkin',
        priority: 'urgent',
        action: 'Schedule check-in meeting immediately',
        why: 'Long gaps between check-ins signal lack of support and weaken documentation',
      });
    }

    if (trajectory === 'at_risk' || trajectory === 'failing') {
      recommendations.push({
        id: 'hr-consultation',
        priority: 'urgent',
        action: 'Consult with HR today',
        why: 'Current trajectory suggests PIP may not succeed. HR needs to be involved in decision-making.',
      });
    }

    if (notMetExpectations > 0 && daysInPIP > 20) {
      recommendations.push({
        id: 'clarify-expectations',
        priority: 'high',
        action: `Re-clarify expectations for ${notMetExpectations} underperforming areas`,
        why: 'If employee claims expectations were unclear, that weakens termination case',
      });
    }

    if (stagnantExpectations.length > 0) {
      recommendations.push({
        id: 'additional-resources',
        priority: 'medium',
        action: 'Provide additional training or resources',
        why: 'Shows good faith effort to support employee success',
      });
    }

    if (daysInPIP >= 25 && daysInPIP < 30) {
      recommendations.push({
        id: 'prepare-30day',
        priority: 'high',
        action: 'Prepare formal 30-day review with HR',
        why: '30-day milestone is critical decision point. Document thoroughly.',
      });
    }

    return {
      daysInPIP,
      daysRemaining,
      trajectory,
      completionRate: Math.round(completionRate * 100),
      metExpectations,
      partialExpectations,
      notMetExpectations,
      totalExpectations,
      checkInCompliance: Math.round((actualCheckIns / Math.max(1, expectedCheckIns)) * 100),
      daysSinceLastCheckIn,
      alerts,
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    };
  }, [pip, expectations, checkIns, milestoneReviews]);

  const getTrajectoryConfig = (trajectory: PIPTrajectory) => {
    switch (trajectory) {
      case 'on_track':
        return {
          label: 'On Track',
          icon: TrendingUp,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          message: 'Employee is showing improvement and meeting expectations',
        };
      case 'at_risk':
        return {
          label: 'At Risk',
          icon: AlertTriangle,
          color: 'text-amber-600',
          bgColor: 'bg-amber-100',
          message: 'Some progress, but concerns remain. Requires close monitoring.',
        };
      case 'failing':
        return {
          label: 'Failing',
          icon: TrendingDown,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          message: 'Not meeting expectations. Termination likely if no significant improvement.',
        };
      default:
        return {
          label: 'Uncertain',
          icon: AlertTriangle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          message: 'Insufficient data to assess trajectory. More check-ins needed.',
        };
    }
  };

  const trajectoryConfig = getTrajectoryConfig(analysis.trajectory);
  const TrajectoryIcon = trajectoryConfig.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">AI Progress Intelligence</h3>
            <p className={`text-sm font-medium ${trajectoryConfig.color}`}>
              Status: {trajectoryConfig.label}
            </p>
          </div>
        </div>
        {analysis.alerts.filter(a => a.severity === 'critical').length > 0 && (
          <div className="flex items-center gap-2 mr-2">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {analysis.alerts.filter(a => a.severity === 'critical').length}
            </span>
          </div>
        )}
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Status Overview */}
          <div className={`${trajectoryConfig.bgColor} border border-current rounded-lg p-4 ${trajectoryConfig.color}`}>
            <div className="flex items-center gap-3 mb-2">
              <TrajectoryIcon className="w-6 h-6" />
              <span className="text-lg font-bold">{trajectoryConfig.label}</span>
            </div>
            <p className="text-sm">{trajectoryConfig.message}</p>
          </div>

          {/* Progress Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Progress Analysis (Day {analysis.daysInPIP} of 90)</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Expectations Met:</span>
                <span className={`font-semibold ${
                  analysis.metExpectations > 0 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {analysis.metExpectations} of {analysis.totalExpectations}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Partially Met:</span>
                <span className={`font-semibold ${
                  analysis.partialExpectations > 0 ? 'text-amber-600' : 'text-gray-600'
                }`}>
                  {analysis.partialExpectations}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Not Met:</span>
                <span className={`font-semibold ${
                  analysis.notMetExpectations > 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {analysis.notMetExpectations}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Overall Completion:</span>
                  <span className="font-semibold text-gray-900">{analysis.completionRate}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {analysis.alerts.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-600" />
                Alerts & Red Flags
              </h4>
              <div className="space-y-2">
                {analysis.alerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : alert.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        alert.severity === 'critical' ? 'text-red-600' :
                        alert.severity === 'warning' ? 'text-amber-600' :
                        'text-blue-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-1">{alert.title}</p>
                        <p className="text-xs text-gray-700 mb-2">{alert.description}</p>
                        <p className="text-xs text-gray-800">
                          <strong>Action:</strong> {alert.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {analysis.recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">🎯 Recommended Actions</h4>
              <div className="space-y-2">
                {analysis.recommendations.map((rec, index) => (
                  <div
                    key={rec.id}
                    className={`p-3 rounded-lg border ${
                      rec.priority === 'urgent'
                        ? 'bg-red-50 border-red-200'
                        : rec.priority === 'high'
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold flex-shrink-0 ${
                        rec.priority === 'urgent'
                          ? 'bg-red-600 text-white'
                          : rec.priority === 'high'
                          ? 'bg-orange-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 mb-1">{rec.action}</p>
                        <p className="text-xs text-gray-700">
                          <strong>Why:</strong> {rec.why}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manager Coaching */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
              💡 Manager Coaching
            </h4>
            <div className="text-sm text-indigo-900 space-y-2">
              {analysis.trajectory === 'on_track' && (
                <p>
                  <strong>Good news!</strong> {employeeName} is showing improvement. Keep the momentum going with consistent check-ins and positive reinforcement. Document all progress clearly for the milestone reviews.
                </p>
              )}
              {analysis.trajectory === 'at_risk' && (
                <p>
                  <strong>Proceed with caution.</strong> At day {analysis.daysInPIP}, you should be seeing clearer improvement signals. The mixed progress + {analysis.daysSinceLastCheckIn > 7 ? 'check-in gaps' : 'partial completion'} = concerning. Increase support and documentation, but prepare for possibility this may not succeed.
                </p>
              )}
              {analysis.trajectory === 'failing' && (
                <p>
                  <strong>Be realistic about the outcome.</strong> With {analysis.notMetExpectations} of {analysis.totalExpectations} expectations not being met at day {analysis.daysInPIP}, success is unlikely. Meet with employee and HR to assess if continuing makes sense. If terminating, ensure all documentation is complete. Be clear and direct - false hope helps no one.
                </p>
              )}
              {analysis.trajectory === 'uncertain' && (
                <p>
                  <strong>You need more data.</strong> {analysis.checkInCompliance < 100 ? 'Insufficient check-ins make it hard to assess progress.' : 'Update expectation statuses after each check-in.'} Document conversations thoroughly so you can make informed decisions at milestones.
                </p>
              )}

              {/* Timeline-specific coaching */}
              {analysis.daysInPIP < 30 && (
                <p className="mt-3 pt-3 border-t border-indigo-200">
                  <strong>First 30 days:</strong> Focus on clear communication and frequent check-ins. Employee should understand exactly what's expected. Document everything.
                </p>
              )}
              {analysis.daysInPIP >= 30 && analysis.daysInPIP < 60 && (
                <p className="mt-3 pt-3 border-t border-indigo-200">
                  <strong>Days 31-60:</strong> You should be seeing improvement trajectory. If not, have honest conversation about likelihood of success. Don't wait until day 90 to address obvious failures.
                </p>
              )}
              {analysis.daysInPIP >= 60 && (
                <p className="mt-3 pt-3 border-t border-indigo-200">
                  <strong>Final 30 days:</strong> Decision should be clear by now. If succeeding, prepare for completion. If failing, work with HR on termination plan. Don't drag this out unnecessarily.
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{analysis.daysRemaining}</div>
              <div className="text-xs text-gray-600">Days Remaining</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{checkIns.length}</div>
              <div className="text-xs text-gray-600">Check-Ins</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{analysis.completionRate}%</div>
              <div className="text-xs text-gray-600">Progress</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

