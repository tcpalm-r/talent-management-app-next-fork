import type { Performance, Potential, PlanType } from '../types';

export interface ParsedReview {
  // Employee Information
  employeeName: string;
  title?: string;
  department?: string;
  email?: string;
  
  // Assessment
  suggestedPerformance: Performance;
  suggestedPotential: Potential;
  confidence: number; // 0-100
  
  // Plan Data
  planType: PlanType;
  objectives: string[];
  actionItems: string[];
  successMetrics: string[];
  keyInsights: string[];
  
  // Raw data
  strengths: string[];
  areasForImprovement: string[];
  achievements: string[];
  challenges: string[];
}

// Performance indicators with weights
const PERFORMANCE_INDICATORS = {
  high: {
    positive: [
      'exceeded expectations', 'exceptional', 'outstanding', 'consistently delivers',
      'top performer', 'exemplary', 'significantly above', 'remarkable results',
      'best in class', 'exceeds goals', 'far surpasses', 'stellar performance',
      'consistently exceeds', 'exceptional quality', 'highest standards',
      'delivered exceptional', 'achieved all goals', 'surpassed targets'
    ],
    negative: [] // absence of negative indicators
  },
  medium: {
    positive: [
      'meets expectations', 'solid performance', 'reliable', 'consistent',
      'good work', 'satisfactory', 'competent', 'adequate', 'meets goals',
      'fulfills requirements', 'steady performer', 'dependable',
      'meets standards', 'acceptable performance', 'on track'
    ],
    negative: ['room for improvement', 'could improve', 'needs development']
  },
  low: {
    positive: [],
    negative: [
      'below expectations', 'underperforming', 'struggling', 'inconsistent',
      'fails to meet', 'poor performance', 'does not meet', 'falling short',
      'needs significant improvement', 'performance issues', 'not meeting standards',
      'unacceptable', 'substandard', 'major concerns', 'critical gaps'
    ]
  }
};

// Potential indicators with weights
const POTENTIAL_INDICATORS = {
  high: [
    'high potential', 'ready for promotion', 'leadership qualities', 'quick learner',
    'takes initiative', 'strategic thinking', 'innovative', 'adapts quickly',
    'future leader', 'growth mindset', 'seeks challenges', 'learns rapidly',
    'strong potential', 'promotion ready', 'executive presence', 'drives change',
    'visionary', 'builds relationships', 'influences others', 'self-aware',
    'resilient', 'embraces feedback', 'learning agility', 'scalable'
  ],
  medium: [
    'capable', 'solid contributor', 'room to grow', 'developing skills',
    'shows promise', 'potential to develop', 'could advance', 'trainable',
    'willing to learn', 'shows interest', 'moderate potential', 'steady growth'
  ],
  low: [
    'limited growth', 'at capacity', 'comfortable in current role', 'plateaued',
    'resistant to change', 'minimal potential', 'limited interest in growth',
    'not interested in advancement', 'reached ceiling', 'low adaptability',
    'rigid thinking', 'struggles with change', 'narrow focus'
  ]
};

// Action verbs that indicate things to work on
const ACTION_VERBS = [
  'improve', 'develop', 'enhance', 'strengthen', 'build', 'increase',
  'expand', 'refine', 'focus on', 'work on', 'address', 'resolve'
];

export function parsePerformanceReview(reviewText: string): ParsedReview {
  const lowerText = reviewText.toLowerCase();
  const lines = reviewText.split('\n').filter(line => line.trim().length > 0);
  
  // Extract employee name (usually first line or contains "Employee:" or "Name:")
  const employeeName = extractEmployeeName(lines, reviewText);
  
  // Extract title and department
  const title = extractField(reviewText, ['title:', 'position:', 'role:']);
  const department = extractField(reviewText, ['department:', 'dept:', 'team:']);
  const email = extractEmail(reviewText);
  
  // Analyze performance
  const performanceAnalysis = analyzePerformance(lowerText);
  const potentialAnalysis = analyzePotential(lowerText);
  
  // Extract key content
  const strengths = extractBulletPoints(reviewText, ['strengths', 'achievements', 'accomplishments', 'successes']);
  const areasForImprovement = extractBulletPoints(reviewText, ['areas for improvement', 'development areas', 'growth opportunities', 'weaknesses', 'challenges']);
  const achievements = extractAchievements(reviewText);
  const challenges = extractChallenges(reviewText);
  
  // Determine plan type
  const planType = determinePlanType(performanceAnalysis.rating, potentialAnalysis.rating);
  
  // Generate objectives based on the review
  const objectives = generateObjectives(
    performanceAnalysis.rating,
    potentialAnalysis.rating,
    areasForImprovement,
    strengths
  );
  
  // Extract or generate action items
  const actionItems = extractActionItems(reviewText, areasForImprovement);
  
  // Generate success metrics
  const successMetrics = generateSuccessMetrics(
    performanceAnalysis.rating,
    potentialAnalysis.rating,
    achievements
  );
  
  // Key insights
  const keyInsights = generateKeyInsights(
    performanceAnalysis,
    potentialAnalysis,
    strengths,
    areasForImprovement
  );
  
  return {
    employeeName,
    title,
    department,
    email,
    suggestedPerformance: performanceAnalysis.rating,
    suggestedPotential: potentialAnalysis.rating,
    confidence: Math.round((performanceAnalysis.confidence + potentialAnalysis.confidence) / 2),
    planType,
    objectives,
    actionItems,
    successMetrics,
    keyInsights,
    strengths,
    areasForImprovement,
    achievements,
    challenges
  };
}

