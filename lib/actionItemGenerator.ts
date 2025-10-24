import type { ActionItem, ActionItemPriority, Performance, Potential } from '../types';

interface ActionItemTemplate {
  description: string;
  skillArea: string;
  priority: ActionItemPriority;
  daysToComplete: number;
  estimatedHours: number;
  owner: 'Employee' | 'Manager' | 'HR';
}

// Smart action item templates based on 9-box position
const getActionItemTemplates = (
  performance: Performance | null,
  potential: Potential | null
): ActionItemTemplate[] => {
  const perf = performance || 'medium';
  const pot = potential || 'medium';

  // High Potential boxes (top row) - Focus on growth and stretch assignments
  if (pot === 'high') {
    if (perf === 'low') {
      // Rising Talent - Need immediate performance support
      return [
        {
          description: 'Complete performance gap analysis with manager',
          skillArea: 'Performance Management',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 3,
          owner: 'Manager'
        },
        {
          description: 'Enroll in relevant skill-building training program',
          skillArea: 'Technical Skills',
          priority: 'high',
          daysToComplete: 14,
          estimatedHours: 20,
          owner: 'Employee'
        },
        {
          description: 'Establish weekly coaching sessions with manager',
          skillArea: 'Coaching',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 1,
          owner: 'Manager'
        },
        {
          description: 'Set 3 measurable 30-day performance goals',
          skillArea: 'Goal Setting',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 2,
          owner: 'Employee'
        },
        {
          description: 'Identify and remove key obstacles to success',
          skillArea: 'Problem Solving',
          priority: 'high',
          daysToComplete: 14,
          estimatedHours: 4,
          owner: 'Manager'
        }
      ];
    } else if (perf === 'medium') {
      // Emerging Leader - Ready for development
      return [
        {
          description: 'Take on stretch assignment or cross-functional project',
          skillArea: 'Leadership',
          priority: 'high',
          daysToComplete: 30,
          estimatedHours: 40,
          owner: 'Employee'
        },
        {
          description: 'Complete leadership development assessment (360 feedback)',
          skillArea: 'Self-Awareness',
          priority: 'high',
          daysToComplete: 21,
          estimatedHours: 5,
          owner: 'HR'
        },
        {
          description: 'Attend leadership training or executive education program',
          skillArea: 'Leadership',
          priority: 'medium',
          daysToComplete: 90,
          estimatedHours: 24,
          owner: 'Employee'
        },
        {
          description: 'Shadow senior leader for one week',
          skillArea: 'Executive Presence',
          priority: 'medium',
          daysToComplete: 45,
          estimatedHours: 20,
          owner: 'Manager'
        },
        {
          description: 'Present to executive team or lead strategic initiative',
          skillArea: 'Strategic Thinking',
          priority: 'medium',
          daysToComplete: 60,
          estimatedHours: 15,
          owner: 'Employee'
        },
        {
          description: 'Expand network: 5 coffee chats with leaders outside your team',
          skillArea: 'Networking',
          priority: 'low',
          daysToComplete: 60,
          estimatedHours: 5,
          owner: 'Employee'
        }
      ];
    } else {
      // Star Performer - Retention and succession planning
      return [
        {
          description: 'Create individualized succession plan and career roadmap',
          skillArea: 'Career Planning',
          priority: 'high',
          daysToComplete: 14,
          estimatedHours: 4,
          owner: 'Manager'
        },
        {
          description: 'Assign to high-visibility, high-impact strategic project',
          skillArea: 'Strategic Leadership',
          priority: 'high',
          daysToComplete: 30,
          estimatedHours: 60,
          owner: 'Manager'
        },
        {
          description: 'Begin executive coaching program with external coach',
          skillArea: 'Executive Development',
          priority: 'high',
          daysToComplete: 21,
          estimatedHours: 24,
          owner: 'HR'
        },
        {
          description: 'Present promotion case to leadership team',
          skillArea: 'Career Advancement',
          priority: 'high',
          daysToComplete: 45,
          estimatedHours: 8,
          owner: 'Manager'
        },
        {
          description: 'Conduct stay interview and address retention concerns',
          skillArea: 'Retention',
          priority: 'high',
          daysToComplete: 14,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Explore board or advisory opportunities',
          skillArea: 'External Leadership',
          priority: 'low',
          daysToComplete: 90,
          estimatedHours: 10,
          owner: 'Employee'
        }
      ];
    }
  }

  // Medium Potential boxes (middle row) - Focus on steady contribution
  if (pot === 'medium') {
    if (perf === 'low') {
      // Performance Improvement needed
      return [
        {
          description: 'Document specific performance issues and expectations',
          skillArea: 'Performance Management',
          priority: 'high',
          daysToComplete: 3,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Create 60-day Performance Improvement Plan (PIP)',
          skillArea: 'Performance Management',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 4,
          owner: 'Manager'
        },
        {
          description: 'Schedule bi-weekly check-ins to review progress',
          skillArea: 'Accountability',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Complete required training on performance gaps',
          skillArea: 'Skills Development',
          priority: 'high',
          daysToComplete: 21,
          estimatedHours: 12,
          owner: 'Employee'
        },
        {
          description: 'Demonstrate measurable improvement in 2 key areas',
          skillArea: 'Performance',
          priority: 'high',
          daysToComplete: 60,
          estimatedHours: 40,
          owner: 'Employee'
        }
      ];
    } else if (perf === 'medium') {
      // Core Performer - Maintain engagement
      return [
        {
          description: 'Set clear goals for continued steady contribution',
          skillArea: 'Goal Setting',
          priority: 'medium',
          daysToComplete: 14,
          estimatedHours: 2,
          owner: 'Employee'
        },
        {
          description: 'Identify one skill area for professional development',
          skillArea: 'Skills Development',
          priority: 'medium',
          daysToComplete: 21,
          estimatedHours: 3,
          owner: 'Employee'
        },
        {
          description: 'Take on mentorship role for junior team member',
          skillArea: 'Mentorship',
          priority: 'medium',
          daysToComplete: 30,
          estimatedHours: 10,
          owner: 'Employee'
        },
        {
          description: 'Attend relevant conference or training program',
          skillArea: 'Professional Growth',
          priority: 'low',
          daysToComplete: 90,
          estimatedHours: 16,
          owner: 'Employee'
        },
        {
          description: 'Recognize and appreciate contributions in team meeting',
          skillArea: 'Recognition',
          priority: 'medium',
          daysToComplete: 14,
          estimatedHours: 1,
          owner: 'Manager'
        }
      ];
    } else {
      // Key Player - Recognize and reward
      return [
        {
          description: 'Conduct compensation review and market adjustment',
          skillArea: 'Compensation',
          priority: 'high',
          daysToComplete: 30,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Provide high-visibility project leadership opportunity',
          skillArea: 'Project Leadership',
          priority: 'high',
          daysToComplete: 30,
          estimatedHours: 30,
          owner: 'Manager'
        },
        {
          description: 'Nominate for company recognition or award',
          skillArea: 'Recognition',
          priority: 'medium',
          daysToComplete: 21,
          estimatedHours: 1,
          owner: 'Manager'
        },
        {
          description: 'Discuss career aspirations and lateral move opportunities',
          skillArea: 'Career Development',
          priority: 'medium',
          daysToComplete: 30,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Invest in specialized training to deepen expertise',
          skillArea: 'Technical Excellence',
          priority: 'medium',
          daysToComplete: 60,
          estimatedHours: 20,
          owner: 'Employee'
        }
      ];
    }
  }

  // Low Potential boxes (bottom row) - Focus on realistic expectations
  if (pot === 'low') {
    if (perf === 'low') {
      // Underperformer - Manage out compassionately
      return [
        {
          description: 'Document performance issues with specific examples',
          skillArea: 'Performance Management',
          priority: 'high',
          daysToComplete: 3,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Consult with HR on formal PIP or transition plan',
          skillArea: 'HR Process',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Deliver clear feedback on performance expectations',
          skillArea: 'Direct Communication',
          priority: 'high',
          daysToComplete: 3,
          estimatedHours: 1,
          owner: 'Manager'
        },
        {
          description: 'Explore alternative roles better suited to strengths',
          skillArea: 'Career Transition',
          priority: 'medium',
          daysToComplete: 21,
          estimatedHours: 3,
          owner: 'HR'
        },
        {
          description: 'Set 30/60/90 day performance milestones',
          skillArea: 'Performance Management',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 2,
          owner: 'Manager'
        }
      ];
    } else if (perf === 'medium') {
      // Solid Citizen - Appreciate current contributions
      return [
        {
          description: 'Clarify role expectations and success criteria',
          skillArea: 'Role Clarity',
          priority: 'medium',
          daysToComplete: 14,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Recognize consistent contributions to team',
          skillArea: 'Recognition',
          priority: 'medium',
          daysToComplete: 7,
          estimatedHours: 1,
          owner: 'Manager'
        },
        {
          description: 'Optimize current role for maximum contribution',
          skillArea: 'Role Optimization',
          priority: 'medium',
          daysToComplete: 30,
          estimatedHours: 4,
          owner: 'Manager'
        },
        {
          description: 'Provide training to enhance current role effectiveness',
          skillArea: 'Skills Enhancement',
          priority: 'low',
          daysToComplete: 60,
          estimatedHours: 8,
          owner: 'Employee'
        }
      ];
    } else {
      // Workhorse - Value and retain in current role
      return [
        {
          description: 'Ensure competitive compensation for current role',
          skillArea: 'Compensation',
          priority: 'high',
          daysToComplete: 30,
          estimatedHours: 2,
          owner: 'Manager'
        },
        {
          description: 'Provide clear recognition for expertise and reliability',
          skillArea: 'Recognition',
          priority: 'high',
          daysToComplete: 7,
          estimatedHours: 1,
          owner: 'Manager'
        },
        {
          description: 'Optimize workload and remove non-value-add tasks',
          skillArea: 'Work Optimization',
          priority: 'medium',
          daysToComplete: 21,
          estimatedHours: 3,
          owner: 'Manager'
        },
        {
          description: 'Invest in deep specialization training',
          skillArea: 'Technical Mastery',
          priority: 'medium',
          daysToComplete: 60,
          estimatedHours: 16,
          owner: 'Employee'
        },
        {
          description: 'Create expert/mentor role leveraging specialized knowledge',
          skillArea: 'Knowledge Sharing',
          priority: 'low',
          daysToComplete: 90,
          estimatedHours: 10,
          owner: 'Manager'
        }
      ];
    }
  }

  // Default fallback
  return [];
};

