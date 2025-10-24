import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Building2, Users, Tag } from 'lucide-react';
import type { MatrixEmployee } from '../types';
import { orgChartNodeStyle } from '../lib/designTokens';
import { EmployeeNameLink } from './unified';

interface OrgChartNodeProps {
  data: {
    employee: MatrixEmployee;
    onNodeClick?: (employee: MatrixEmployee) => void;
    showBrands?: boolean;
    showChannels?: boolean;
    showAllocation?: boolean;
  };
  isConnectable: boolean;
  selected: boolean;
}

function OrgChartNode({ data, isConnectable, selected }: OrgChartNodeProps) {
  const { employee, onNodeClick, showBrands = true, showChannels = true, showAllocation = false } = data;

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get avatar color based on name hash
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Calculate total allocation percentage
  const totalAllocation = employee.matrix_managers?.reduce(
    (sum, m) => sum + (m.allocation_percentage || 0),
    0
  );

  const handleClick = () => {
    if (onNodeClick) {
      onNodeClick(employee);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        ${orgChartNodeStyle}
        ${selected ? 'border-blue-500 shadow-lg' : ''}
        cursor-pointer
        min-w-[240px] max-w-[280px]
        p-3
      `}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />

      {/* Employee Info */}
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-12 h-12 rounded-full ${getAvatarColor(employee.name)} flex items-center justify-center shadow-sm`}
          >
            <span className="text-white text-sm font-bold">{getInitials(employee.name)}</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
        <EmployeeNameLink
          employee={{ id: employee.id, name: employee.name }}
          className="text-sm font-semibold text-gray-900 whitespace-normal leading-tight hover:text-blue-600 focus-visible:ring-blue-500"
          onClick={(event) => {
            event.stopPropagation();
            onNodeClick?.(employee);
          }}
        />
          {employee.title && (
            <p className="text-xs text-gray-600 whitespace-normal mb-2">{employee.title}</p>
          )}

          {/* Department */}
          {employee.department && (
            <div className="flex items-center mb-2">
              <Building2 className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
              <span className="text-xs text-gray-600 whitespace-normal">{employee.department.name}</span>
            </div>
          )}

          {/* Brands - Primary first */}
          {showBrands && employee.brands && employee.brands.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {employee.brands
                .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                .map((brand) => (
                  <span
                    key={brand.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: brand.color }}
                    title={brand.is_primary ? 'Primary brand' : 'Secondary brand'}
                  >
                    {brand.is_primary && <span className="mr-0.5">●</span>}
                    {brand.name}
                  </span>
                ))}
            </div>
          )}

          {/* Channels */}
          {showChannels && employee.channels && employee.channels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {employee.channels
                .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                .map((channel) => (
                  <span
                    key={channel.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                    style={{
                      backgroundColor: `${channel.color}20`,
                      borderColor: channel.color,
                      color: channel.color,
                    }}
                    title={channel.is_primary ? 'Primary channel' : 'Secondary channel'}
                  >
                    {channel.is_primary && <span className="mr-0.5">●</span>}
                    {channel.name}
                  </span>
                ))}
            </div>
          )}

          {/* Allocation percentage (if matrix reporting exists) */}
          {showAllocation && totalAllocation && totalAllocation > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Allocation</span>
                <span className="font-semibold text-gray-700">{totalAllocation}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(totalAllocation, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Matrix reporting indicator */}
          {employee.matrix_managers && employee.matrix_managers.length > 0 && (
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <Users className="w-3 h-3 mr-1" />
              <span>
                {employee.matrix_managers.length} matrix{' '}
                {employee.matrix_managers.length === 1 ? 'manager' : 'managers'}
              </span>
            </div>
          )}

          {/* Direct reports count */}
          {employee.direct_reports && employee.direct_reports.length > 0 && (
            <div className="flex items-center mt-1 text-xs text-gray-500">
              <Users className="w-3 h-3 mr-1" />
              <span>
                {employee.direct_reports.length} direct{' '}
                {employee.direct_reports.length === 1 ? 'report' : 'reports'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Connection handle at bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
}

export default memo(OrgChartNode);
