import { useState, useCallback } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, X, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { validateEmail, getBoxKey, generateRandomColor } from '../lib/utils';
import type { Department, Employee, Assessment, Performance, Potential, ImportMapping, ImportPreview } from '../types';

interface ImportModalProps {
  organizationId: string;
  departments: Department[];
  onImportComplete: () => void;
  onClose: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

const FIELD_OPTIONS = [
  { value: 'name', label: 'Name *' },
  { value: 'employee_id', label: 'Employee ID' },
  { value: 'email', label: 'Email' },
  { value: 'title', label: 'Title' },
  { value: 'department', label: 'Department' },
  { value: 'manager_name', label: 'Manager' },
  { value: 'location', label: 'Location' },
  { value: 'performance', label: 'Performance (low/medium/high)' },
  { value: 'potential', label: 'Potential (low/medium/high)' },
];

export default function ImportModal({
  organizationId,
  departments,
  onImportComplete,
  onClose,
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ImportMapping[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importResults, setImportResults] = useState<{
    created: number;
    updated: number;
    errors: number;
  } | null>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setLoading(true);
    setError('');

    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV: ' + results.errors[0].message);
          setLoading(false);
          return;
        }

        const data = results.data as string[][];
        const headers = data[0] || [];
        const rows = data.slice(1).filter(row => row.some(cell => cell.trim()));

        setCsvHeaders(headers);
        setCsvData(rows);
        
        // Auto-map common headers
        const autoMappings: ImportMapping[] = headers.map(header => {
          const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          let targetField: keyof Employee | 'performance' | 'potential' = 'name';

          if (normalizedHeader.includes('name') && !normalizedHeader.includes('manager')) {
            targetField = 'name';
          } else if (normalizedHeader.includes('id') || normalizedHeader.includes('empid')) {
            targetField = 'employee_id';
          } else if (normalizedHeader.includes('email') || normalizedHeader.includes('mail')) {
            targetField = 'email';
          } else if (normalizedHeader.includes('title') || normalizedHeader.includes('role') || normalizedHeader.includes('position')) {
            targetField = 'title';
          } else if (normalizedHeader.includes('department') || normalizedHeader.includes('dept')) {
            targetField = 'department_id';
          } else if (normalizedHeader.includes('manager')) {
            targetField = 'manager_name';
          } else if (normalizedHeader.includes('location') || normalizedHeader.includes('office')) {
            targetField = 'location';
          } else if (normalizedHeader.includes('performance') || normalizedHeader.includes('perf')) {
            targetField = 'performance';
          } else if (normalizedHeader.includes('potential') || normalizedHeader.includes('pot')) {
            targetField = 'potential';
          }

          return {
            sourceColumn: header,
            targetField,
          };
        });

        setMappings(autoMappings);
        setStep('mapping');
        setLoading(false);
      },
      header: false,
      skipEmptyLines: true,
    });
  }, []);

  const handleMappingChange = (sourceColumn: string, targetField: keyof Employee | 'performance' | 'potential') => {
    setMappings(prev => prev.map(mapping => 
      mapping.sourceColumn === sourceColumn 
        ? { ...mapping, targetField }
        : mapping
    ));
  };

  const generatePreview = async () => {
    setLoading(true);
    setError('');

    try {
      const preview: ImportPreview = {
        valid: [],
        invalid: [],
        duplicates: [],
      };

      const departmentMap = new Map(departments.map(d => [d.name.toLowerCase(), d.id]));
      const existingEmployees = new Map<string, Employee>();

      // Get existing employees for duplicate detection
      const { data: existing, error: fetchError } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organizationId);

      if (fetchError) throw fetchError;

      existing?.forEach(emp => {
        if (emp.employee_id) existingEmployees.set(emp.employee_id, emp);
        if (emp.email) existingEmployees.set(emp.email, emp);
      });

      // Process each row
      for (const row of csvData) {
        const rowData: Record<string, string> = {};
        const errors: string[] = [];

        // Map CSV row to our fields
        mappings.forEach((mapping, index) => {
          const value = row[index]?.trim() || '';
          if (value) {
            rowData[mapping.targetField] = value;
          }
        });

        // Validation
        if (!rowData.name) {
          errors.push('Name is required');
        }

        if (rowData.email && !validateEmail(rowData.email)) {
          errors.push('Invalid email format');
        }

        if (rowData.performance && !['low', 'medium', 'high'].includes(rowData.performance.toLowerCase())) {
          errors.push('Performance must be low, medium, or high');
        }

        if (rowData.potential && !['low', 'medium', 'high'].includes(rowData.potential.toLowerCase())) {
          errors.push('Potential must be low, medium, or high');
        }

        // Create employee object
        const employee: Partial<Employee> = {
          organization_id: organizationId,
          name: rowData.name,
          employee_id: rowData.employee_id || null,
          email: rowData.email || null,
          title: rowData.title || null,
          manager_name: rowData.manager_name || null,
          location: rowData.location || null,
        };

        // Handle department
        if (rowData.department_id) {
          const deptId = departmentMap.get(rowData.department_id.toLowerCase());
          if (deptId) {
            employee.department_id = deptId;
          } else {
            errors.push(`Department "${rowData.department_id}" not found`);
          }
        }

        // Check for duplicates
        const isDuplicate = (employee.employee_id && existingEmployees.has(employee.employee_id)) ||
                           (employee.email && existingEmployees.has(employee.email));

        if (errors.length > 0) {
          preview.invalid.push({ row: rowData, errors });
        } else if (isDuplicate) {
          preview.duplicates.push(employee as Employee);
        } else {
          // Add assessment if performance/potential provided
          if (rowData.performance || rowData.potential) {
            const performance = rowData.performance?.toLowerCase() as Performance;
            const potential = rowData.potential?.toLowerCase() as Potential;
            
            employee.assessment = {
              performance: performance || null,
              potential: potential || null,
              box_key: (performance && potential) ? getBoxKey(performance, potential) : null,
            } as Assessment;
          }

          preview.valid.push(employee as Employee);
        }
      }

      setPreview(preview);
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setStep('importing');
    setLoading(true);

    try {
      let created = 0, updated = 0, errors = 0;

      // Import employees
      for (const employee of [...preview.valid, ...preview.duplicates]) {
        try {
          const { data, error } = await supabase
            .from('employees')
            .upsert({
              ...employee,
              id: undefined, // Let Supabase generate new IDs
            } as any)
            .select()
            .single();

          if (error) throw error;

          const isUpdate = preview.duplicates.includes(employee);
          if (isUpdate) updated++;
          else created++;

          // Create assessment if provided
          if (employee.assessment && data) {
            const { error: assessmentError } = await supabase
              .from('assessments')
              .upsert({
                employee_id: data.id,
                organization_id: organizationId,
                performance: employee.assessment.performance,
                potential: employee.assessment.potential,
                box_key: employee.assessment.box_key,
                assessed_by: (await supabase.auth.getUser()).data.user?.id,
                assessed_at: new Date().toISOString(),
              });

            if (assessmentError) {
              console.error('Error creating assessment:', assessmentError);
            }
          }
        } catch (err) {
          console.error('Error importing employee:', err);
          errors++;
        }
      }

      setImportResults({ created, updated, errors });
      setStep('complete');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['employee_id', 'name', 'email', 'department', 'manager', 'title', 'location', 'performance', 'potential'],
      ['EMP001', 'John Doe', 'john.doe@company.com', 'Engineering', 'Jane Smith', 'Senior Engineer', 'New York', 'high', 'high'],
      ['EMP002', 'Alice Brown', 'alice.brown@company.com', 'Sales', 'Bob Wilson', 'Sales Manager', 'San Francisco', 'medium', 'high'],
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderStep = () => {
    switch (step) {
      case 'upload':
        return (
          <div className="p-6">
            <div className="text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload Employee Data
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Import your employee data from a CSV file
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose CSV File
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Maximum file size: 10MB
                </p>
              </div>

              <div className="text-left">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download CSV Template
                </button>
              </div>
            </div>
          </div>
        );

      case 'mapping':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Map CSV Columns</h3>
            <p className="text-sm text-gray-600 mb-6">
              Match your CSV columns to the appropriate fields
            </p>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {csvHeaders.map((header, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <div className="w-1/3">
                    <label className="text-sm font-medium text-gray-700">
                      {header}
                    </label>
                  </div>
                  <div className="flex-1">
                    <select
                      value={mappings[index]?.targetField || ''}
                      onChange={(e) => handleMappingChange(header, e.target.value as any)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">-- Skip this column --</option>
                      {FIELD_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={generatePreview}
                disabled={loading || !mappings.some(m => m.targetField === 'name')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Preview Import'}
              </button>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Import Preview</h3>
            
            {preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="font-medium text-green-800">Valid Records</div>
                    <div className="text-2xl font-bold text-green-600">
                      {preview.valid.length}
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <div className="font-medium text-yellow-800">Duplicates (Updates)</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {preview.duplicates.length}
                    </div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="font-medium text-red-800">Invalid Records</div>
                    <div className="text-2xl font-bold text-red-600">
                      {preview.invalid.length}
                    </div>
                  </div>
                </div>

                {preview.invalid.length > 0 && (
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2">Invalid Records:</h4>
                    <div className="text-sm space-y-2 max-h-32 overflow-y-auto">
                      {preview.invalid.slice(0, 5).map((invalid, index) => (
                        <div key={index} className="text-red-700">
                          <strong>{invalid.row.name || `Row ${index + 2}`}:</strong>{' '}
                          {invalid.errors.join(', ')}
                        </div>
                      ))}
                      {preview.invalid.length > 5 && (
                        <div className="text-red-600 italic">
                          ... and {preview.invalid.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep('mapping')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Back to Mapping
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={preview.valid.length + preview.duplicates.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Import {preview.valid.length + preview.duplicates.length} Records
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 'importing':
        return (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium mb-2">Importing Employees...</h3>
            <p className="text-gray-600">Please wait while we process your data</p>
          </div>
        );

      case 'complete':
        return (
          <div className="p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Import Complete!</h3>
            
            {importResults && (
              <div className="text-sm text-gray-600 mb-6">
                <p><strong>{importResults.created}</strong> employees created</p>
                <p><strong>{importResults.updated}</strong> employees updated</p>
                {importResults.errors > 0 && (
                  <p className="text-red-600">
                    <strong>{importResults.errors}</strong> errors occurred
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => {
                onImportComplete();
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Import Employees</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
}