// Generate actionable items with calculated due dates
// Generate retention-specific action items based on risk factors
export const generateRetentionActionItems = (
  riskFactors: string[],
  riskLevel: 'high' | 'medium' | 'low'
): ActionItemTemplate[] => {
  const items: ActionItemTemplate[] = [
    {
      description: 'Conduct stay interview to understand motivations and concerns',
      skillArea: 'Retention',
      priority: riskLevel === 'high' ? 'high' : 'medium',
      daysToComplete: 7,
      estimatedHours: 1,
      owner: 'Manager',
    },
  ];

  // Add items based on specific risk factors
  if (riskFactors.some(f => f.toLowerCase().includes('career') || f.toLowerCase().includes('growth'))) {
    items.push({
      description: 'Create career development roadmap with clear promotion timeline',
      skillArea: 'Career Development',
      priority: 'high',
      daysToComplete: 14,
      estimatedHours: 3,
      owner: 'Manager',
    });
    items.push({
      description: 'Identify and discuss stretch assignment opportunities',
      skillArea: 'Career Growth',
      priority: 'high',
      daysToComplete: 21,
      estimatedHours: 2,
      owner: 'Manager',
    });
  }

  if (riskFactors.some(f => f.toLowerCase().includes('tenure') || f.toLowerCase().includes('new'))) {
    items.push({
      description: 'Schedule regular check-in meetings (weekly for first 3 months)',
      skillArea: 'Onboarding',
      priority: 'high',
      daysToComplete: 7,
      estimatedHours: 1,
      owner: 'Manager',
    });
    items.push({
      description: 'Assign mentor or buddy for additional support',
      skillArea: 'Mentorship',
      priority: 'medium',
      daysToComplete: 14,
      estimatedHours: 1,
      owner: 'HR',
    });
  }

  if (riskFactors.some(f => f.toLowerCase().includes('top talent') || f.toLowerCase().includes('high perf'))) {
    items.push({
      description: 'Review and adjust compensation to market competitive levels',
      skillArea: 'Compensation',
      priority: 'high',
      daysToComplete: 30,
      estimatedHours: 2,
      owner: 'HR',
    });
    items.push({
      description: 'Discuss LTIP eligibility and long-term incentive opportunities',
      skillArea: 'Compensation',
      priority: 'high',
      daysToComplete: 30,
      estimatedHours: 2,
      owner: 'HR',
    });
    items.push({
      description: 'Present visibility opportunities (presentations, high-profile projects)',
      skillArea: 'Recognition',
      priority: 'medium',
      daysToComplete: 30,
      estimatedHours: 5,
      owner: 'Manager',
    });
  }

  if (riskFactors.some(f => f.toLowerCase().includes('plan') || f.toLowerCase().includes('development'))) {
    items.push({
      description: 'Create personalized development plan with clear milestones',
      skillArea: 'Development',
      priority: 'high',
      daysToComplete: 14,
      estimatedHours: 3,
      owner: 'Manager',
    });
  }

  if (riskLevel === 'high') {
    items.push({
      description: 'Executive/senior leader to have retention conversation',
      skillArea: 'Retention',
      priority: 'high',
      daysToComplete: 7,
      estimatedHours: 1,
      owner: 'Manager',
    });
  }

  // General retention items
  items.push({
    description: 'Solicit and address feedback on work-life balance and workload',
    skillArea: 'Work-Life Balance',
    priority: riskLevel === 'high' ? 'high' : 'medium',
    daysToComplete: 14,
    estimatedHours: 1,
    owner: 'Manager',
  });

  items.push({
    description: 'Recognize recent accomplishments publicly (team meeting, company update)',
    skillArea: 'Recognition',
    priority: 'medium',
    daysToComplete: 7,
    estimatedHours: 0.5,
    owner: 'Manager',
  });

  return items;
};

