import { useState, useEffect } from 'react';
import { Clock, User, FileText, Filter, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ActivityAuditLogProps {
  organizationId: string;
}

interface ActivityLog {
  id: string;
  user_name: string;
  action_type: string;
  entity_type: string;
  entity_name: string | null;
  changes_made: any;
  affected_count: number;
  created_at: string;
}

export default function ActivityAuditLog({ organizationId }: ActivityAuditLogProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadActivities();
  }, [organizationId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filterAction !== 'all' && activity.action_type !== filterAction) return false;
    if (filterEntity !== 'all' && activity.entity_type !== filterEntity) return false;
    return true;
  });

  const paginatedActivities = filteredActivities.slice(0, page * ITEMS_PER_PAGE);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return '✨';
      case 'update':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'export':
        return '📥';
      case 'import':
        return '📤';
      case 'bulk_update':
        return '⚡';
      default:
        return '📝';
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'create':
        return 'text-green-600 bg-green-50';
      case 'update':
        return 'text-blue-600 bg-blue-50';
      case 'delete':
        return 'text-red-600 bg-red-50';
      case 'export':
        return 'text-purple-600 bg-purple-50';
      case 'import':
        return 'text-indigo-600 bg-indigo-50';
      case 'bulk_update':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Action', 'Entity Type', 'Entity Name', 'Affected Count'];
    const rows = filteredActivities.map(activity => [
      new Date(activity.created_at).toLocaleString(),
      activity.user_name,
      activity.action_type,
      activity.entity_type,
      activity.entity_name || '-',
      activity.affected_count,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uniqueActionTypes = Array.from(new Set(activities.map(a => a.action_type)));
  const uniqueEntityTypes = Array.from(new Set(activities.map(a => a.entity_type)));

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-sm text-gray-600">Loading activity log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Activity Audit Log</h3>
          <p className="text-sm text-gray-600 mt-1">Track all changes and actions in your organization</p>
        </div>
        <button
          onClick={exportToCSV}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Actions</option>
                {uniqueActionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Entities</option>
                {uniqueEntityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-900">
            {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
          </p>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {paginatedActivities.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">No activities found</p>
              <p className="text-xs text-gray-500 mt-1">Activity will appear here as changes are made</p>
            </div>
          ) : (
            paginatedActivities.map(activity => {
              const isExpanded = expandedItems.has(activity.id);
              const hasDetails = activity.changes_made && Object.keys(activity.changes_made).length > 0;

              return (
                <div key={activity.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg ${getActionColor(activity.action_type)}`}>
                      {getActionIcon(activity.action_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{activity.user_name}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getActionColor(activity.action_type)}`}>
                          {activity.action_type}
                        </span>
                        {activity.affected_count > 1 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {activity.affected_count} items
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600">
                        {activity.entity_type} {activity.entity_name && `• ${activity.entity_name}`}
                      </p>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(activity.created_at)}
                        </span>
                        {hasDetails && (
                          <button
                            onClick={() => toggleExpanded(activity.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {isExpanded ? 'Hide' : 'Show'} Details
                          </button>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && hasDetails && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-xs font-medium text-gray-700 mb-2">Changes:</p>
                          <pre className="text-xs text-gray-600 overflow-x-auto">
                            {JSON.stringify(activity.changes_made, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Load More */}
        {filteredActivities.length > paginatedActivities.length && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <button
              onClick={() => setPage(page + 1)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Load More ({filteredActivities.length - paginatedActivities.length} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
