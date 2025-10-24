import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { BoxDefinition } from '../types';

export function useBoxDefinitions(organizationId: string | null) {
  const [boxDefinitions, setBoxDefinitions] = useState<BoxDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBoxDefinitions();
  }, [organizationId]);

  const loadBoxDefinitions = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    // Check if we're in mock mode
    if (organizationId === 'mock-org-123') {
      // Return mock box definitions for the 9-box grid
      const mockBoxDefinitions: BoxDefinition[] = [
        // Row 1 (Top - High Potential)
        { id: 'box-1-3', organization_id: null, key: '1-3', label: 'Question Marks', description: 'Low performers with high potential', action_hint: 'Invest in development', color: '#FEF3C7', grid_x: 1, grid_y: 3, created_at: '', updated_at: '' },
        { id: 'box-2-3', organization_id: null, key: '2-3', label: 'Future Stars', description: 'Moderate performers with high potential', action_hint: 'Accelerate development', color: '#DBEAFE', grid_x: 2, grid_y: 3, created_at: '', updated_at: '' },
        { id: 'box-3-3', organization_id: null, key: '3-3', label: 'Stars', description: 'High performers with high potential', action_hint: 'Retain and leverage', color: '#D1FAE5', grid_x: 3, grid_y: 3, created_at: '', updated_at: '' },
        
        // Row 2 (Middle - Medium Potential)
        { id: 'box-1-2', organization_id: null, key: '1-2', label: 'Inconsistent Players', description: 'Low performers with moderate potential', action_hint: 'Coach for improvement', color: '#FED7AA', grid_x: 1, grid_y: 2, created_at: '', updated_at: '' },
        { id: 'box-2-2', organization_id: null, key: '2-2', label: 'Core Performers', description: 'Solid contributors', action_hint: 'Maintain engagement', color: '#E9D5FF', grid_x: 2, grid_y: 2, created_at: '', updated_at: '' },
        { id: 'box-3-2', organization_id: null, key: '3-2', label: 'Key Players', description: 'High performers with moderate potential', action_hint: 'Recognize and reward', color: '#BFDBFE', grid_x: 3, grid_y: 2, created_at: '', updated_at: '' },
        
        // Row 3 (Bottom - Low Potential)
        { id: 'box-1-1', organization_id: null, key: '1-1', label: 'Underperformers', description: 'Low performers with low potential', action_hint: 'Manage out compassionately', color: '#FEE2E2', grid_x: 1, grid_y: 1, created_at: '', updated_at: '' },
        { id: 'box-2-1', organization_id: null, key: '2-1', label: 'Solid Citizens', description: 'Moderate performers with low potential', action_hint: 'Appreciate contributions', color: '#F3E8FF', grid_x: 2, grid_y: 1, created_at: '', updated_at: '' },
        { id: 'box-3-1', organization_id: null, key: '3-1', label: 'Workhorses', description: 'High performers with low potential', action_hint: 'Optimize current role', color: '#CCFBF1', grid_x: 3, grid_y: 1, created_at: '', updated_at: '' },
      ];
      
      setBoxDefinitions(mockBoxDefinitions);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First try to get organization-specific definitions
      let { data, error } = await supabase
        .from('box_definitions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('grid_y', { ascending: true })
        .order('grid_x', { ascending: true });

      if (error) throw error;

      // If no org-specific definitions, get default ones
      if (!data || data.length === 0) {
        const { data: defaultData, error: defaultError } = await supabase
          .from('box_definitions')
          .select('*')
          .is('organization_id', null)
          .order('grid_y', { ascending: true })
          .order('grid_x', { ascending: true });

        if (defaultError) throw defaultError;
        data = defaultData;
      }

      setBoxDefinitions(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading box definitions:', err);
    } finally {
      setLoading(false);
    }
  };

  return { boxDefinitions, loading, error, reload: loadBoxDefinitions };
}