export const generateSmartActionItems = (
  performance: Performance | null,
  potential: Potential | null,
  employeeName: string
): ActionItem[] => {
  const templates = getActionItemTemplates(performance, potential);
  const now = new Date();

  return templates.map((template, index) => {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + template.daysToComplete);

    return {
      id: `action-${Date.now()}-${index}`,
      description: template.description,
      dueDate: dueDate.toISOString(),
      completed: false,
      owner: template.owner,
      priority: template.priority,
      status: 'not_started',
      skillArea: template.skillArea,
      estimatedHours: template.estimatedHours,
    };
  });
};

// Calculate action item status based on dates and completion
export const calculateActionItemStatus = (item: ActionItem): ActionItemStatus => {
  if (item.completed) return 'completed';

  const now = new Date();
  const dueDate = new Date(item.dueDate);

  if (now > dueDate) return 'overdue';
  if (item.status === 'blocked') return 'blocked';
  if (item.status === 'in_progress') return 'in_progress';

  return 'not_started';
};

// Calculate overall plan progress
export const calculatePlanProgress = (actionItems: ActionItem[]): number => {
  if (actionItems.length === 0) return 0;

  const completed = actionItems.filter(item => item.completed).length;
  return Math.round((completed / actionItems.length) * 100);
};

// Get overdue action items
export const getOverdueActionItems = (actionItems: ActionItem[]): ActionItem[] => {
  const now = new Date();
  return actionItems.filter(item => {
    if (item.completed) return false;
    const dueDate = new Date(item.dueDate);
    return now > dueDate;
  });
};

// Get upcoming action items (due in next 7 days)
export const getUpcomingActionItems = (actionItems: ActionItem[]): ActionItem[] => {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return actionItems.filter(item => {
    if (item.completed) return false;
    const dueDate = new Date(item.dueDate);
    return dueDate >= now && dueDate <= nextWeek;
  });
};
