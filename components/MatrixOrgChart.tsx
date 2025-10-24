import { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Network, Filter, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { MatrixEmployee, Brand, SalesChannel, OrgChartViewMode } from '../types';
import OrgChartNode from './OrgChartNode';
import OrgChartEdge, { type OrgChartEdgeData } from './OrgChartEdge';

interface MatrixOrgChartProps {
  employees: MatrixEmployee[];
  brands: Brand[];
  channels: SalesChannel[];
  onEmployeeClick?: (employee: MatrixEmployee) => void;
}

// Custom node types
const nodeTypes = {
  orgNode: OrgChartNode,
};

// Custom edge types
const edgeTypes = {
  orgEdge: OrgChartEdge,
};

export default function MatrixOrgChart({
  employees,
  brands,
  channels,
  onEmployeeClick,
}: MatrixOrgChartProps) {
  const [viewMode, setViewMode] = useState<OrgChartViewMode>('functional');
  const [showPrimaryLines, setShowPrimaryLines] = useState(true);
  const [showMatrixLines, setShowMatrixLines] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // Build hierarchical tree layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge<OrgChartEdgeData>[] = [];

    // Filter employees based on view mode and selections
    let filteredEmployees = employees;

    if (viewMode === 'brand' && selectedBrands.length > 0) {
      filteredEmployees = employees.filter((emp) =>
        emp.brands?.some((b) => selectedBrands.includes(b.id))
      );
    } else if (viewMode === 'channel' && selectedChannels.length > 0) {
      filteredEmployees = employees.filter((emp) =>
        emp.channels?.some((c) => selectedChannels.includes(c.id))
      );
    }

    // Build hierarchy - find root employees (no primary manager)
    const rootEmployees = filteredEmployees.filter((emp) => !emp.primary_manager_id);

    // Simple tree layout calculation
    const levelHeight = 180;
    const nodeWidth = 280;
    const nodeSpacing = 40;

    const buildTree = (
      employee: MatrixEmployee,
      level: number,
      parentX: number,
      siblingsCount: number,
      siblingIndex: number
    ) => {
      // Calculate position
      const totalWidth = siblingsCount * (nodeWidth + nodeSpacing);
      const startX = parentX - totalWidth / 2;
      const x = startX + siblingIndex * (nodeWidth + nodeSpacing) + nodeWidth / 2;
      const y = level * levelHeight;

      // Add node
      nodes.push({
        id: employee.id,
        type: 'orgNode',
        position: { x, y },
        data: {
          employee,
          onNodeClick: onEmployeeClick,
          showBrands: viewMode === 'functional' || viewMode === 'brand',
          showChannels: viewMode === 'functional' || viewMode === 'channel',
          showAllocation: showMatrixLines,
        },
      });

      // Find direct reports
      const directReports = filteredEmployees.filter(
        (emp) => emp.primary_manager_id === employee.id
      );

      // Add primary edges
      if (showPrimaryLines) {
        directReports.forEach((report) => {
          edges.push({
            id: `primary-${employee.id}-${report.id}`,
            source: employee.id,
            target: report.id,
            type: 'orgEdge',
            data: {
              relationshipType: 'primary',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: '#2563eb',
            },
          });
        });
      }

      // Add matrix edges
      if (showMatrixLines) {
        employee.matrix_managers?.forEach((matrixMgr) => {
          if (matrixMgr.relationship_type !== 'primary') {
            const label =
              matrixMgr.relationship_type === 'brand'
                ? brands.find((b) => b.id === matrixMgr.entity_id)?.name
                : matrixMgr.relationship_type === 'channel'
                ? channels.find((c) => c.id === matrixMgr.entity_id)?.name
                : undefined;

            edges.push({
              id: `matrix-${matrixMgr.manager_id}-${employee.id}-${matrixMgr.relationship_type}`,
              source: matrixMgr.manager_id,
              target: employee.id,
              type: 'orgEdge',
              data: {
                relationshipType: matrixMgr.relationship_type,
                label,
                allocationPercentage: matrixMgr.allocation_percentage,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: '#94a3b8',
              },
            });
          }
        });
      }

      // Recursively build children
      directReports.forEach((report, index) => {
        buildTree(report, level + 1, x, directReports.length, index);
      });
    };

    // Build tree for each root
    rootEmployees.forEach((root, index) => {
      buildTree(root, 0, index * 800, rootEmployees.length, index);
    });

    return { nodes, edges };
  }, [
    employees,
    brands,
    channels,
    viewMode,
    showPrimaryLines,
    showMatrixLines,
    selectedBrands,
    selectedChannels,
    onEmployeeClick,
  ]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleExport = useCallback(() => {
    // TODO: Implement export to PNG/PDF
    console.log('Export org chart');
  }, []);

  const handleBrandToggle = (brandId: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId]
    );
  };

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  // Check if database setup is needed
  // Always show setup message for now since matrix tables don't exist yet
  const needsDatabaseSetup = true; // Will be: employees.length === 0 || (brands.length === 0 && channels.length === 0);

  // Show setup message if tables don't exist
  if (needsDatabaseSetup) {
    return (
      <div className="h-[calc(100vh-180px)] bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <Network className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Matrix Organization Chart</h2>
            <p className="text-gray-600">
              Visualize your organization structure with brands, channels, and matrix relationships
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl font-bold">!</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-900 mb-2">Database Setup Required</h3>
                <p className="text-amber-800 mb-4">
                  The matrix organization chart requires additional database tables for brands, sales channels, and matrix relationships.
                </p>
                <div className="space-y-2 text-sm text-amber-700">
                  <p className="font-medium">To enable this feature, run these SQL scripts in your Supabase SQL Editor:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li><code className="bg-amber-100 px-2 py-0.5 rounded">supabase-matrix-schema.sql</code> - Creates the required tables</li>
                    <li><code className="bg-amber-100 px-2 py-0.5 rounded">supabase-matrix-seed.sql</code> - Adds sample data</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Features Coming Soon:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium text-blue-900">Multi-dimensional View</div>
                  <div className="text-sm text-blue-700">View by function, brand, channel, or matrix</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium text-blue-900">Primary & Matrix Lines</div>
                  <div className="text-sm text-blue-700">Solid lines for direct reports, dotted for matrix</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium text-blue-900">Brand Affiliations</div>
                  <div className="text-sm text-blue-700">Track iPort, Sonance, James, Blaze, Truefig</div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <div className="font-medium text-blue-900">Sales Channels</div>
                  <div className="text-sm text-blue-700">Residential, Retail, Commercial, Enterprise</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-180px)] bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header Controls */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Network className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Matrix Organization Chart</h2>
          </div>

          <div className="flex items-center space-x-3">
            {/* View Mode Selector */}
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as OrgChartViewMode)}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="functional">Functional View</option>
              <option value="brand">Brand View</option>
              <option value="channel">Channel View</option>
              <option value="matrix">Matrix View</option>
            </select>

            {/* Line toggles */}
            <div className="flex items-center space-x-2 px-3 py-1.5 border border-gray-200 rounded">
              <label className="flex items-center space-x-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrimaryLines}
                  onChange={(e) => setShowPrimaryLines(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="text-gray-700">Primary</span>
              </label>
              <label className="flex items-center space-x-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMatrixLines}
                  onChange={(e) => setShowMatrixLines(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="text-gray-700">Matrix</span>
              </label>
            </div>

            <button
              onClick={handleExport}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </button>
          </div>
        </div>

        {/* Brand/Channel Filters */}
        {(viewMode === 'brand' || viewMode === 'matrix') && brands.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 font-medium">Brands:</span>
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => handleBrandToggle(brand.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  selectedBrands.includes(brand.id) || selectedBrands.length === 0
                    ? 'text-white'
                    : 'text-gray-400 opacity-50'
                }`}
                style={{
                  backgroundColor:
                    selectedBrands.includes(brand.id) || selectedBrands.length === 0
                      ? brand.color
                      : '#e5e7eb',
                }}
              >
                {brand.name}
              </button>
            ))}
          </div>
        )}

        {(viewMode === 'channel' || viewMode === 'matrix') && channels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 font-medium">Channels:</span>
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelToggle(channel.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  selectedChannels.includes(channel.id) || selectedChannels.length === 0
                    ? 'text-white'
                    : 'text-gray-400 opacity-50'
                }`}
                style={{
                  backgroundColor:
                    selectedChannels.includes(channel.id) || selectedChannels.length === 0
                      ? channel.color
                      : '#e5e7eb',
                }}
              >
                {channel.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* React Flow Canvas */}
      <div className="h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} />

          {/* Legend Panel */}
          <Panel position="bottom-left" className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 m-4">
            <div className="text-xs space-y-2">
              <div className="font-semibold text-gray-700 mb-2">Legend</div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-0.5 bg-blue-600"></div>
                <span className="text-gray-600">Primary Reporting</span>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className="w-8 h-0.5 bg-gray-400"
                  style={{ backgroundImage: 'repeating-linear-gradient(to right, #94a3b8 0, #94a3b8 5px, transparent 5px, transparent 10px)' }}
                ></div>
                <span className="text-gray-600">Matrix Reporting</span>
              </div>
              {viewMode !== 'functional' && (
                <>
                  <div className="text-gray-500 text-xs mt-2">● = Primary affiliation</div>
                </>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
