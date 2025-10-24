import type { ComponentType } from 'react';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  trend?: number;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  textColor?: string;
  iconClassName?: string;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'bg-blue-600',
  trend,
  onClick,
  active = false,
  className = '',
  variant = 'default',
  textColor,
  iconClassName,
}: StatCardProps) {
  const Component = onClick ? 'button' : 'div';

  if (variant === 'compact') {
    const valueColor = textColor ?? 'text-gray-900';
    const iconColor = iconClassName ?? valueColor;

    return (
      <Component
        onClick={onClick}
        className={`
          flex flex-col items-center justify-center gap-1 rounded-lg p-3 text-center transition-all
          ${onClick ? 'cursor-pointer bg-white border border-gray-200 hover:shadow-md' : 'bg-transparent'}
          ${className}
        `}
      >
        <Icon className={`w-5 h-5 ${iconColor} ${trend !== undefined ? 'mb-0.5' : 'mb-1.5'}`} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
        {subtitle && <span className="text-[11px] text-gray-500">{subtitle}</span>}
        {trend !== undefined && (
          <span
            className={`text-[11px] font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {trend >= 0 ? '+' : '-'}{Math.abs(trend)}%
          </span>
        )}
      </Component>
    );
  }

  return (
    <Component
      onClick={onClick}
      className={`
        bg-white rounded-xl border-2 p-6 transition-all
        ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}
        ${active ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center space-x-1 text-xs font-semibold ${
              trend > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </Component>
  );
}
