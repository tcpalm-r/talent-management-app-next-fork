import Papa from 'papaparse';
import html2canvas from 'html2canvas';
import type { Employee, Department, BoxDefinition } from '../types';

export interface ExportData {
  employees: Employee[];
  departments: Department[];
  boxDefinitions: BoxDefinition[];
}

export function exportToCSV(data: ExportData) {
  const csvData = data.employees.map(employee => ({
    name: employee.name,
    employee_id: employee.employee_id || '',
    email: employee.email || '',
    department: employee.department?.name || '',
    manager: employee.manager_name || '',
    title: employee.title || '',
    location: employee.location || '',
    performance: employee.assessment?.performance || '',
    potential: employee.assessment?.potential || '',
    box_label: getBoxLabel(employee, data.boxDefinitions),
    assessed_by: employee.assessment?.assessed_by || '',
    assessed_at: employee.assessment?.assessed_at ? 
      new Date(employee.assessment.assessed_at).toLocaleDateString() : '',
  }));

  const csv = Papa.unparse(csvData);
  downloadFile(csv, 'talent-assessment-export.csv', 'text/csv');
}

export function exportToHTML(data: ExportData) {
  const html = generateHTMLReport(data);
  downloadFile(html, 'talent-assessment-report.html', 'text/html');
}

export async function exportToPNG(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found for export');
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
    });

    const link = document.createElement('a');
    link.download = 'talent-grid-snapshot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error exporting to PNG:', error);
    throw new Error('Failed to export image');
  }
}

function getBoxLabel(employee: Employee, boxDefinitions: BoxDefinition[]): string {
  if (!employee.assessment?.box_key) return 'Unassigned';
  
  const boxDef = boxDefinitions.find(b => b.key === employee.assessment?.box_key);
  return boxDef?.label || 'Unknown';
}

function generateHTMLReport(data: ExportData): string {
  const { employees, departments, boxDefinitions } = data;
  
  // Group employees by box
  const employeesByBox = employees.reduce((acc, emp) => {
    const boxKey = emp.assessment?.box_key || 'unassigned';
    if (!acc[boxKey]) acc[boxKey] = [];
    acc[boxKey].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  // Statistics
  const totalEmployees = employees.length;
  const assessedEmployees = employees.filter(emp => emp.assessment?.box_key).length;
  const unassignedEmployees = totalEmployees - assessedEmployees;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>9-Box Talent Assessment Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f9fafb;
            color: #111827;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: #3b82f6;
            color: white;
            padding: 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 24px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
        }
        .stat {
            text-align: center;
            padding: 16px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 4px;
        }
        .stat-label {
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
        }
        .grid-container {
            padding: 24px;
        }
        .grid-title {
            text-align: center;
            margin-bottom: 24px;
        }
        .grid-title h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .grid-labels {
            text-align: center;
            margin-bottom: 16px;
            color: #6b7280;
            font-size: 14px;
            font-weight: 500;
        }
        .nine-box-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 12px;
            height: 600px;
            margin-bottom: 24px;
        }
        .box-cell {
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            background: #f9fafb;
            display: flex;
            flex-direction: column;
            min-height: 180px;
        }
        .box-header {
            margin-bottom: 12px;
        }
        .box-color {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .box-title {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
        }
        .box-description {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
        }
        .box-count {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 8px;
        }
        .employee-list {
            flex: 1;
            overflow-y: auto;
        }
        .employee-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 6px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .employee-name {
            font-weight: 500;
            font-size: 13px;
            color: #111827;
            margin-bottom: 2px;
        }
        .employee-title {
            font-size: 11px;
            color: #6b7280;
        }
        .employee-dept {
            font-size: 10px;
            color: #9ca3af;
        }
        .dept-indicator {
            height: 2px;
            margin-top: 4px;
            border-radius: 1px;
        }
        .axis-labels {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #6b7280;
            margin-top: 16px;
        }
        .footer {
            padding: 24px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>9-Box Talent Assessment Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="stat-value">${totalEmployees}</div>
                <div class="stat-label">Total Employees</div>
            </div>
            <div class="stat">
                <div class="stat-value">${assessedEmployees}</div>
                <div class="stat-label">Assessed</div>
            </div>
            <div class="stat">
                <div class="stat-value">${unassignedEmployees}</div>
                <div class="stat-label">Unassigned</div>
            </div>
            <div class="stat">
                <div class="stat-value">${departments.length}</div>
                <div class="stat-label">Departments</div>
            </div>
        </div>

        <div class="grid-container">
            <div class="grid-title">
                <h2>Talent Distribution Grid</h2>
                <div class="grid-labels">
                    <div>Potential (Low → High) ↑</div>
                    <div style="margin-top: 4px;">Performance (Low → High) →</div>
                </div>
            </div>

            <div class="nine-box-grid">
                ${boxDefinitions
                  .sort((a, b) => (2 - a.grid_y) - (2 - b.grid_y) || a.grid_x - b.grid_x)
                  .map(boxDef => {
                    const boxEmployees = employeesByBox[boxDef.key] || [];
                    return `
                    <div class="box-cell" style="grid-column: ${boxDef.grid_x + 1}; grid-row: ${3 - boxDef.grid_y};">
                        <div class="box-header">
                            <span class="box-color" style="background-color: ${boxDef.color};"></span>
                            <span class="box-title">${boxDef.label}</span>
                            <div class="box-description">${boxDef.description || ''}</div>
                        </div>
                        <div class="box-count">${boxEmployees.length} ${boxEmployees.length === 1 ? 'person' : 'people'}</div>
                        <div class="employee-list">
                            ${boxEmployees.map(emp => {
                              const dept = departments.find(d => d.id === emp.department_id);
                              return `
                                <div class="employee-card">
                                    <div class="employee-name">${emp.name}</div>
                                    ${emp.title ? `<div class="employee-title">${emp.title}</div>` : ''}
                                    ${dept ? `<div class="employee-dept">${dept.name}</div>` : ''}
                                    ${dept ? `<div class="dept-indicator" style="background-color: ${dept.color};"></div>` : ''}
                                </div>
                              `;
                            }).join('')}
                        </div>
                    </div>
                    `;
                  }).join('')}
            </div>

            <div class="axis-labels">
                <div>
                    <div>Low Performance</div>
                    <div>Medium Performance</div>
                    <div>High Performance</div>
                </div>
                <div style="text-align: right;">
                    <div>High Potential</div>
                    <div>Medium Potential</div>
                    <div>Low Potential</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>9-Box Talent Assessment Tool - Confidential Report</p>
        </div>
    </div>
</body>
</html>`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}