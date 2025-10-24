import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';
import { orgChartLineStyles } from '../lib/designTokens';
import type { RelationshipType } from '../types';

export interface OrgChartEdgeData {
  relationshipType: RelationshipType;
  label?: string;
  allocationPercentage?: number;
}

function OrgChartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps<OrgChartEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isPrimary = data?.relationshipType === 'primary';
  const lineStyle = isPrimary ? orgChartLineStyles.primary : orgChartLineStyles.matrix;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: lineStyle.stroke,
          strokeWidth: selected ? lineStyle.strokeWidth + 1 : lineStyle.strokeWidth,
          strokeDasharray: lineStyle.strokeDasharray,
          opacity: selected ? 1 : lineStyle.opacity,
          transition: 'all 0.2s ease',
        }}
      />

      {/* Optional label for matrix relationships */}
      {data?.label && !isPrimary && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="bg-white px-2 py-0.5 rounded text-xs font-medium text-gray-600 border border-gray-300 shadow-sm">
              {data.label}
              {data.allocationPercentage && ` (${data.allocationPercentage}%)`}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(OrgChartEdge);
