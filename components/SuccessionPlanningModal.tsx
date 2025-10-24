import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Users, AlertTriangle, Award, Calendar, Clock, Target, Shield, ArrowRight, Plus, Filter, BarChart3, CheckCircle2, User } from 'lucide-react';
import type {
  CriticalRole,
  SuccessionCandidate,
  SuccessionAnalyticsSnapshot,
  ReadinessTier,
  RoleLevel,
  FlightRiskLevel,
  CriticalRoleWithDetails
} from '../types/index';

interface SuccessionPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  currentUserName: string;
}

type ViewMode = 'dashboard' | 'roles' | 'candidates' | 'analytics';

export default function SuccessionPlanningModal({
  isOpen,
  onClose,
  organizationId,
  currentUserName
}: SuccessionPlanningModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [analytics, setAnalytics] = useState<SuccessionAnalyticsSnapshot | null>(null);
  const [roles, setRoles] = useState<CriticalRoleWithDetails[]>([]);
  const [selectedRole, setSelectedRole] = useState<CriticalRoleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSuccessionData();
    }
  }, [isOpen, organizationId]);

  const loadSuccessionData = async () => {
    setLoading(true);
    // Mock data for demonstration
    setTimeout(() => {
      setAnalytics({
        id: '1',
        organization_id: organizationId,
        snapshot_date: new Date().toISOString(),
        overall_health_score: 72,
        total_critical_roles: 24,
        roles_with_successors: 21,
        roles_at_risk: 3,
        executive_bench_strength: 2.1,
        vp_bench_strength: 3.2,
        director_bench_strength: 4.1,
        manager_bench_strength: 3.8,
        ready_now_count: 12,
        ready_soon_count: 24,
        future_pipeline_count: 38,
        high_flight_risk_roles: 5,
        retirement_risk_12_months: 3,
        single_successor_roles: 7,
        immediate_attention_roles: [
          'Chief Financial Officer - No ready successor',
          'VP Engineering - Single candidate only',
          'Director Sales West - High flight risk'
        ],
        created_at: new Date().toISOString()
      });

      setRoles([
        {
          id: 'r1',
          organization_id: organizationId,
          role_title: 'Chief Financial Officer',
          department: 'Finance',
          level: 'executive',
          current_incumbent_name: 'Michael Stevens',
          criticality_score: 10,
          flight_risk_level: 'low',
          succession_health_score: 25,
          has_emergency_backup: true,
          emergency_backup_name: 'Karen Smith',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          candidate_count: 0,
          ready_now_count: 0,
          candidates: []
        },
        {
          id: 'r2',
          organization_id: organizationId,
          role_title: 'VP Engineering',
          department: 'Engineering',
          level: 'vp',
          current_incumbent_name: 'Sarah Johnson',
          criticality_score: 9,
          flight_risk_level: 'medium',
          succession_health_score: 55,
          has_emergency_backup: true,
          emergency_backup_name: 'David Chen',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          candidate_count: 1,
          ready_now_count: 0,
          candidates: [
            {
              id: 'c1',
              organization_id: organizationId,
              critical_role_id: 'r2',
              employee_id: 'e3',
              employee_name: 'Jennifer Martinez',
              current_title: 'Director of Engineering',
              readiness_tier: 'ready_soon',
              readiness_percentage: 75,
              estimated_ready_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              completed_stretch_assignments: 2,
              proven_in_similar_role: false,
              strengths: 'Strong technical leadership, excellent team builder',
              concerns: 'Limited experience with executive-level strategy',
              development_needs: 'Executive MBA, board-level exposure',
              nominated_by: currentUserName,
              nominated_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]
        },
        {
          id: 'r3',
          organization_id: organizationId,
          role_title: 'Director Sales West',
          department: 'Sales',
          level: 'director',
          current_incumbent_name: 'Robert Taylor',
          criticality_score: 8,
          flight_risk_level: 'high',
          retirement_risk_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
          succession_health_score: 80,
          has_emergency_backup: true,
          emergency_backup_name: 'Lisa Garcia',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          candidate_count: 3,
          ready_now_count: 1,
          candidates: [
            {
              id: 'c2',
              organization_id: organizationId,
              critical_role_id: 'r3',
              employee_id: 'e7',
              employee_name: 'Lisa Garcia',
              current_title: 'Sales Manager West',
              readiness_tier: 'ready_now',
              readiness_percentage: 95,
              completed_stretch_assignments: 4,
              completed_rotations: ['East Region', 'Strategic Accounts'],
              proven_in_similar_role: true,
              strengths: 'Proven sales leadership, deep customer relationships',
              recommendation: 'Ready for immediate promotion',
              nominated_by: currentUserName,
              nominated_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]
        }
      ]);

      setLoading(false);
    }, 800);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getHealthScoreColor = (score?: number): string => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreBg = (score?: number): string => {
    if (!score) return 'bg-gray-100';
    if (score >= 80) return 'bg-green-50';
    if (score >= 60) return 'bg-blue-50';
    if (score >= 40) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getFlightRiskColor = (level?: FlightRiskLevel): string => {
    switch (level) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getReadinessTierLabel = (tier: ReadinessTier): string => {
    switch (tier) {
      case 'ready_now': return 'Ready Now (<6mo)';
      case 'ready_soon': return 'Ready Soon (1-2yr)';
      case 'future_pipeline': return 'Future (3-5yr)';
      case 'emergency_backup': return 'Emergency Backup';
      default: return tier;
    }
  };

  const getReadinessTierColor = (tier: ReadinessTier): string => {
    switch (tier) {
      case 'ready_now': return 'bg-green-100 text-green-800 border-green-300';
      case 'ready_soon': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'future_pipeline': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'emergency_backup': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getLevelLabel = (level: RoleLevel): string => {
    switch (level) {
      case 'executive': return 'C-Suite';
      case 'vp': return 'VP Level';
      case 'director': return 'Director';
      case 'manager': return 'Manager';
      case 'individual_contributor': return 'IC';
      default: return level;
    }
  };

  const renderDashboard = () => {
    if (!analytics) return null;

    const healthPercentage = analytics.overall_health_score || 0;
    const successorPercentage = analytics.total_critical_roles > 0
      ? Math.round((analytics.roles_with_successors / analytics.total_critical_roles) * 100)
      : 0;

    return (
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Succession Health Metrics
              </h3>
              <p className="text-sm text-gray-600">
                Last updated: {formatDate(analytics.snapshot_date)}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getHealthScoreColor(analytics.overall_health_score)}`}>
                {analytics.overall_health_score}%
              </div>
              <div className="text-sm text-gray-600 font-medium">Overall Health Score</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  healthPercentage >= 80 ? 'bg-green-500' :
                  healthPercentage >= 60 ? 'bg-blue-500' :
                  healthPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${healthPercentage}%` }}
              />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {analytics.total_critical_roles}
              </div>
              <div className="text-xs text-gray-600 font-medium">Critical Roles</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {analytics.roles_with_successors}
              </div>
              <div className="text-xs text-gray-600 font-medium">
                With Successors ({successorPercentage}%)
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-3xl font-bold text-red-600 mb-1">
                {analytics.roles_at_risk}
              </div>
              <div className="text-xs text-gray-600 font-medium">At Risk (No Successor)</div>
            </div>
          </div>
        </div>

        {/* Bench Strength by Level */}
        <div className="bg-white p-6 rounded-xl border-2 border-gray-200">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Bench Strength by Level
          </h4>
          <div className="space-y-3">
            {[
              { label: 'C-Suite', value: analytics.executive_bench_strength, max: 5 },
              { label: 'VP Level', value: analytics.vp_bench_strength, max: 5 },
              { label: 'Director', value: analytics.director_bench_strength, max: 5 },
              { label: 'Manager', value: analytics.manager_bench_strength, max: 5 }
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.label}:</span>
                  <span className="text-sm font-bold text-gray-900">
                    {item.value?.toFixed(1) || '0.0'} per role
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    style={{ width: `${((item.value || 0) / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-xs font-semibold text-gray-700">READY NOW</span>
            </div>
            <div className="text-3xl font-bold text-green-700 mb-1">
              {analytics.ready_now_count}
            </div>
            <div className="text-xs text-gray-600">Candidates &lt;6 months</div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold text-gray-700">READY SOON</span>
            </div>
            <div className="text-3xl font-bold text-blue-700 mb-1">
              {analytics.ready_soon_count}
            </div>
            <div className="text-xs text-gray-600">Candidates 1-2 years</div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-semibold text-gray-700">FUTURE PIPELINE</span>
            </div>
            <div className="text-3xl font-bold text-purple-700 mb-1">
              {analytics.future_pipeline_count}
            </div>
            <div className="text-xs text-gray-600">Candidates 3-5 years</div>
          </div>
        </div>

        {/* Immediate Attention Required */}
        {analytics.immediate_attention_roles && analytics.immediate_attention_roles.length > 0 && (
          <div className="bg-red-50 p-6 rounded-xl border-2 border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h4 className="text-lg font-bold text-red-900">
                ⚠️ IMMEDIATE ATTENTION REQUIRED
              </h4>
            </div>
            <ul className="space-y-2">
              {analytics.immediate_attention_roles.map((alert, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-red-800">
                  <span className="text-red-600 font-bold">•</span>
                  <span>{alert}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setViewMode('roles')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold flex items-center gap-2"
            >
              Review Critical Roles
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Risk Indicators */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border-2 border-orange-200">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {analytics.high_flight_risk_roles}
            </div>
            <div className="text-xs text-gray-700 font-medium">High Flight Risk Roles</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {analytics.retirement_risk_12_months}
            </div>
            <div className="text-xs text-gray-700 font-medium">Retirement Risk (12mo)</div>
          </div>
          <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {analytics.single_successor_roles}
            </div>
            <div className="text-xs text-gray-700 font-medium">Single Successor Only</div>
          </div>
        </div>
      </div>
    );
  };

  const renderRolesList = () => {
    if (loading) {
      return <div className="text-center py-12 text-gray-500">Loading roles...</div>;
    }

    if (roles.length === 0) {
      return (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Critical Roles Defined</h3>
          <p className="text-gray-600 mb-6">Start by defining critical roles that require succession planning</p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 mx-auto">
            <Plus className="w-5 h-5" />
            Add Critical Role
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedRole?.id === role.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
            }`}
            onClick={() => setSelectedRole(selectedRole?.id === role.id ? null : role)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-bold text-gray-900">{role.role_title}</h4>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                    {getLevelLabel(role.level)}
                  </span>
                  {role.flight_risk_level && (
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getFlightRiskColor(role.flight_risk_level)}`}>
                      {role.flight_risk_level.toUpperCase()} RISK
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Department:</strong> {role.department}</div>
                  {role.current_incumbent_name && (
                    <div><strong>Current:</strong> {role.current_incumbent_name}</div>
                  )}
                  {role.emergency_backup_name && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-green-600" />
                      <strong>Emergency Backup:</strong> {role.emergency_backup_name}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right ml-4">
                <div className={`inline-block px-4 py-2 rounded-lg ${getHealthScoreBg(role.succession_health_score)}`}>
                  <div className={`text-2xl font-bold ${getHealthScoreColor(role.succession_health_score)}`}>
                    {role.succession_health_score || 0}%
                  </div>
                  <div className="text-xs text-gray-600 font-medium">Health</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-gray-900">{role.candidate_count || 0}</span>
                <span className="text-gray-600">Candidates</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-gray-900">{role.ready_now_count || 0}</span>
                <span className="text-gray-600">Ready Now</span>
              </div>
              {role.retirement_risk_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="text-gray-600">Retirement Risk:</span>
                  <span className="font-semibold text-orange-700">{formatDate(role.retirement_risk_date)}</span>
                </div>
              )}
            </div>

            {/* Expanded Candidate Details */}
            {selectedRole?.id === role.id && role.candidates && role.candidates.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <h5 className="text-sm font-bold text-gray-900 mb-2">Succession Candidates:</h5>
                {role.candidates.map((candidate) => (
                  <div key={candidate.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-gray-900">{candidate.employee_name}</span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getReadinessTierColor(candidate.readiness_tier)}`}>
                            {getReadinessTierLabel(candidate.readiness_tier)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mb-2">{candidate.current_title}</div>
                      </div>
                      {candidate.readiness_percentage !== undefined && (
                        <div className="text-right ml-2">
                          <div className="text-lg font-bold text-blue-600">{candidate.readiness_percentage}%</div>
                          <div className="text-xs text-gray-600">Ready</div>
                        </div>
                      )}
                    </div>

                    {candidate.strengths && (
                      <div className="text-xs text-gray-700 mb-1">
                        <strong>Strengths:</strong> {candidate.strengths}
                      </div>
                    )}

                    {candidate.development_needs && (
                      <div className="text-xs text-gray-700 mb-1">
                        <strong>Development Needs:</strong> {candidate.development_needs}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                      <div>
                        <strong>Stretch Assignments:</strong> {candidate.completed_stretch_assignments}
                      </div>
                      {candidate.estimated_ready_date && (
                        <div>
                          <strong>Est. Ready:</strong> {formatDate(candidate.estimated_ready_date)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderAllCandidates = () => {
    if (loading) {
      return <div className="text-center py-12 text-gray-500">Loading candidates...</div>;
    }

    // Flatten all candidates from all roles
    const allCandidates = roles.flatMap(role =>
      (role.candidates || []).map(candidate => ({
        ...candidate,
        role_title: role.role_title,
        role_level: role.level,
        role_department: role.department,
        role_health: role.succession_health_score
      }))
    );

    if (allCandidates.length === 0) {
      return (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Candidates Identified</h3>
          <p className="text-gray-600 mb-6">Start identifying potential successors for critical roles</p>
        </div>
      );
    }

    // Group by readiness tier
    const groupedByReadiness = {
      ready_now: allCandidates.filter(c => c.readiness_tier === 'ready_now'),
      ready_soon: allCandidates.filter(c => c.readiness_tier === 'ready_soon'),
      future_pipeline: allCandidates.filter(c => c.readiness_tier === 'future_pipeline'),
      emergency_backup: allCandidates.filter(c => c.readiness_tier === 'emergency_backup')
    };

    return (
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {groupedByReadiness.ready_now.length}
            </div>
            <div className="text-sm text-gray-700 font-medium">Ready Now</div>
            <div className="text-xs text-gray-600 mt-1">&lt;6 months</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {groupedByReadiness.ready_soon.length}
            </div>
            <div className="text-sm text-gray-700 font-medium">Ready Soon</div>
            <div className="text-xs text-gray-600 mt-1">1-2 years</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {groupedByReadiness.future_pipeline.length}
            </div>
            <div className="text-sm text-gray-700 font-medium">Future Pipeline</div>
            <div className="text-xs text-gray-600 mt-1">3-5 years</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
            <div className="text-3xl font-bold text-orange-600 mb-1">
              {groupedByReadiness.emergency_backup.length}
            </div>
            <div className="text-sm text-gray-700 font-medium">Emergency Backup</div>
            <div className="text-xs text-gray-600 mt-1">Interim coverage</div>
          </div>
        </div>

        {/* Ready Now Candidates */}
        {groupedByReadiness.ready_now.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-green-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900">Ready Now (&lt;6 months)</h3>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded">
                {groupedByReadiness.ready_now.length} candidates
              </span>
            </div>
            <div className="space-y-3">
              {groupedByReadiness.ready_now.map(candidate => (
                <div key={candidate.id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-green-600" />
                        <span className="text-lg font-bold text-gray-900">{candidate.employee_name}</span>
                        {candidate.readiness_percentage !== undefined && (
                          <span className="px-3 py-1 bg-green-600 text-white text-sm font-bold rounded">
                            {candidate.readiness_percentage}% Ready
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Current:</strong> {candidate.current_title}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <ArrowRight className="w-4 h-4 text-green-600" />
                        <strong>Target:</strong> {candidate.role_title} ({candidate.role_department})
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded ml-2">
                          {getLevelLabel(candidate.role_level)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {candidate.strengths && (
                    <div className="mb-2 p-3 bg-white rounded border border-green-200">
                      <div className="text-xs font-semibold text-green-900 mb-1 flex items-center gap-2">
                        <Award className="w-3 h-3" />
                        Strengths
                      </div>
                      <div className="text-sm text-gray-700">{candidate.strengths}</div>
                    </div>
                  )}

                  {candidate.recommendation && (
                    <div className="mb-2 p-3 bg-white rounded border border-green-200">
                      <div className="text-xs font-semibold text-blue-900 mb-1">💼 Recommendation</div>
                      <div className="text-sm text-gray-700">{candidate.recommendation}</div>
                    </div>
                  )}

                  <div className="flex items-center gap-6 text-sm text-gray-600 pt-3 border-t border-green-200">
                    <div>
                      <strong>Stretch Assignments:</strong> {candidate.completed_stretch_assignments}
                    </div>
                    {candidate.proven_in_similar_role && (
                      <div className="flex items-center gap-1 text-green-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Proven in similar role
                      </div>
                    )}
                    {candidate.completed_rotations && candidate.completed_rotations.length > 0 && (
                      <div>
                        <strong>Rotations:</strong> {candidate.completed_rotations.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ready Soon Candidates */}
        {groupedByReadiness.ready_soon.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-blue-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">Ready Soon (1-2 years)</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded">
                {groupedByReadiness.ready_soon.length} candidates
              </span>
            </div>
            <div className="space-y-3">
              {groupedByReadiness.ready_soon.map(candidate => (
                <div key={candidate.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-blue-600" />
                        <span className="text-lg font-bold text-gray-900">{candidate.employee_name}</span>
                        {candidate.readiness_percentage !== undefined && (
                          <span className="px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded">
                            {candidate.readiness_percentage}% Ready
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>Current:</strong> {candidate.current_title}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <ArrowRight className="w-4 h-4 text-blue-600" />
                        <strong>Target:</strong> {candidate.role_title} ({candidate.role_department})
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded ml-2">
                          {getLevelLabel(candidate.role_level)}
                        </span>
                      </div>
                      {candidate.estimated_ready_date && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <strong>Est. Ready:</strong> {formatDate(candidate.estimated_ready_date)}
                        </div>
                      )}
                    </div>
                  </div>

                  {candidate.strengths && (
                    <div className="mb-2 p-3 bg-white rounded border border-blue-200">
                      <div className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-2">
                        <Award className="w-3 h-3" />
                        Strengths
                      </div>
                      <div className="text-sm text-gray-700">{candidate.strengths}</div>
                    </div>
                  )}

                  {candidate.development_needs && (
                    <div className="mb-2 p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="text-xs font-semibold text-yellow-900 mb-1 flex items-center gap-2">
                        <Target className="w-3 h-3" />
                        Development Needs
                      </div>
                      <div className="text-sm text-gray-700">{candidate.development_needs}</div>
                    </div>
                  )}

                  {candidate.concerns && (
                    <div className="mb-2 p-3 bg-orange-50 rounded border border-orange-200">
                      <div className="text-xs font-semibold text-orange-900 mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        Concerns
                      </div>
                      <div className="text-sm text-gray-700">{candidate.concerns}</div>
                    </div>
                  )}

                  <div className="flex items-center gap-6 text-sm text-gray-600 pt-3 border-t border-blue-200">
                    <div>
                      <strong>Stretch Assignments:</strong> {candidate.completed_stretch_assignments}
                    </div>
                    {candidate.completed_rotations && candidate.completed_rotations.length > 0 && (
                      <div>
                        <strong>Rotations:</strong> {candidate.completed_rotations.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Future Pipeline Candidates */}
        {groupedByReadiness.future_pipeline.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-purple-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-900">Future Pipeline (3-5 years)</h3>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded">
                {groupedByReadiness.future_pipeline.length} candidates
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {groupedByReadiness.future_pipeline.map(candidate => (
                <div key={candidate.id} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-gray-900">{candidate.employee_name}</span>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    <strong>Current:</strong> {candidate.current_title}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Target:</strong> {candidate.role_title}
                  </div>
                  {candidate.readiness_percentage !== undefined && (
                    <div className="text-xs text-gray-600">
                      <strong>Readiness:</strong> {candidate.readiness_percentage}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Backup Candidates */}
        {groupedByReadiness.emergency_backup.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-orange-600" />
              <h3 className="text-lg font-bold text-gray-900">Emergency Backup</h3>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded">
                {groupedByReadiness.emergency_backup.length} candidates
              </span>
            </div>
            <div className="space-y-2">
              {groupedByReadiness.emergency_backup.map(candidate => (
                <div key={candidate.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{candidate.employee_name}</div>
                    <div className="text-sm text-gray-600">
                      {candidate.current_title} → {candidate.role_title}
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-orange-600 text-white text-xs font-semibold rounded">
                    Interim Coverage
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAnalyticsView = () => {
    if (!analytics || loading) {
      return <div className="text-center py-12 text-gray-500">Loading analytics...</div>;
    }

    return (
      <div className="space-y-6">
        {/* Readiness Distribution */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Successor Readiness Distribution
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                <div className="text-4xl font-bold text-green-600 mb-2">{analytics.ready_now_count}</div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Ready Now</div>
                <div className="text-xs text-gray-600">Candidates prepared to step in immediately</div>
                <div className="mt-4 h-2 bg-green-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600"
                    style={{ width: `${(analytics.ready_now_count / (analytics.ready_now_count + analytics.ready_soon_count + analytics.future_pipeline_count)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border-2 border-yellow-200">
                <div className="text-4xl font-bold text-yellow-600 mb-2">{analytics.ready_soon_count}</div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Ready Soon (1-2 years)</div>
                <div className="text-xs text-gray-600">With targeted development</div>
                <div className="mt-4 h-2 bg-yellow-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-600"
                    style={{ width: `${(analytics.ready_soon_count / (analytics.ready_now_count + analytics.ready_soon_count + analytics.future_pipeline_count)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                <div className="text-4xl font-bold text-blue-600 mb-2">{analytics.future_pipeline_count}</div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Future Pipeline (2+ years)</div>
                <div className="text-xs text-gray-600">Long-term potential candidates</div>
                <div className="mt-4 h-2 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${(analytics.future_pipeline_count / (analytics.ready_now_count + analytics.ready_soon_count + analytics.future_pipeline_count)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bench Strength by Level */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Bench Strength by Organizational Level
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-gray-900">Executive</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{analytics.executive_bench_strength.toFixed(1)}x</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${analytics.executive_bench_strength < 2 ? 'bg-red-500' : analytics.executive_bench_strength < 3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min((analytics.executive_bench_strength / 5) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {analytics.executive_bench_strength < 2 ? 'Critical: Immediate attention needed' : analytics.executive_bench_strength < 3 ? 'Moderate: Development required' : 'Strong: Healthy pipeline'}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">VP</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{analytics.vp_bench_strength.toFixed(1)}x</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${analytics.vp_bench_strength < 2 ? 'bg-red-500' : analytics.vp_bench_strength < 3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min((analytics.vp_bench_strength / 5) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {analytics.vp_bench_strength < 2 ? 'Critical: Immediate attention needed' : analytics.vp_bench_strength < 3 ? 'Moderate: Development required' : 'Strong: Healthy pipeline'}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-gray-900">Director</span>
                </div>
                <span className="text-lg font-bold text-green-600">{analytics.director_bench_strength.toFixed(1)}x</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${analytics.director_bench_strength < 2 ? 'bg-red-500' : analytics.director_bench_strength < 3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min((analytics.director_bench_strength / 5) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {analytics.director_bench_strength < 2 ? 'Critical: Immediate attention needed' : analytics.director_bench_strength < 3 ? 'Moderate: Development required' : 'Strong: Healthy pipeline'}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-gray-900">Manager</span>
                </div>
                <span className="text-lg font-bold text-indigo-600">{analytics.manager_bench_strength.toFixed(1)}x</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${analytics.manager_bench_strength < 2 ? 'bg-red-500' : analytics.manager_bench_strength < 3 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min((analytics.manager_bench_strength / 5) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {analytics.manager_bench_strength < 2 ? 'Critical: Immediate attention needed' : analytics.manager_bench_strength < 3 ? 'Moderate: Development required' : 'Strong: Healthy pipeline'}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>Bench Strength:</strong> Ratio of ready successors to critical roles. Target: 2-3x minimum. Higher is better.
            </p>
          </div>
        </div>

        {/* Risk Analysis */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-red-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-red-600">{analytics.roles_at_risk}</div>
                <div className="text-sm font-semibold text-gray-700">Critical Roles At Risk</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">High Flight Risk:</span>
                <span className="font-bold text-orange-600">{analytics.high_flight_risk_roles}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Retirement (12mo):</span>
                <span className="font-bold text-yellow-600">{analytics.retirement_risk_12_months}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Single Successor:</span>
                <span className="font-bold text-blue-600">{analytics.single_successor_roles}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">{analytics.roles_with_successors}</div>
                <div className="text-sm font-semibold text-gray-700">Roles with Successors</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700">Coverage Rate:</span>
                <span className="font-bold text-green-600">
                  {((analytics.roles_with_successors / analytics.total_critical_roles) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-3 bg-green-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-500"
                  style={{ width: `${(analytics.roles_with_successors / analytics.total_critical_roles) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Target: 100% coverage for all critical roles
              </p>
            </div>
          </div>
        </div>

        {/* Immediate Action Required */}
        <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-bold text-gray-900">Immediate Action Required</h3>
          </div>
          <div className="space-y-3">
            {analytics.immediate_attention_roles.map((role, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{role}</p>
                </div>
                <button className="text-xs px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold">
                  Take Action
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Key Insights & Recommendations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">1</span>
              </div>
              <p className="text-sm text-gray-700">
                <strong>Executive bench strength is {analytics.executive_bench_strength < 2 ? 'critically low' : 'below target'}</strong> at {analytics.executive_bench_strength.toFixed(1)}x.
                Recommend identifying and fast-tracking high-potential VP candidates for executive development programs.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">2</span>
              </div>
              <p className="text-sm text-gray-700">
                <strong>{analytics.single_successor_roles} critical roles have only one successor</strong> identified.
                This creates single-point-of-failure risk. Expand candidate pools to ensure redundancy.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">3</span>
              </div>
              <p className="text-sm text-gray-700">
                <strong>Overall succession health score: {analytics.overall_health_score}%</strong>.
                {analytics.overall_health_score < 70 ? 'Requires immediate leadership attention and resource allocation.' : analytics.overall_health_score < 85 ? 'Making progress but needs continued focus.' : 'Strong succession planning foundation established.'}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-700">
                <strong>Director and Manager levels show strong bench strength</strong> ({analytics.director_bench_strength.toFixed(1)}x and {analytics.manager_bench_strength.toFixed(1)}x respectively).
                This provides a healthy pipeline for promotion to senior roles.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Succession Planning</h2>
                <p className="text-sm text-blue-100">Integrated Succession Planning & Analytics</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-shrink-0 px-6 border-b bg-gray-50">
          <div className="flex space-x-1">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('roles')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'roles'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Critical Roles</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('candidates')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'candidates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>All Candidates</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                viewMode === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span>Analytics</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'dashboard' && renderDashboard()}
          {viewMode === 'roles' && renderRolesList()}
          {viewMode === 'candidates' && renderAllCandidates()}
          {viewMode === 'analytics' && renderAnalyticsView()}
        </div>
      </div>
    </div>
  );
}
