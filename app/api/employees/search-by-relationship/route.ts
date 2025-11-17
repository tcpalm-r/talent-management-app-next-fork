import { NextRequest, NextResponse } from 'next/server';
import { getActiveUsers, getUserProfile } from '@/lib/database';
import { detectRelationship, filterEmployeesByRelationship, getEmployeesWithRelationships } from '@/lib/relationshipDetector';
import { ParticipantRelationship } from '@/types';

/**
 * API endpoint for searching employees with relationship filtering
 *
 * Supports two patterns:
 * 1. Search First: Returns all matching employees with auto-detected relationships
 * 2. Filter First: Returns only employees matching the specified relationship
 *
 * Query Parameters:
 * - subjectId: (required) ID of the employee being reviewed
 * - relationship: (optional) Filter by specific relationship type
 * - search: (optional) Search term for name/email/title
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get('subjectId');
    const relationshipFilter = searchParams.get('relationship') as ParticipantRelationship | null;
    const searchTerm = searchParams.get('search');

    // Validate required parameters
    if (!subjectId) {
      return NextResponse.json(
        { error: 'subjectId is required' },
        { status: 400 }
      );
    }

    // Fetch the subject employee
    const subject = await getUserProfile(subjectId);
    if (!subject) {
      return NextResponse.json(
        { error: 'Subject employee not found' },
        { status: 404 }
      );
    }

    // Fetch all active employees
    let employees = await getActiveUsers();

    // Remove the subject from the list
    employees = employees.filter(emp => emp.id !== subjectId);

    // Apply search filter if provided
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      employees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower) ||
        emp.title?.toLowerCase().includes(searchLower)
      );
    }

    // Pattern 1: Filter First - Return only employees matching the relationship
    if (relationshipFilter) {
      const validRelationships: ParticipantRelationship[] = ['manager', 'slt', 'direct_report', 'cross_functional'];

      if (!validRelationships.includes(relationshipFilter)) {
        return NextResponse.json(
          { error: 'Invalid relationship type' },
          { status: 400 }
        );
      }

      const filteredEmployees = filterEmployeesByRelationship(
        subject,
        employees,
        relationshipFilter
      );

      return NextResponse.json({
        employees: filteredEmployees,
        count: filteredEmployees.length,
        relationship: relationshipFilter,
        pattern: 'filter_first'
      });
    }

    // Pattern 2: Search First - Return all employees with detected relationships
    const employeesWithRelationships = getEmployeesWithRelationships(subject, employees);

    return NextResponse.json({
      employees: employeesWithRelationships,
      count: employeesWithRelationships.length,
      pattern: 'search_first'
    });

  } catch (error) {
    console.error('[API /employees/search-by-relationship] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
