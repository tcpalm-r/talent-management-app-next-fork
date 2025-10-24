import type { Employee, EmployeePlan, Department } from '../types';
import type { PerformanceReview } from '../components/PerformanceReviewModal';

/**
 * Talent Health Score Components
 */
export interface HealthScoreComponents {
  talentQuality: number;        // 0-100
  developmentMomentum: number;  // 0-100
  reviewDiscipline: number;     // 0-100
  successionReadiness: number;  // 0-100
  culturalFit: number;          // 0-100
}

/**
 * Complete Talent Health Score
 */
export interface TalentHealthScore {
  overall: number; // 0-100 weighted average
  components: HealthScoreComponents;
  trend: 'improving' | 'stable' | 'declining';
  changeFromPrevious: number; // +/- points
  lastCalculated: Date;
  breakdown: {
    strengths: string[]; // What's going well
    concerns: string[];  // What needs attention
    recommendations: string[]; // What to do next
  };
}

/**
 * Historical score for trend tracking
 */
export interface HistoricalScore {
  date: string;
  overall: number;
  components: HealthScoreComponents;
}

/**
 * Calculate Organizational Talent Health Score
 * 
 * Weights:
 * - Talent Quality: 30%
 * - Development Momentum: 25%
 * - Review Discipline: 20%
 * - Succession Readiness: 15%
 * - Cultural Fit: 10%
 */
export function calculateTalentHealthScore(
  employees: Employee[],
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>,
  employeePlans: Record<string, EmployeePlan>,
  departments: Department[]
): TalentHealthScore {
  const components: HealthScoreComponents = {
    talentQuality: calculateTalentQuality(employees),
    developmentMomentum: calculateDevelopmentMomentum(employees, employeePlans),
    reviewDiscipline: calculateReviewDiscipline(employees, performanceReviews),
    successionReadiness: calculateSuccessionReadiness(employees),
    culturalFit: calculateCulturalFit(employees, performanceReviews),
  };

  // Weighted average
  const overall = Math.round(
    components.talentQuality * 0.30 +
    components.developmentMomentum * 0.25 +
    components.reviewDiscipline * 0.20 +
    components.successionReadiness * 0.15 +
    components.culturalFit * 0.10
  );

  // Get historical data for trend
  const historical = getHistoricalScores();
  const trend = calculateTrend(overall, historical);
  const changeFromPrevious = historical.length > 0 ? overall - historical[historical.length - 1].overall : 0;

  // Save current score to history
  saveHistoricalScore({ overall, components });

  // Generate insights
  const breakdown = generateInsights(components, employees, employeePlans, performanceReviews);

  return {
    overall,
    components,
    trend,
    changeFromPrevious,
    lastCalculated: new Date(),
    breakdown,
  };
}

/**
 * Component 1: Talent Quality (30%)
 * Based on 9-box distribution
 */
function calculateTalentQuality(employees: Employee[]): number {
  const assessed = employees.filter(e => e.assessment);
  if (assessed.length === 0) return 0;

  // Score based on box placement
  const boxScores: Record<string, number> = {
    '3-3': 100, // High/High - Stars
    '3-2': 85,  // High/Medium - Workhorses
    '2-3': 85,  // Medium/High - Rising Stars
    '2-2': 70,  // Medium/Medium - Solid Contributors
    '3-1': 60,  // High/Low - Current Contributors
    '1-3': 55,  // Low/High - Rough Diamonds
    '2-1': 45,  // Medium/Low - Moderate Risk
    '1-2': 30,  // Low/Medium - Performance Issues
    '1-1': 15,  // Low/Low - Underperformers
  };

  const totalScore = assessed.reduce((sum, emp) => {
    const score = emp.assessment?.box_key ? boxScores[emp.assessment.box_key] || 50 : 50;
    return sum + score;
  }, 0);

  const avgScore = totalScore / assessed.length;
  
  // Penalty for unassessed employees
  const assessmentRate = assessed.length / employees.length;
  const penalizedScore = avgScore * assessmentRate;

  return Math.round(penalizedScore);
}

/**
 * Component 2: Development Momentum (25%)
 * Based on active plans and action item completion
 */
function calculateDevelopmentMomentum(
  employees: Employee[],
  employeePlans: Record<string, EmployeePlan>
): number {
  const assessed = employees.filter(e => e.assessment);
  if (assessed.length === 0) return 0;

  // Plan coverage: Do assessed employees have plans?
  const withPlans = assessed.filter(e => employeePlans[e.id]);
  const planCoverage = (withPlans.length / assessed.length) * 100;

  // Action completion: Are plans being executed?
  let totalActions = 0;
  let completedActions = 0;
  let onTimeActions = 0;

  Object.values(employeePlans).forEach(plan => {
    const actions = plan.action_items || [];
    totalActions += actions.length;
    completedActions += actions.filter(a => a.completed).length;
    onTimeActions += actions.filter(a => 
      a.completed && a.completedDate && a.dueDate &&
      new Date(a.completedDate) <= new Date(a.dueDate)
    ).length;
  });

  const completionRate = totalActions > 0 ? (completedActions / totalActions) * 100 : 0;
  const onTimeRate = totalActions > 0 ? (onTimeActions / totalActions) * 100 : 0;

  // Weighted: 40% coverage, 35% completion, 25% on-time
  const score = (planCoverage * 0.40) + (completionRate * 0.35) + (onTimeRate * 0.25);

  return Math.round(score);
}

