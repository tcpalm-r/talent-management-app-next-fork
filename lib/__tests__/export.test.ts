/**
 * Tests for export.ts - CSV/HTML/PNG Export Utilities
 */

import type { Employee, Department, BoxDefinition } from '../../types';

// Mock dependencies
jest.mock('papaparse');
jest.mock('html2canvas');

import Papa from 'papaparse';
import html2canvas from 'html2canvas';
import { exportToCSV, exportToHTML, exportToPNG, type ExportData } from '../export';

describe('export.ts - Export Utilities', () => {
  // Mock data
  const mockDepartments: Department[] = [
    {
      id: 'dept-1',
      name: 'Engineering',
      color: '#3B82F6',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'dept-2',
      name: 'Product',
      color: '#10B981',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockBoxDefinitions: BoxDefinition[] = [
    {
      key: 'high-high',
      label: 'Star Performer',
      description: 'High performance, high potential',
      color: '#10B981',
      grid_x: 2,
      grid_y: 2,
    },
    {
      key: 'medium-medium',
      label: 'Core Contributor',
      description: 'Medium performance, medium potential',
      color: '#F59E0B',
      grid_x: 1,
      grid_y: 1,
    },
    {
      key: 'low-low',
      label: 'Underperformer',
      description: 'Low performance, low potential',
      color: '#EF4444',
      grid_x: 0,
      grid_y: 0,
    },
  ];

  const mockEmployees: Employee[] = [
    {
      id: 'emp-1',
      name: 'John Doe',
      employee_id: 'E001',
      email: 'john@example.com',
      department_id: 'dept-1',
      department: mockDepartments[0],
      manager_id: null,
      manager_name: null,
      title: 'Senior Engineer',
      location: 'San Francisco',
      assessment: {
        performance: 'high',
        potential: 'high',
        box_key: 'high-high',
        assessed_by: 'Manager A',
        assessed_at: new Date('2024-01-15').toISOString(),
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'emp-2',
      name: 'Jane Smith',
      employee_id: 'E002',
      email: 'jane@example.com',
      department_id: 'dept-2',
      department: mockDepartments[1],
      manager_id: 'emp-1',
      manager_name: 'John Doe',
      title: 'Product Manager',
      location: 'New York',
      assessment: {
        performance: 'medium',
        potential: 'medium',
        box_key: 'medium-medium',
        assessed_by: 'Manager B',
        assessed_at: new Date('2024-01-16').toISOString(),
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'emp-3',
      name: 'Bob Johnson',
      employee_id: 'E003',
      email: 'bob@example.com',
      department_id: 'dept-1',
      department: mockDepartments[0],
      manager_id: 'emp-1',
      manager_name: 'John Doe',
      title: 'Junior Engineer',
      location: 'San Francisco',
      assessment: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockExportData: ExportData = {
    employees: mockEmployees,
    departments: mockDepartments,
    boxDefinitions: mockBoxDefinitions,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Papa.unparse
    (Papa.unparse as jest.Mock).mockReturnValue('name,email,department\nJohn,john@test.com,Engineering');

    // Mock URL.createObjectURL/revokeObjectURL (jsdom doesn't implement these)
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();

    // Mock link click (prevent actual navigation in tests)
    HTMLAnchorElement.prototype.click = jest.fn();
  });

  describe('exportToCSV', () => {
    it('should export employees to CSV format', () => {
      exportToCSV(mockExportData);

      expect(Papa.unparse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'John Doe',
            employee_id: 'E001',
            email: 'john@example.com',
            department: 'Engineering',
            manager: null,
            title: 'Senior Engineer',
            location: 'San Francisco',
            performance: 'high',
            potential: 'high',
            box_label: 'Star Performer',
            assessed_by: 'Manager A',
            assessed_at: '1/15/2024',
          }),
        ])
      );
    });

    it('should handle employees without assessment', () => {
      exportToCSV(mockExportData);

      const callArgs = (Papa.unparse as jest.Mock).mock.calls[0][0];
      const bobEmployee = callArgs.find((emp: any) => emp.name === 'Bob Johnson');

      expect(bobEmployee).toMatchObject({
        performance: '',
        potential: '',
        box_label: 'Unassigned',
        assessed_by: '',
        assessed_at: '',
      });
    });

    it('should handle employees without optional fields', () => {
      const minimalEmployee: Employee = {
        id: 'emp-4',
        name: 'Minimal Employee',
        email: null,
        employee_id: null,
        department_id: null,
        department: null,
        manager_id: null,
        manager_name: null,
        title: null,
        location: null,
        assessment: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const data = {
        ...mockExportData,
        employees: [minimalEmployee],
      };

      exportToCSV(data);

      const callArgs = (Papa.unparse as jest.Mock).mock.calls[0][0];
      expect(callArgs[0]).toMatchObject({
        name: 'Minimal Employee',
        employee_id: '',
        email: '',
        department: '',
        manager: '',
        title: '',
        location: '',
      });
    });

    it('should create downloadable CSV file', () => {
      exportToCSV(mockExportData);

      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });

    it('should handle empty employee list', () => {
      const emptyData = {
        ...mockExportData,
        employees: [],
      };

      exportToCSV(emptyData);

      expect(Papa.unparse).toHaveBeenCalledWith([]);
    });

    it('should format assessment date correctly', () => {
      exportToCSV(mockExportData);

      const callArgs = (Papa.unparse as jest.Mock).mock.calls[0][0];
      const johnEmployee = callArgs.find((emp: any) => emp.name === 'John Doe');

      expect(johnEmployee.assessed_at).toBe('1/15/2024');
    });

    it('should map box_key to box label', () => {
      exportToCSV(mockExportData);

      const callArgs = (Papa.unparse as jest.Mock).mock.calls[0][0];
      const janeEmployee = callArgs.find((emp: any) => emp.name === 'Jane Smith');

      expect(janeEmployee.box_label).toBe('Core Contributor');
    });
  });

  describe('exportToHTML', () => {
    it('should generate HTML report with all sections', () => {
      // Spy on document.createElement to capture HTML content
      const createElementSpy = jest.spyOn(document, 'createElement');

      exportToHTML(mockExportData);

      // Check that the download was triggered
      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });

    it('should include statistics section', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      // Total employees: 3
      expect(htmlContent).toMatch(/<div class="stat-value">3<\/div>/);
      // Assessed: 2 (John and Jane have assessments)
      expect(htmlContent).toMatch(/<div class="stat-value">2<\/div>/);
      // Unassigned: 1 (Bob has no assessment)
      expect(htmlContent).toMatch(/<div class="stat-value">1<\/div>/);
      // Departments: 2
      expect(htmlContent).toMatch(/<div class="stat-value">2<\/div>/);
    });

    it('should render 9-box grid with proper structure', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      expect(htmlContent).toContain('nine-box-grid');
      expect(htmlContent).toContain('box-cell');
      expect(htmlContent).toContain('Star Performer');
      expect(htmlContent).toContain('Core Contributor');
      expect(htmlContent).toContain('Underperformer');
    });

    it('should include employee cards in boxes', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      expect(htmlContent).toContain('John Doe');
      expect(htmlContent).toContain('Senior Engineer');
      expect(htmlContent).toContain('Jane Smith');
      expect(htmlContent).toContain('Product Manager');
    });

    it('should apply department colors to employee cards', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      // Engineering department color
      expect(htmlContent).toContain('background-color: #3B82F6');
      // Product department color
      expect(htmlContent).toContain('background-color: #10B981');
    });

    it('should include CSS styling', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      expect(htmlContent).toContain('<style>');
      expect(htmlContent).toContain('font-family');
      expect(htmlContent).toContain('.container');
      expect(htmlContent).toContain('.nine-box-grid');
    });

    it('should include generation timestamp', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      expect(htmlContent).toMatch(/Generated on \d+\/\d+\/\d+/);
    });

    it('should sort boxes by grid position', () => {
      exportToHTML(mockExportData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      // Boxes should be sorted by grid position (y desc, x asc)
      const starIndex = htmlContent.indexOf('Star Performer');
      const coreIndex = htmlContent.indexOf('Core Contributor');
      const underIndex = htmlContent.indexOf('Underperformer');

      // Star (2,2) should appear before Core (1,1) should appear before Under (0,0)
      expect(starIndex).toBeLessThan(coreIndex);
      expect(coreIndex).toBeLessThan(underIndex);
    });

    it('should create downloadable HTML file', () => {
      exportToHTML(mockExportData);

      expect(global.Blob).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ type: 'text/html' })
      );
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle empty employees list', () => {
      const emptyData = {
        ...mockExportData,
        employees: [],
      };

      exportToHTML(emptyData);

      const blobCall = (global.Blob as jest.Mock).mock.calls[0];
      const htmlContent = blobCall[0][0];

      expect(htmlContent).toContain('<div class="stat-value">0</div>');
    });
  });

  describe('exportToPNG', () => {
    let mockCanvas: any;
    let mockLink: any;

    beforeEach(() => {
      // Mock canvas element
      mockCanvas = {
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mockdata'),
      };

      (html2canvas as jest.Mock).mockResolvedValue(mockCanvas);

      // Mock link element
      mockLink = {
        click: jest.fn(),
        download: '',
        href: '',
      };

      // Update document mocks
      (document.getElementById as jest.Mock).mockReturnValue({
        id: 'test-element',
        innerHTML: '<div>Test content</div>',
      });

      (document.createElement as jest.Mock).mockReturnValue(mockLink);
    });

    it('should export element to PNG', async () => {
      await exportToPNG('test-element');

      expect(document.getElementById).toHaveBeenCalledWith('test-element');
      expect(html2canvas).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
        })
      );
    });

    it('should create downloadable PNG file', async () => {
      await exportToPNG('test-element');

      expect(mockLink.download).toBe('talent-grid-snapshot.png');
      expect(mockLink.href).toContain('data:image/png');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should throw error when element not found', async () => {
      (document.getElementById as jest.Mock).mockReturnValueOnce(null);

      await expect(exportToPNG('non-existent')).rejects.toThrow('Element not found for export');
    });

    it('should handle html2canvas errors gracefully', async () => {
      (html2canvas as jest.Mock).mockRejectedValue(new Error('Canvas error'));

      await expect(exportToPNG('test-element')).rejects.toThrow('Failed to export image');
    });

    it('should configure html2canvas with correct options', async () => {
      await exportToPNG('test-element');

      expect(html2canvas).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
        })
      );
    });

    it('should generate PNG with high resolution (scale: 2)', async () => {
      await exportToPNG('test-element');

      const options = (html2canvas as jest.Mock).mock.calls[0][1];
      expect(options.scale).toBe(2);
    });
  });

  describe('Integration scenarios', () => {
    it('should export same data to CSV and HTML', () => {
      exportToCSV(mockExportData);
      exportToHTML(mockExportData);

      // Both should have been called
      expect(Papa.unparse).toHaveBeenCalledTimes(1);
      expect(global.Blob).toHaveBeenCalledTimes(2);

      // Both should include the same employee data
      const csvCall = (Papa.unparse as jest.Mock).mock.calls[0][0];
      const htmlCall = (global.Blob as jest.Mock).mock.calls[1][0][0];

      expect(csvCall.some((emp: any) => emp.name === 'John Doe')).toBe(true);
      expect(htmlCall).toContain('John Doe');
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset: ExportData = {
        employees: Array.from({ length: 100 }, (_, i) => ({
          ...mockEmployees[0],
          id: `emp-${i}`,
          name: `Employee ${i}`,
          employee_id: `E${String(i).padStart(3, '0')}`,
        })),
        departments: mockDepartments,
        boxDefinitions: mockBoxDefinitions,
      };

      exportToCSV(largeDataset);

      expect(Papa.unparse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Employee 0' }),
          expect.objectContaining({ name: 'Employee 99' }),
        ])
      );
    });
  });
});