function extractEmployeeName(lines: string[], fullText: string): string {
  // Try to find name after labels
  const namePatterns = [
    /name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /employee:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*-/,
  ];
  
  for (const pattern of namePatterns) {
    const match = fullText.match(pattern);
    if (match) return match[1].trim();
  }
  
  // Check first few lines for capitalized names
  for (const line of lines.slice(0, 3)) {
    const words = line.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const isName = words.every(w => /^[A-Z][a-z]+$/.test(w));
      if (isName) return words.join(' ');
    }
  }
  
  return 'Unknown Employee';
}

function extractField(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*([^\\n]+)`, 'i');
    const match = text.match(regex);
    if (match) return match[1].trim();
  }
  return undefined;
}

function extractEmail(text: string): string | undefined {
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
  const match = text.match(emailRegex);
  return match ? match[0] : undefined;
}

function analyzePerformance(text: string): { rating: Performance; confidence: number; reasons: string[] } {
  let highScore = 0;
  let mediumScore = 0;
  let lowScore = 0;
  const reasons: string[] = [];
  
  // Score high performance
  PERFORMANCE_INDICATORS.high.positive.forEach(indicator => {
    if (text.includes(indicator)) {
      highScore += 2;
      reasons.push(`Found: "${indicator}"`);
    }
  });
  
  // Score medium performance
  PERFORMANCE_INDICATORS.medium.positive.forEach(indicator => {
    if (text.includes(indicator)) {
      mediumScore += 1.5;
    }
  });
  
  // Score low performance (negative indicators)
  PERFORMANCE_INDICATORS.low.negative.forEach(indicator => {
    if (text.includes(indicator)) {
      lowScore += 2;
      reasons.push(`Concern: "${indicator}"`);
    }
  });
  
  // Add some balance - check for negative words that might indicate medium/low
  PERFORMANCE_INDICATORS.medium.negative.forEach(indicator => {
    if (text.includes(indicator)) {
      mediumScore += 1;
      highScore -= 0.5;
    }
  });
  
  // Determine rating
  let rating: Performance;
  let confidence: number;
  
  if (highScore > mediumScore && highScore > lowScore) {
    rating = 'high';
    confidence = Math.min(95, 60 + highScore * 5);
  } else if (lowScore > mediumScore && lowScore > highScore) {
    rating = 'low';
    confidence = Math.min(95, 60 + lowScore * 5);
  } else {
    rating = 'medium';
    confidence = 70;
  }
  
  return { rating, confidence, reasons };
}

function analyzePotential(text: string): { rating: Potential; confidence: number; reasons: string[] } {
  let highScore = 0;
  let mediumScore = 0;
  let lowScore = 0;
  const reasons: string[] = [];
  
  POTENTIAL_INDICATORS.high.forEach(indicator => {
    if (text.includes(indicator)) {
      highScore += 2;
      reasons.push(`Found: "${indicator}"`);
    }
  });
  
  POTENTIAL_INDICATORS.medium.forEach(indicator => {
    if (text.includes(indicator)) {
      mediumScore += 1;
    }
  });
  
  POTENTIAL_INDICATORS.low.forEach(indicator => {
    if (text.includes(indicator)) {
      lowScore += 2;
      reasons.push(`Concern: "${indicator}"`);
    }
  });
  
  let rating: Potential;
  let confidence: number;
  
  if (highScore > mediumScore && highScore > lowScore) {
    rating = 'high';
    confidence = Math.min(95, 60 + highScore * 5);
  } else if (lowScore > mediumScore && lowScore > highScore) {
    rating = 'low';
    confidence = Math.min(95, 60 + lowScore * 5);
  } else {
    rating = 'medium';
    confidence = 70;
  }
  
  return { rating, confidence, reasons };
}

function extractBulletPoints(text: string, sectionHeaders: string[]): string[] {
  const bullets: string[] = [];
  const lines = text.split('\n');
  
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    // Check if we're entering a relevant section
    if (sectionHeaders.some(header => lowerLine.includes(header))) {
      inSection = true;
      continue;
    }
    
    // Check if we're leaving the section (new header)
    if (inSection && line.match(/^[A-Z][^:]*:/)) {
      inSection = false;
    }
    
    // Extract bullet points
    if (inSection && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || line.match(/^\d+\./))) {
      const cleaned = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (cleaned.length > 10) {
        bullets.push(cleaned);
      }
    }
  }
  
  return bullets;
}

function extractAchievements(text: string): string[] {
  return extractBulletPoints(text, ['achievements', 'accomplishments', 'successes', 'highlights', 'key wins']);
}

function extractChallenges(text: string): string[] {
  return extractBulletPoints(text, ['challenges', 'difficulties', 'obstacles', 'issues', 'concerns']);
}

function determinePlanType(performance: Performance, potential: Potential): PlanType {
  if (potential === 'high' && (performance === 'medium' || performance === 'high')) {
    return 'development';
  }
  if (performance === 'low') {
    return 'performance_improvement';
  }
  if (performance === 'high' && potential === 'high') {
    return 'succession';
  }
  return 'retention';
}

function generateObjectives(
  performance: Performance,
  potential: Potential,
  improvements: string[],
  strengths: string[]
): string[] {
  const objectives: string[] = [];
  
  if (performance === 'low') {
    objectives.push('Address immediate performance gaps within 30-60 days');
    objectives.push('Establish clear performance standards and metrics');
    if (improvements.length > 0) {
      objectives.push(`Focus on: ${improvements[0]}`);
    }
  } else if (potential === 'high') {
    objectives.push('Develop leadership and strategic capabilities');
    objectives.push('Expand scope of impact and influence');
    if (strengths.length > 0) {
      objectives.push(`Leverage strength in ${strengths[0]?.toLowerCase()} for team benefit`);
    }
  } else if (performance === 'high') {
    objectives.push('Maintain exceptional performance levels');
    objectives.push('Take on challenging stretch assignments');
    objectives.push('Mentor and develop junior team members');
  }
  
  // Add development areas as objectives
  improvements.slice(0, 2).forEach(area => {
    objectives.push(`Improve ${area.toLowerCase()}`);
  });
  
  return objectives.slice(0, 5);
}

function extractActionItems(reviewText: string, improvements: string[]): string[] {
  const actions: string[] = [];
  const sentences = reviewText.split(/[.!?]+/);
  
  // Find sentences with action verbs
  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (ACTION_VERBS.some(verb => lower.includes(verb))) {
      const cleaned = sentence.trim();
      if (cleaned.length > 15 && cleaned.length < 200) {
        actions.push(cleaned);
      }
    }
  });
  
  // Convert improvements into action items
  improvements.forEach(improvement => {
    if (!actions.some(a => a.toLowerCase().includes(improvement.toLowerCase().slice(0, 20)))) {
      actions.push(`Develop plan to improve: ${improvement}`);
    }
  });
  
  return actions.slice(0, 6);
}

function generateSuccessMetrics(
  performance: Performance,
  potential: Potential,
  achievements: string[]
): string[] {
  const metrics: string[] = [];
  
  if (performance === 'low') {
    metrics.push('Performance improvement to "Medium" level within 90 days');
    metrics.push('Meeting all key performance indicators consistently');
    metrics.push('Positive feedback from manager in weekly check-ins');
  } else if (potential === 'high') {
    metrics.push('Successful completion of 2+ stretch assignments');
    metrics.push('Positive 360-degree feedback showing growth');
    metrics.push('Ready for promotion within 12-18 months');
  } else {
    metrics.push('Sustained performance at current level or higher');
    metrics.push('Achievement of quarterly goals and objectives');
    metrics.push('Positive peer and stakeholder feedback');
  }
  
  // Add specific metrics from achievements
  if (achievements.length > 0) {
    metrics.push(`Build on success of: ${achievements[0]?.substring(0, 60)}...`);
  }
  
  return metrics.slice(0, 5);
}

function generateKeyInsights(
  performanceAnalysis: any,
  potentialAnalysis: any,
  strengths: string[],
  improvements: string[]
): string[] {
  const insights: string[] = [];
  
  insights.push(`Performance assessed as ${performanceAnalysis.rating} (${performanceAnalysis.confidence}% confidence)`);
  insights.push(`Potential assessed as ${potentialAnalysis.rating} (${potentialAnalysis.confidence}% confidence)`);
  
  if (strengths.length > 0) {
    insights.push(`Key strength: ${strengths[0]}`);
  }
  
  if (improvements.length > 0) {
    insights.push(`Priority development: ${improvements[0]}`);
  }
  
  if (performanceAnalysis.reasons.length > 0) {
    insights.push(performanceAnalysis.reasons[0]);
  }
  
  return insights;
}