/**
 * Component 3: Review Discipline (20%)
 * Based on review completion and calibration
 */
function calculateReviewDiscipline(
  employees: Employee[],
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>
): number {
  const assessed = employees.filter(e => e.assessment);
  if (assessed.length === 0) return 0;

  let withSelfReview = 0;
  let withManagerReview = 0;
  let withBothReviews = 0;
  let alignedReviews = 0;

  assessed.forEach(emp => {
    const record = performanceReviews[emp.id];
    const hasSelf = record?.self && (record.self.status === 'submitted' || record.self.status === 'completed');
    const hasManager = record?.manager && record.manager.status === 'completed';

    if (hasSelf) withSelfReview++;
    if (hasManager) withManagerReview++;
    if (hasSelf && hasManager) {
      withBothReviews++;
      
      // Check alignment (within 1 point on overall scores)
      const selfAvg = (record.self!.humble_score + record.self!.hungry_score + record.self!.smart_score) / 3;
      const managerScoreMap: Record<string, number> = {
        excellence: 5,
        exceeds: 4,
        meets: 3,
        occasionally_meets: 2,
        not_performing: 1,
      };
      const managerScore = record.manager!.manager_performance_summary 
        ? managerScoreMap[record.manager!.manager_performance_summary] || 3
        : 3;
      
      if (Math.abs(selfAvg - managerScore) <= 1) {
        alignedReviews++;
      }
    }
  });

  // Metrics
  const selfReviewRate = (withSelfReview / assessed.length) * 100;
  const managerReviewRate = (withManagerReview / assessed.length) * 100;
  const completionRate = (withBothReviews / assessed.length) * 100;
  const alignmentRate = withBothReviews > 0 ? (alignedReviews / withBothReviews) * 100 : 100;

  // Weighted: 40% completion, 30% manager rate, 20% self rate, 10% alignment
  const score = (completionRate * 0.40) + (managerReviewRate * 0.30) + (selfReviewRate * 0.20) + (alignmentRate * 0.10);

  return Math.round(score);
}

/**
 * Component 4: Succession Readiness (15%)
 * Based on critical roles with identified successors
 */
function calculateSuccessionReadiness(employees: Employee[]): number {
  const criticalRoles = employees.filter(e => e.is_critical_role);
  
  if (criticalRoles.length === 0) {
    // No critical roles defined = moderate score (not bad, just not great)
    return 50;
  }

  // In a full implementation, this would check critical_roles table and succession_candidates
  // For now, check if high performers exist as potential successors
  const highPerformers = employees.filter(e => 
    e.assessment?.performance === 'high' && e.assessment?.potential === 'high'
  );

  const successorRatio = highPerformers.length / criticalRoles.length;
  
  // Score based on successor ratio
  // Target: 2-3 successors per critical role
  let score = 0;
  if (successorRatio >= 2.5) score = 100;
  else if (successorRatio >= 2.0) score = 90;
  else if (successorRatio >= 1.5) score = 75;
  else if (successorRatio >= 1.0) score = 60;
  else if (successorRatio >= 0.5) score = 40;
  else score = 20;

  return Math.round(score);
}

/**
 * Component 5: Cultural Fit (10%)
 * Based on Ideal Team Player scores
 */
function calculateCulturalFit(
  employees: Employee[],
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>
): number {
  const withManagerReviews = employees.filter(e => 
    performanceReviews[e.id]?.manager?.status === 'completed'
  );

  if (withManagerReviews.length === 0) return 50;

  let totalScore = 0;
  let count = 0;

  withManagerReviews.forEach(emp => {
    const review = performanceReviews[emp.id].manager;
    if (!review) return;

    // Ideal Team Player: Humble, Hungry, Smart
    // Each scored 1-10, target is 7+ on all three
    const humble = review.humble_score;
    const hungry = review.hungry_score;
    const smart = review.smart_score;

    // Consider someone a "team player" if all scores >= 7
    const isIdealTeamPlayer = humble >= 7 && hungry >= 7 && smart >= 7;
    
    // Score: average of the three dimensions
    const employeeScore = (humble + hungry + smart) / 3;
    const normalizedScore = (employeeScore / 10) * 100; // Convert to 0-100

    totalScore += normalizedScore;
    count++;
  });

  const avgScore = count > 0 ? totalScore / count : 50;
  return Math.round(avgScore);
}

/**
 * Calculate trend from historical data
 */
