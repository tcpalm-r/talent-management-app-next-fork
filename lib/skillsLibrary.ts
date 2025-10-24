import { supabase } from './supabase';
import type { Skill } from '../types';

/**
 * Fetch all skills for an organization
 */
export async function getSkills(organizationId: string): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills_library')
    .select('*')
    .eq('organization_id', organizationId)
    .order('usage_count', { ascending: false });

  if (error) {
    console.error('[Skills] Error fetching skills:', error);
    return [];
  }

  return data || [];
}

/**
 * Get skills by category
 */
export async function getSkillsByCategory(
  organizationId: string,
  category: Skill['category']
): Promise<Skill[]> {
  const { data, error } = await supabase
    .from('skills_library')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('category', category)
    .order('skill_name');

  if (error) {
    console.error('[Skills] Error fetching skills by category:', error);
    return [];
  }

  return data || [];
}

/**
 * Add a new skill to the library
 */
export async function addSkill(
  organizationId: string,
  skillName: string,
  category: Skill['category'],
  description?: string
): Promise<Skill | null> {
  const { data, error } = await supabase
    .from('skills_library')
    .insert({
      organization_id: organizationId,
      skill_name: skillName,
      category,
      description,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Skills] Error adding skill:', error);
    return null;
  }

  return data;
}

/**
 * Track skill usage (increment counter)
 */
export async function trackSkillUsage(organizationId: string, skillName: string): Promise<void> {
  try {
    await supabase.rpc('increment_skill_usage', {
      p_organization_id: organizationId,
      p_skill_name: skillName,
    });
  } catch (error) {
    console.error('[Skills] Error tracking usage:', error);
  }
}

/**
 * Search skills by name (for autocomplete)
 */
export function searchSkills(skills: Skill[], query: string): Skill[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return skills;

  return skills.filter(skill =>
    skill.skill_name.toLowerCase().includes(lowerQuery) ||
    skill.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get popular skills (most used)
 */
export function getPopularSkills(skills: Skill[], limit: number = 10): Skill[] {
  return [...skills]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, limit);
}

/**
 * Group skills by category
 */
export function groupSkillsByCategory(skills: Skill[]): Record<Skill['category'], Skill[]> {
  const grouped: Record<Skill['category'], Skill[]> = {
    technical: [],
    soft_skill: [],
    domain_knowledge: [],
    certification: [],
    language: [],
  };

  skills.forEach(skill => {
    if (grouped[skill.category]) {
      grouped[skill.category].push(skill);
    }
  });

  return grouped;
}

/**
 * Get skill category label for display
 */
export function getSkillCategoryLabel(category: Skill['category']): string {
  const labels: Record<Skill['category'], string> = {
    technical: 'Technical Skills',
    soft_skill: 'Soft Skills',
    domain_knowledge: 'Domain Knowledge',
    certification: 'Certifications',
    language: 'Languages',
  };

  return labels[category];
}

/**
 * Get skill category color for badges
 */
export function getSkillCategoryColor(category: Skill['category']): string {
  const colors: Record<Skill['category'], string> = {
    technical: 'blue',
    soft_skill: 'green',
    domain_knowledge: 'purple',
    certification: 'amber',
    language: 'pink',
  };

  return colors[category];
}

