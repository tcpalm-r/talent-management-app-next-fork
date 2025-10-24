/**
 * Module Configuration
 * 
 * Central registry of all platform features/modules.
 * Toggle features on/off by changing the `enabled` flag.
 * No database changes needed - pure code-based configuration.
 */

export type ModuleKey =
  | 'nine_box'
  | 'people_dashboard'
  | 'performance_reviews'
  | 'calibration'
  | 'development_plans'
  | '360_feedback'
  | 'ideal_team_player'
  | 'flight_risk'
  | 'succession_planning'
  | 'one_on_ones'
  | 'manager_notes'
  | 'pips'
  | 'onboarding'
  | 'org_chart'
  | 'matrix_organization'
  | 'ai_insights'
  | 'ai_review_parser'
  | 'transcript_importer'
  | 'analytics_dashboard'
  | 'data_quality'
  | 'department_management'
  | 'import_export';

export interface ModuleConfig {
  key: ModuleKey;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'assessment' | 'development' | 'performance' | 'lifecycle' | 'structure' | 'analytics' | 'ai' | 'admin';
  dependsOn?: ModuleKey[]; // Optional dependencies
  beta?: boolean; // Mark as beta feature
}

/**
 * Module Registry
 * 
 * To disable a feature: Set `enabled: false`
 * To enable a feature: Set `enabled: true`
 */
export const MODULES: Record<ModuleKey, ModuleConfig> = {
  // ==================== CORE MODULES ====================
  nine_box: {
    key: 'nine_box',
    name: '9-Box Talent Grid',
    description: 'Visualize performance and potential on the 9-box matrix',
    enabled: true,
    category: 'core',
  },
  
  people_dashboard: {
    key: 'people_dashboard',
    name: 'People Directory',
    description: 'Central directory with employee search and profiles',
    enabled: true,
    category: 'core',
  },

  // ==================== ASSESSMENT MODULES ====================
  performance_reviews: {
    key: 'performance_reviews',
    name: 'Performance Reviews',
    description: 'Self and manager performance review workflow',
    enabled: true,
    category: 'assessment',
  },

  calibration: {
    key: 'calibration',
    name: 'Calibration Sessions',
    description: 'Cross-functional talent calibration and alignment',
    enabled: true,
    category: 'assessment',
    dependsOn: ['nine_box', 'performance_reviews'],
  },

  '360_feedback': {
    key: '360_feedback',
    name: '360 Feedback',
    description: 'Multi-rater feedback surveys with AI-powered insights',
    enabled: true,
    category: 'assessment',
  },

  ideal_team_player: {
    key: 'ideal_team_player',
    name: 'Ideal Team Player',
    description: 'Assess employees on Humble, Hungry, and Smart dimensions',
    enabled: true,
    category: 'assessment',
  },

  // ==================== DEVELOPMENT MODULES ====================
  development_plans: {
    key: 'development_plans',
    name: 'Development Plans',
    description: 'Individual development plans with action items and milestones',
    enabled: true,
    category: 'development',
  },

  succession_planning: {
    key: 'succession_planning',
    name: 'Succession Planning',
    description: 'Identify critical roles and build leadership pipeline',
    enabled: true,
    category: 'development',
    dependsOn: ['nine_box'],
  },

  flight_risk: {
    key: 'flight_risk',
    name: 'Flight Risk Assessment',
    description: 'Identify and mitigate employee retention risks',
    enabled: true,
    category: 'development',
    dependsOn: ['nine_box'],
  },

  one_on_ones: {
    key: 'one_on_ones',
    name: 'One-on-One Meetings',
    description: 'Structure and document manager-employee conversations',
    enabled: true,
    category: 'development',
  },

  // ==================== PERFORMANCE MANAGEMENT ====================
  pips: {
    key: 'pips',
    name: 'Performance Improvement Plans',
    description: 'Structured PIP process with checkpoints and reviews',
    enabled: true,
    category: 'performance',
  },

  manager_notes: {
    key: 'manager_notes',
    name: 'Manager Notes',
    description: 'Private and shared notes for ongoing documentation',
    enabled: true,
    category: 'performance',
  },

  // ==================== LIFECYCLE ====================
  onboarding: {
    key: 'onboarding',
    name: 'Employee Onboarding',
    description: 'Structured onboarding plans with tasks and milestones',
    enabled: true,
    category: 'lifecycle',
  },

  // ==================== STRUCTURE ====================
  org_chart: {
    key: 'org_chart',
    name: 'Organization Chart',
    description: 'Visual organization structure and reporting relationships',
    enabled: true,
    category: 'structure',
  },

  matrix_organization: {
    key: 'matrix_organization',
    name: 'Matrix Organization',
    description: 'Multi-dimensional reporting for complex org structures',
    enabled: true,
    category: 'structure',
    dependsOn: ['org_chart'],
    beta: true,
  },

  department_management: {
    key: 'department_management',
    name: 'Department Management',
    description: 'Configure departments, teams, and organizational units',
    enabled: true,
    category: 'admin',
  },

  // ==================== ANALYTICS ====================
  analytics_dashboard: {
    key: 'analytics_dashboard',
    name: 'Analytics Dashboard',
    description: 'Organization-wide talent metrics and trends',
    enabled: true,
    category: 'analytics',
  },

  data_quality: {
    key: 'data_quality',
    name: 'Data Quality Monitor',
    description: 'Track completeness and quality of talent data',
    enabled: true,
    category: 'analytics',
  },

  // ==================== AI FEATURES ====================
  ai_insights: {
    key: 'ai_insights',
    name: 'AI Insights & Suggestions',
    description: 'AI-powered recommendations throughout the platform',
    enabled: true,
    category: 'ai',
  },

  ai_review_parser: {
    key: 'ai_review_parser',
    name: 'AI Review Parser',
    description: 'Automatically extract insights from performance review text',
    enabled: true,
    category: 'ai',
    dependsOn: ['performance_reviews'],
  },

  transcript_importer: {
    key: 'transcript_importer',
    name: 'Meeting Transcript Import',
    description: 'Import and analyze meeting transcripts for insights',
    enabled: true,
    category: 'ai',
    dependsOn: ['one_on_ones'],
  },

  // ==================== ADMIN ====================
  import_export: {
    key: 'import_export',
    name: 'Data Import/Export',
    description: 'Bulk import and export of employee data',
    enabled: true,
    category: 'admin',
  },
};

/**
 * Get all enabled modules
 */
export function getEnabledModules(): ModuleConfig[] {
  return Object.values(MODULES).filter(m => m.enabled);
}

/**
 * Get modules by category
 */
export function getModulesByCategory(category: ModuleConfig['category']): ModuleConfig[] {
  return Object.values(MODULES).filter(m => m.category === category && m.enabled);
}

/**
 * Check if a module is enabled
 */
export function isModuleEnabled(key: ModuleKey): boolean {
  return MODULES[key]?.enabled ?? false;
}

/**
 * Check if all dependencies are met for a module
 */
export function areDependenciesMet(key: ModuleKey): boolean {
  const module = MODULES[key];
  if (!module?.dependsOn) return true;
  
  return module.dependsOn.every(depKey => isModuleEnabled(depKey));
}

/**
 * Get module configuration
 */
export function getModule(key: ModuleKey): ModuleConfig | undefined {
  return MODULES[key];
}

