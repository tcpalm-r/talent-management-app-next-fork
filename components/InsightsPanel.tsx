'use client';

import { useMemo } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import type { Employee, Department } from '../types';

interface InsightsPanelProps {
  employees: Employee[];
  departments: Department[];
  userRole?: string;
  currentUserEmployee?: Employee;
  organizationId?: string;
}

interface TeamInsight {
  title: string;
  description: string;
  category: 'strength' | 'opportunity' | 'trend' | 'insight';
  count?: number;
}

export default function InsightsPanel({
  employees,
  departments,
  userRole,
  currentUserEmployee,
  organizationId,
}: InsightsPanelProps) {
  const isAdmin = userRole?.toLowerCase() === 'admin';

  // Get team scope based on role
  const getTeamScope = () => {
    if (isAdmin) {
      return {
        label: 'Company-wide insights',
        employees: employees,
        count: employees.length,
      };
    } else {
      // For leaders, filter team members (would need manager relationship data)
      // For now, show all employees and note this is a placeholder
      return {
        label: 'Your team insights',
        employees: employees,
        count: employees.length,
      };
    }
  };

  const teamScope = getTeamScope();

  // Generate insights (placeholder AI-generated insights)
  const insights = useMemo((): TeamInsight[] => {
    const sampleInsights: TeamInsight[] = [
      {
        title: 'Strong Team Collaboration',
        description: 'Multiple team members highlighted cross-functional collaboration as a key strength in recent 360 reviews.',
        category: 'strength',
      },
      {
        title: 'Development Focus Areas',
        description: 'Communication and delegation skills are emerging as the most frequently mentioned growth areas.',
        category: 'opportunity',
      },
      {
        title: 'High Performer Trend',
        description: 'Performance has improved 23% over the last review cycle with increased engagement.',
        category: 'trend',
        count: 23,
      },
      {
        title: 'Recommended Actions',
        description: 'Consider implementing peer mentoring programs to address identified leadership development needs.',
        category: 'insight',
      },
    ];
    return sampleInsights;
  }, []);

  const getCategoryIcon = (category: TeamInsight['category']) => {
    switch (category) {
      case 'strength':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'opportunity':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-blue-600" />;
      case 'insight':
        return <Lightbulb className="w-5 h-5 text-purple-600" />;
    }
  };

  const getCategoryColor = (category: TeamInsight['category']) => {
    switch (category) {
      case 'strength':
        return 'bg-green-50 border-green-200';
      case 'opportunity':
        return 'bg-amber-50 border-amber-200';
      case 'trend':
        return 'bg-blue-50 border-blue-200';
      case 'insight':
        return 'bg-purple-50 border-purple-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Insights Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">AI-Generated Insights</h2>
        <div className="grid grid-cols-1 gap-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`rounded-lg border p-6 ${getCategoryColor(insight.category)}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getCategoryIcon(insight.category)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
                  <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
                  {insight.count && (
                    <div className="text-xs font-medium text-gray-600">
                      Impact: <span className="text-lg font-bold text-gray-900">+{insight.count}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State Info */}
      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> AI-generated insights will be compiled from your team's 360 review feedback.
          The more 360 reviews completed, the more detailed and accurate these insights will become.
        </p>
      </div>
    </div>
  );
}
