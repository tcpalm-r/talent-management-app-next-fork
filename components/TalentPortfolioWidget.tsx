import { useMemo } from 'react';
import { TrendingUp, Users, Target, AlertCircle } from 'lucide-react';
import type { Employee, EmployeePlan } from '../types';

interface TalentSegment {
  name: string;
  emoji: string;
  description: string;
  employees: Employee[];
  percentage: number;
  targetPercentage: number;
  color: string;
  status: 'above' | 'on-target' | 'below';
}

interface TalentPortfolioWidgetProps {
  employees: Employee[];
  employeePlans: Record<string, EmployeePlan>;
}

export default function TalentPortfolioWidget({
  employees,
  employeePlans,
}: TalentPortfolioWidgetProps) {
  const segments = useMemo((): TalentSegment[] => {
    const total = employees.length;
    if (total === 0) return [];

    // Segment 1: Crown Jewels (High/High)
    const crownJewels = employees.filter(e => e.assessment?.box_key === '3-3');
    
    // Segment 2: Workhorses (High Performance, not High/High)
    const workhorses = employees.filter(e =>
      e.assessment?.performance === 'high' && e.assessment?.box_key !== '3-3'
    );

    // Segment 3: Rising Stars (High Potential, not High/High)
    const risingStars = employees.filter(e =>
      e.assessment?.potential === 'high' && e.assessment?.box_key !== '3-3'
    );

    // Segment 4: Solid Contributors (Medium/Medium)
    const solidContributors = employees.filter(e => e.assessment?.box_key === '2-2');

    // Segment 5: Performance Concerns (Low performers)
    const concerns = employees.filter(e =>
      e.assessment?.performance === 'low' ||
      ['1-1', '1-2', '2-1', '1-3'].includes(e.assessment?.box_key || '')
    );

    const calculateStatus = (actual: number, target: number): 'above' | 'on-target' | 'below' => {
      if (actual >= target) return 'above';
      if (actual >= target * 0.9) return 'on-target';
      return 'below';
    };

    return [
      {
        name: 'Crown Jewels',
        emoji: '👑',
        description: 'High performers with high potential - your next leaders',
        employees: crownJewels,
        percentage: Math.round((crownJewels.length / total) * 100),
        targetPercentage: 15,
        color: 'green',
        status: calculateStatus((crownJewels.length / total) * 100, 15),
      },
      {
        name: 'Workhorses',
        emoji: '🐴',
        description: 'Consistent high performers - your operational backbone',
        employees: workhorses,
        percentage: Math.round((workhorses.length / total) * 100),
        targetPercentage: 30,
        color: 'blue',
        status: calculateStatus((workhorses.length / total) * 100, 30),
      },
      {
        name: 'Rising Stars',
        emoji: '⭐',
        description: 'High potential, developing - your investment opportunity',
        employees: risingStars,
        percentage: Math.round((risingStars.length / total) * 100),
        targetPercentage: 20,
        color: 'purple',
        status: calculateStatus((risingStars.length / total) * 100, 20),
      },
      {
        name: 'Solid Contributors',
        emoji: '🎯',
        description: 'Reliable core team members',
        employees: solidContributors,
        percentage: Math.round((solidContributors.length / total) * 100),
        targetPercentage: 30,
        color: 'gray',
        status: calculateStatus((solidContributors.length / total) * 100, 30),
      },
      {
        name: 'Performance Concerns',
        emoji: '⚠️',
        description: 'Require intervention or role changes',
        employees: concerns,
        percentage: Math.round((concerns.length / total) * 100),
        targetPercentage: 5,
        color: 'red',
        status: concerns.length / total <= 0.05 ? 'on-target' : 'above',
      },
    ];
  }, [employees]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Users className="w-6 h-6 text-blue-600" />
        Talent Portfolio Distribution
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {segments.map((segment) => (
          <SegmentCard key={segment.name} segment={segment} />
        ))}
      </div>

      {/* Portfolio Visualization */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Balance</h3>
        <div className="space-y-3">
          {segments.map((segment) => (
            <div key={segment.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{segment.emoji}</span>
                  <span className="text-sm font-medium text-gray-900">{segment.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {segment.percentage}% / {segment.targetPercentage}% target
                  </span>
                  {segment.status === 'below' && (
                    <span className="text-xs text-red-600 font-medium">Below</span>
                  )}
                  {segment.status === 'above' && segment.name === 'Performance Concerns' && (
                    <span className="text-xs text-red-600 font-medium">High</span>
                  )}
                  {segment.status === 'above' && segment.name !== 'Performance Concerns' && (
                    <span className="text-xs text-green-600 font-medium">Above</span>
                  )}
                  {segment.status === 'on-target' && (
                    <span className="text-xs text-green-600 font-medium">✓</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-${segment.color}-500 transition-all duration-500`}
                    style={{ width: `${Math.min(segment.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden opacity-50">
                  <div
                    className={`h-full bg-${segment.color}-300`}
                    style={{ width: `${segment.targetPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-300 rounded opacity-50"></div>
              <span>Target</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SegmentCardProps {
  segment: TalentSegment;
}

function SegmentCard({ segment }: SegmentCardProps) {
  const bgColors = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    gray: 'bg-gray-50 border-gray-200',
    red: 'bg-red-50 border-red-200',
  };

  const textColors = {
    green: 'text-green-900',
    blue: 'text-blue-900',
    purple: 'text-purple-900',
    gray: 'text-gray-900',
    red: 'text-red-900',
  };

  return (
    <div className={`${bgColors[segment.color as keyof typeof bgColors]} border rounded-lg p-4 hover:shadow-md transition-shadow`}>
      <div className="text-3xl mb-2">{segment.emoji}</div>
      <div className={`text-sm font-semibold mb-1 ${textColors[segment.color as keyof typeof textColors]}`}>
        {segment.name}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">
        {segment.percentage}%
      </div>
      <div className="text-xs text-gray-600 mb-2">
        {segment.employees.length} employee{segment.employees.length !== 1 ? 's' : ''}
      </div>
      <div className="text-xs text-gray-500">
        Target: {segment.targetPercentage}%
      </div>
      {segment.status === 'below' && (
        <div className="mt-2 text-xs text-red-600 font-medium">↓ Below target</div>
      )}
      {segment.status === 'above' && segment.name === 'Performance Concerns' && (
        <div className="mt-2 text-xs text-red-600 font-medium">↑ Above target</div>
      )}
      {segment.status === 'on-target' && (
        <div className="mt-2 text-xs text-green-600 font-medium">✓ On target</div>
      )}
    </div>
  );
}