function calculateTrend(
  currentScore: number,
  historical: HistoricalScore[]
): 'improving' | 'stable' | 'declining' {
  if (historical.length === 0) return 'stable';

  // Compare to last 3 scores
  const recent = historical.slice(-3);
  const avgRecent = recent.reduce((sum, h) => sum + h.overall, 0) / recent.length;

  const difference = currentScore - avgRecent;

  if (difference >= 3) return 'improving';
  if (difference <= -3) return 'declining';
  return 'stable';
}

/**
 * Generate actionable insights
 */
function generateInsights(
  components: HealthScoreComponents,
  employees: Employee[],
  employeePlans: Record<string, EmployeePlan>,
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>
): { strengths: string[]; concerns: string[]; recommendations: string[] } {
  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  // Analyze each component
  if (components.talentQuality >= 80) {
    strengths.push('Strong talent quality - majority in top 9-box positions');
  } else if (components.talentQuality < 60) {
    concerns.push('Talent quality below target - consider upskilling or selective hiring');
    recommendations.push('Review 9-box placements and create development plans for medium performers');
  }

  if (components.developmentMomentum >= 75) {
    strengths.push('Excellent development momentum - plans are active and executing');
  } else if (components.developmentMomentum < 60) {
    concerns.push('Development momentum lagging - many employees lack active plans');
    recommendations.push('Create AI-assisted development plans for all assessed employees');
  }

  if (components.reviewDiscipline >= 80) {
    strengths.push('Strong review discipline - team is aligned on performance');
  } else if (components.reviewDiscipline < 65) {
    concerns.push('Review discipline needs improvement - many pending or misaligned reviews');
    recommendations.push('Complete pending reviews and hold calibration sessions');
  }

  if (components.successionReadiness >= 70) {
    strengths.push('Healthy succession pipeline - critical roles have identified successors');
  } else if (components.successionReadiness < 50) {
    concerns.push('Succession risk - insufficient bench strength for critical roles');
    recommendations.push('Identify and develop high-potential employees for leadership roles');
  }

  if (components.culturalFit >= 75) {
    strengths.push('Strong cultural alignment - team embodies Humble, Hungry, Smart values');
  } else if (components.culturalFit < 60) {
    concerns.push('Cultural fit challenges - some employees not aligning with core values');
    recommendations.push('Use Ideal Team Player assessments to guide development and hiring');
  }

  return { strengths, concerns, recommendations };
}

/**
 * Get historical scores from localStorage
 */
function getHistoricalScores(): HistoricalScore[] {
  try {
    const stored = localStorage.getItem('talent_health_history');
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[Health Score] Error loading history:', error);
    return [];
  }
}

/**
 * Save current score to localStorage
 */
function saveHistoricalScore(score: { overall: number; components: HealthScoreComponents }) {
  try {
    const historical = getHistoricalScores();
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have a score for today
    const existingIndex = historical.findIndex(h => h.date === today);
    
    if (existingIndex >= 0) {
      // Update today's score
      historical[existingIndex] = {
        date: today,
        overall: score.overall,
        components: score.components,
      };
    } else {
      // Add new score
      historical.push({
        date: today,
        overall: score.overall,
        components: score.components,
      });
    }

    // Keep only last 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoff = cutoffDate.toISOString().split('T')[0];
    
    const filtered = historical.filter(h => h.date >= cutoff);
    
    localStorage.setItem('talent_health_history', JSON.stringify(filtered));
  } catch (error) {
    console.error('[Health Score] Error saving history:', error);
  }
}

/**
 * Get component label
 */
export function getComponentLabel(key: keyof HealthScoreComponents): string {
  const labels: Record<keyof HealthScoreComponents, string> = {
    talentQuality: 'Talent Quality',
    developmentMomentum: 'Development Momentum',
    reviewDiscipline: 'Review Discipline',
    successionReadiness: 'Succession Readiness',
    culturalFit: 'Cultural Fit',
  };
  return labels[key];
}

/**
 * Get component description
 */
export function getComponentDescription(key: keyof HealthScoreComponents): string {
  const descriptions: Record<keyof HealthScoreComponents, string> = {
    talentQuality: '9-box placement distribution - % in top performer boxes',
    developmentMomentum: 'Development plan coverage and action item completion',
    reviewDiscipline: 'Performance review completion and calibration alignment',
    successionReadiness: 'Critical role coverage with ready successors',
    culturalFit: 'Ideal Team Player assessment (Humble, Hungry, Smart)',
  };
  return descriptions[key];
}

/**
 * Get status indicator for a score
 */
export function getScoreStatus(score: number): 'excellent' | 'good' | 'needs-improvement' | 'critical' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'critical';
}

/**
 * Get color for status
 */
export function getStatusColor(status: 'excellent' | 'good' | 'needs-improvement' | 'critical'): string {
  const colors = {
    excellent: 'green',
    good: 'blue',
    'needs-improvement': 'amber',
    critical: 'red',
  };
  return colors[status];
}

/**
 * Export historical data for charting
 */
export function getHistoricalData(days: 30 | 60 | 90 = 30): HistoricalScore[] {
  const all = getHistoricalScores();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0];
  
  return all.filter(h => h.date >= cutoff);
}

