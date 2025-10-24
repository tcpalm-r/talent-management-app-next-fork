import { useState, useEffect } from 'react';
import { Palette, Save, RotateCcw, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BoxDefinition } from '../../types';

interface BoxDefinitionsManagerProps {
  organizationId: string;
  onUpdate?: () => void;
}

const DEFAULT_BOX_DEFINITIONS = [
  { key: '3-3', label: 'Stars', color: '#10B981', grid_x: 3, grid_y: 3, description: 'High performers with high potential', action_hint: 'Retain and promote' },
  { key: '3-2', label: 'Trusted Professionals', color: '#3B82F6', grid_x: 3, grid_y: 2, description: 'High performers with medium potential', action_hint: 'Recognize and retain' },
  { key: '3-1', label: 'Effective Contributors', color: '#8B5CF6', grid_x: 3, grid_y: 1, description: 'High performers with lower potential', action_hint: 'Value their expertise' },
  { key: '2-3', label: 'High Potential', color: '#14B8A6', grid_x: 2, grid_y: 3, description: 'Medium performers with high potential', action_hint: 'Develop and challenge' },
  { key: '2-2', label: 'Core Players', color: '#6B7280', grid_x: 2, grid_y: 2, description: 'Medium performers with medium potential', action_hint: 'Support development' },
  { key: '2-1', label: 'Solid Performers', color: '#9CA3AF', grid_x: 2, grid_y: 1, description: 'Medium performers with lower potential', action_hint: 'Maintain engagement' },
  { key: '1-3', label: 'Rough Diamonds', color: '#F59E0B', grid_x: 1, grid_y: 3, description: 'Lower performers with high potential', action_hint: 'Coach and develop' },
  { key: '1-2', label: 'Inconsistent Players', color: '#EF4444', grid_x: 1, grid_y: 2, description: 'Lower performers with medium potential', action_hint: 'Performance plan needed' },
  { key: '1-1', label: 'Poor Fit', color: '#DC2626', grid_x: 1, grid_y: 1, description: 'Lower performers with lower potential', action_hint: 'Consider alternatives' },
];

export default function BoxDefinitionsManager({ organizationId, onUpdate }: BoxDefinitionsManagerProps) {
  const [boxDefinitions, setBoxDefinitions] = useState<BoxDefinition[]>([]);
  const [editedDefinitions, setEditedDefinitions] = useState<Record<string, Partial<BoxDefinition>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadBoxDefinitions();
  }, [organizationId]);

  const loadBoxDefinitions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('box_definitions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('grid_y', { ascending: false })
        .order('grid_x', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Initialize with defaults if none exist
        await initializeDefaultBoxes();
      } else {
        setBoxDefinitions(data);
      }
    } catch (error) {
      console.error('Error loading box definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultBoxes = async () => {
    try {
      const defaultBoxes = DEFAULT_BOX_DEFINITIONS.map(box => ({
        ...box,
        organization_id: organizationId,
      }));

      const { data, error } = await supabase
        .from('box_definitions')
        .insert(defaultBoxes)
        .select();

      if (error) throw error;
      if (data) {
        setBoxDefinitions(data);
      }
    } catch (error) {
      console.error('Error initializing box definitions:', error);
    }
  };

  const handleFieldChange = (boxKey: string, field: keyof BoxDefinition, value: any) => {
    setEditedDefinitions(prev => ({
      ...prev,
      [boxKey]: {
        ...prev[boxKey],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const getDisplayValue = (box: BoxDefinition, field: keyof BoxDefinition) => {
    if (editedDefinitions[box.key] && editedDefinitions[box.key][field] !== undefined) {
      return editedDefinitions[box.key][field];
    }
    return box[field];
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Update each modified box
      for (const [boxKey, changes] of Object.entries(editedDefinitions)) {
        const box = boxDefinitions.find(b => b.key === boxKey);
        if (!box) continue;

        const { error } = await supabase
          .from('box_definitions')
          .update(changes)
          .eq('id', box.id);

        if (error) throw error;
      }

      // Reload data
      await loadBoxDefinitions();
      setEditedDefinitions({});
      setHasChanges(false);

      if (onUpdate) {
        onUpdate();
      }

      alert('✅ Box definitions updated successfully!');
    } catch (error) {
      console.error('Error saving box definitions:', error);
      alert('❌ Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all changes? This will discard unsaved modifications.')) {
      setEditedDefinitions({});
      setHasChanges(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('Reset all box definitions to default values? This will overwrite all customizations.')) {
      return;
    }

    try {
      setSaving(true);

      // Delete existing definitions
      await supabase
        .from('box_definitions')
        .delete()
        .eq('organization_id', organizationId);

      // Reinitialize with defaults
      await initializeDefaultBoxes();

      setEditedDefinitions({});
      setHasChanges(false);

      if (onUpdate) {
        onUpdate();
      }

      alert('✅ Box definitions reset to defaults!');
    } catch (error) {
      console.error('Error resetting box definitions:', error);
      alert('❌ Failed to reset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-sm text-gray-600">Loading box definitions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">9-Box Grid Customization</h3>
          <p className="text-sm text-gray-600 mt-1">Customize labels, colors, and descriptions for each grid cell</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="btn-secondary flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">How to customize the 9-Box Grid:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><strong>Label:</strong> Short name displayed on the grid</li>
            <li><strong>Color:</strong> Background color for the cell</li>
            <li><strong>Description:</strong> Detailed explanation of this category</li>
            <li><strong>Action Hint:</strong> Recommended actions for employees in this category</li>
          </ul>
        </div>
      </div>

      {/* Box Definitions Grid */}
      <div className="space-y-4">
        {[3, 2, 1].map(y => (
          <div key={y} className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(x => {
              const box = boxDefinitions.find(b => b.grid_x === x && b.grid_y === y);
              if (!box) return null;

              const currentColor = getDisplayValue(box, 'color') as string;

              return (
                <div
                  key={box.key}
                  className="bg-white rounded-lg border-2 border-gray-200 p-4 space-y-3"
                >
                  {/* Position Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500">{box.key}</span>
                    <div
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: currentColor }}
                    />
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                    <input
                      type="text"
                      value={getDisplayValue(box, 'label') as string}
                      onChange={(e) => handleFieldChange(box.key, 'label', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Stars"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleFieldChange(box.key, 'color', e.target.value)}
                        className="w-12 h-9 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={currentColor}
                        onChange={(e) => handleFieldChange(box.key, 'color', e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs font-mono border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="#10B981"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={getDisplayValue(box, 'description') as string || ''}
                      onChange={(e) => handleFieldChange(box.key, 'description', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={2}
                      placeholder="Brief description of this category"
                    />
                  </div>

                  {/* Action Hint */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Action Hint</label>
                    <input
                      type="text"
                      value={getDisplayValue(box, 'action_hint') as string || ''}
                      onChange={(e) => handleFieldChange(box.key, 'action_hint', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Retain and promote"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Reset to Defaults */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleResetToDefaults}
          disabled={saving}
          className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset All to System Defaults
        </button>
        <p className="text-xs text-gray-500 mt-1">
          This will restore all original labels, colors, and descriptions
        </p>
      </div>
    </div>
  );
}
