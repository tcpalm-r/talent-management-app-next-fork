/**
 * Relationship Detection Helper
 *
 * Determines the relationship between a survey subject and a potential reviewer
 * based on organizational hierarchy and role data.
 */

import { UserProfile } from './schema';
import { ParticipantRelationship } from '@/types';

/**
 * Detects the relationship between a survey subject and a potential reviewer
 *
 * Logic hierarchy:
 * 1. Manager: reviewer's ID matches subject's manager_id
 * 2. Direct Report: subject's ID matches reviewer's manager_id
 * 3. SLT: reviewer has app_role = 'slt' (and is not manager or direct report)
 * 4. Cross-Functional: Everyone else (colleagues not in above categories)
 *
 * @param subject - The employee being reviewed
 * @param reviewer - The potential reviewer
 * @returns The relationship type
 */
export function detectRelationship(
  subject: UserProfile,
  reviewer: UserProfile
): ParticipantRelationship {
  // Rule 1: Is the reviewer the subject's manager?
  // Check both manager_id (UUID) and manager_email (fallback for legacy data)
  if (subject.manager_id && reviewer.id === subject.manager_id) {
    return 'manager';
  }
  if (subject.manager_email && reviewer.email &&
      subject.manager_email.toLowerCase() === reviewer.email.toLowerCase()) {
    return 'manager';
  }

  // Rule 2: Is the reviewer a direct report of the subject?
  // Check both manager_id (UUID) and manager_email (fallback for legacy data)
  if (reviewer.manager_id && reviewer.manager_id === subject.id) {
    return 'direct_report';
  }
  if (reviewer.manager_email && subject.email &&
      reviewer.manager_email.toLowerCase() === subject.email.toLowerCase()) {
    return 'direct_report';
  }

  // Rule 3: Is the reviewer an SLT member (but not manager or direct report)?
  // Note: We already ruled out manager and direct report above
  if (reviewer.app_role === 'slt') {
    return 'slt';
  }

  // Rule 4: Default to cross-functional for all other colleagues
  return 'cross_functional';
}

/**
 * Filters a list of employees by their relationship to the subject
 *
 * @param subject - The employee being reviewed
 * @param allEmployees - List of all potential reviewers
 * @param relationshipFilter - The relationship type to filter by
 * @returns Filtered list of employees matching the relationship
 */
export function filterEmployeesByRelationship(
  subject: UserProfile,
  allEmployees: UserProfile[],
  relationshipFilter: ParticipantRelationship
): UserProfile[] {
  return allEmployees.filter(employee => {
    // Don't include the subject themselves
    if (employee.id === subject.id) return false;

    // Detect the relationship and compare with the filter
    const relationship = detectRelationship(subject, employee);
    return relationship === relationshipFilter;
  });
}

/**
 * Gets employees with their auto-detected relationships
 * Useful for "search first" pattern where we show all matches with detected relationships
 *
 * @param subject - The employee being reviewed
 * @param employees - List of employees to annotate
 * @returns Employees with their detected relationship
 */
export function getEmployeesWithRelationships(
  subject: UserProfile,
  employees: UserProfile[]
): Array<UserProfile & { detected_relationship: ParticipantRelationship }> {
  return employees
    .filter(emp => emp.id !== subject.id) // Exclude subject
    .map(employee => ({
      ...employee,
      detected_relationship: detectRelationship(subject, employee)
    }));
}

/**
 * Counts employees by relationship type
 * Useful for showing available reviewers per category
 *
 * @param subject - The employee being reviewed
 * @param allEmployees - List of all potential reviewers
 * @returns Object with counts per relationship type
 */
export function countEmployeesByRelationship(
  subject: UserProfile,
  allEmployees: UserProfile[]
): Record<ParticipantRelationship, number> {
  const counts: Record<ParticipantRelationship, number> = {
    manager: 0,
    slt: 0,
    direct_report: 0,
    cross_functional: 0
  };

  allEmployees.forEach(employee => {
    if (employee.id === subject.id) return; // Skip subject

    const relationship = detectRelationship(subject, employee);
    counts[relationship]++;
  });

  return counts;
}
