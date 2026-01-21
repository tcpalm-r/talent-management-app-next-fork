/**
 * ITP (Ideal Team Player) Self-Assessment Types
 * Based on Patrick Lencioni's Ideal Team Player framework
 */

// The three virtues
export type ITPVirtue = 'humble' | 'hungry' | 'people_smart';

// Assessment status lifecycle
export type ITPAssessmentStatus = 'draft' | 'submitted' | 'archived';

/**
 * Behavior definition - one of the 12 behaviors across 3 virtues
 */
export interface ITPBehavior {
  virtue: ITPVirtue;
  behaviorKey: string;
  behaviorName: string;
  descriptionNotLiving: string;   // Rating 1 description
  descriptionLiving: string;       // Rating 3 description
  descriptionRoleModeling: string; // Rating 5 description
}

/**
 * Individual response - a rating for one behavior
 */
export interface ITPResponse {
  id?: string;
  assessment_id?: string;
  behaviorKey: string;
  rating: number; // 1-5
  created_at?: string;
  updated_at?: string;
}

/**
 * Assessment record - container for all responses
 */
export interface ITPAssessment {
  id: string;
  employee_id: string;
  status: ITPAssessmentStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  responses?: ITPResponse[];
}

/**
 * Assessment with additional computed/joined fields
 */
export interface ITPAssessmentWithDetails extends ITPAssessment {
  employee_name?: string;
  responses: ITPResponse[];
}

/**
 * User profile (minimal fields needed for ITP)
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  app_role?: 'admin' | 'leader' | 'slt' | 'user';
  manager_id?: string | null;
  manager_email?: string | null;
}
