import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, Sparkles, FileText, List, Tag as TagIcon, Award } from 'lucide-react';
import type { Employee, Skill, JobDescriptionTemplate } from '../types';
import { supabase } from '../lib/supabase';
import { getSkills } from '../lib/skillsLibrary';
import SkillsAutocomplete from './SkillsAutocomplete';
import { useToast, EmployeeNameLink } from './unified';

interface JobDescriptionEditorProps {
  employee: Employee;
  onSave: (updates: Partial<Employee>) => Promise<void>;
  onCancel: () => void;
}

export default function JobDescriptionEditor({
  employee,
  onSave,
  onCancel,
}: JobDescriptionEditorProps) {
  const { notify } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form state
  const [jobDescription, setJobDescription] = useState(employee.job_description || '');
  const [keyResponsibilities, setKeyResponsibilities] = useState<string[]>(employee.key_responsibilities || []);
  const [requiredSkills, setRequiredSkills] = useState<string[]>(employee.required_skills || []);
  const [preferredQualifications, setPreferredQualifications] = useState(employee.preferred_qualifications || '');
  const [newResponsibility, setNewResponsibility] = useState('');
  
  // Data
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [templates, setTemplates] = useState<JobDescriptionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [employee.organization_id]);

  const loadData = async () => {
    // Load skills
    const skills = await getSkills(employee.organization_id);
    setAvailableSkills(skills);

    // Load templates
    const { data: templatesData } = await supabase
      .from('job_description_templates')
      .select('*')
      .or(`organization_id.eq.${employee.organization_id},is_system_template.eq.true`)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (templatesData) {
      setTemplates(templatesData);
    }
  };

  const handleApplyTemplate = () => {
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    setJobDescription(template.description_template);
    setKeyResponsibilities(template.responsibilities_template);
    setRequiredSkills(template.required_skills_template);
    setPreferredQualifications(template.preferred_qualifications_template || '');

    notify({
      type: 'success',
      title: 'Template Applied',
      message: `Loaded ${template.title} template. Customize as needed.`,
    });
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // Generate job description based on title and department
      const prompt = `Generate a professional job description for a ${employee.title} in ${employee.department?.name || 'the organization'}`;
      
      // For now, create a structured template based on the title
      // In production, this would call your AI service
      const generated = generateJobDescriptionFromTitle(employee.title || '', employee.department?.name);
      
      setJobDescription(generated.description);
      setKeyResponsibilities(generated.responsibilities);
      setRequiredSkills(generated.skills);
      setPreferredQualifications(generated.preferred);

      notify({
        type: 'success',
        title: 'AI Generated',
        message: 'Job description generated. Review and customize as needed.',
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Generation Failed',
        message: 'Could not generate job description. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddResponsibility = () => {
    if (!newResponsibility.trim()) return;
    
    setKeyResponsibilities([...keyResponsibilities, newResponsibility.trim()]);
    setNewResponsibility('');
  };

  const handleRemoveResponsibility = (index: number) => {
    setKeyResponsibilities(keyResponsibilities.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await onSave({
        job_description: jobDescription.trim() || null,
        key_responsibilities: keyResponsibilities.length > 0 ? keyResponsibilities : null,
        required_skills: requiredSkills.length > 0 ? requiredSkills : null,
        preferred_qualifications: preferredQualifications.trim() || null,
      });

      notify({
        type: 'success',
        title: 'Job Description Saved',
        message: `Updated job description for ${employee.name}`,
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Could not save job description',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Edit Job Description</h3>
          <p className="text-sm text-gray-600 mt-1">
            Define role responsibilities, required skills, and qualifications for{' '}
            <EmployeeNameLink
              employee={employee}
              className="font-semibold text-blue-600 hover:text-blue-700 focus-visible:ring-blue-500"
            />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Template Selector */}
        <div className="flex-1">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Choose from template library...</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.title} {template.is_system_template ? '(Built-in)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleApplyTemplate}
          disabled={!selectedTemplate}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Apply Template
        </button>

        <button
          onClick={handleAIGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI Generate
            </>
          )}
        </button>
      </div>

      {/* Job Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Job Description
        </label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans text-sm"
          placeholder="Describe the overall purpose and scope of this role..."
        />
      </div>

      {/* Key Responsibilities */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <List className="w-4 h-4" />
          Key Responsibilities
        </label>
        
        <div className="space-y-2 mb-3">
          {keyResponsibilities.map((resp, index) => (
            <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 group">
              <span className="text-gray-600 font-medium flex-shrink-0">{index + 1}.</span>
              <p className="flex-1 text-sm text-gray-900">{resp}</p>
              <button
                onClick={() => handleRemoveResponsibility(index)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newResponsibility}
            onChange={(e) => setNewResponsibility(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddResponsibility();
              }
            }}
            placeholder="Add a key responsibility..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleAddResponsibility}
            disabled={!newResponsibility.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Required Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <TagIcon className="w-4 h-4" />
          Required Skills
        </label>
        <SkillsAutocomplete
          organizationId={employee.organization_id}
          selectedSkills={requiredSkills}
          onChange={setRequiredSkills}
          availableSkills={availableSkills}
          placeholder="Search and add required skills..."
        />
      </div>

      {/* Preferred Qualifications */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Award className="w-4 h-4" />
          Preferred Qualifications
        </label>
        <textarea
          value={preferredQualifications}
          onChange={(e) => setPreferredQualifications(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans text-sm"
          placeholder="List nice-to-have qualifications, certifications, or experience..."
        />
      </div>

      {/* Preview */}
      {(jobDescription || keyResponsibilities.length > 0 || requiredSkills.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-900 mb-2">Preview</div>
          <div className="text-xs text-blue-800">
            {jobDescription && <div className="mb-2">{jobDescription.slice(0, 150)}...</div>}
            {keyResponsibilities.length > 0 && (
              <div>{keyResponsibilities.length} responsibilities defined</div>
            )}
            {requiredSkills.length > 0 && (
              <div>{requiredSkills.length} skills required</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AI-powered job description generation (placeholder)
 * In production, this would call your anthropicService
 */
function generateJobDescriptionFromTitle(title: string, department?: string): {
  description: string;
  responsibilities: string[];
  skills: string[];
  preferred: string;
} {
  const titleLower = title.toLowerCase();

  // Engineering roles
  if (titleLower.includes('engineer') || titleLower.includes('developer')) {
    return {
      description: `Design, develop, and maintain high-quality software applications. Collaborate with cross-functional teams to deliver features that delight customers and drive business value.`,
      responsibilities: [
        'Write clean, maintainable, and well-tested code',
        'Participate in code reviews and provide constructive feedback',
        'Debug and resolve technical issues efficiently',
        'Collaborate with product and design teams on feature development',
        'Contribute to technical documentation and knowledge sharing',
      ],
      skills: ['JavaScript', 'TypeScript', 'React', 'Problem Solving', 'Collaboration'],
      preferred: 'Bachelor\'s degree in Computer Science or related field, 2+ years of professional software development experience',
    };
  }

  // Manager roles
  if (titleLower.includes('manager')) {
    return {
      description: `Lead and develop a high-performing team to achieve organizational goals. Balance strategic planning with tactical execution while fostering a culture of excellence and continuous improvement.`,
      responsibilities: [
        'Hire, onboard, and develop top talent',
        'Set clear goals and track team performance',
        'Conduct regular 1:1s and performance reviews',
        'Remove blockers and enable team success',
        'Collaborate with cross-functional partners',
        'Drive process improvements and best practices',
      ],
      skills: ['Leadership', 'Communication', 'Project Management', 'Problem Solving', 'Collaboration'],
      preferred: '3+ years of people management experience, proven track record of building high-performing teams',
    };
  }

  // Product roles
  if (titleLower.includes('product')) {
    return {
      description: `Define product vision and strategy while driving execution. Work with engineering, design, and stakeholders to deliver products that customers love and achieve business objectives.`,
      responsibilities: [
        'Define product vision, strategy, and roadmap',
        'Gather and prioritize customer requirements',
        'Collaborate with engineering and design teams',
        'Analyze metrics and user feedback to inform decisions',
        'Present product updates to stakeholders and leadership',
        'Champion customer needs throughout the organization',
      ],
      skills: ['Product Strategy', 'Communication', 'Data Analysis', 'Problem Solving', 'Agile/Scrum'],
      preferred: '3+ years of product management experience, strong analytical and communication skills',
    };
  }

  // Default for other roles
  return {
    description: `${title} responsible for contributing to ${department || 'organizational'} success through excellent execution and collaboration.`,
    responsibilities: [
      'Execute on key responsibilities aligned with team goals',
      'Collaborate effectively with team members and stakeholders',
      'Continuously learn and improve professional skills',
      'Contribute to a positive and productive team culture',
    ],
    skills: ['Communication', 'Collaboration', 'Problem Solving'],
    preferred: 'Relevant experience in the field, strong work ethic and growth mindset',
  };
}
