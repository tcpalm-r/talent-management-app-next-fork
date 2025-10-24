import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  Building2,
  MapPin,
  User,
  ArrowRight,
  Wand2,
  UserCircle,
} from 'lucide-react';
import type { Employee, EmployeePlan } from '../types';
import type { PerformanceReview } from './PerformanceReviewModal';
import { calculatePlanProgress, getOverdueActionItems } from '../lib/actionItemGenerator';
import { EmployeeNameLink } from './unified';

interface AIHelperRibbonProps {
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelectedEmployeeChange: (employeeId: string | null) => void;
  onLaunchReviewParser: () => void;
  onLaunchDraftReview: () => void;
  onLaunchPlanWizard: (template?: string) => void;
  employeePlans: Record<string, EmployeePlan>;
  performanceReviews: Record<string, { self?: PerformanceReview; manager?: PerformanceReview }>;
  watchlistIds: Set<string>;
  currentUserName?: string | null;
}

const PLAN_TEMPLATE_OPTIONS: Array<{ id: 'onboarding' | 'performance' | 'retention'; label: string; description: string }> = [
  { id: 'onboarding', label: 'Onboarding', description: '90-day ramp, buddy touches, culture acclimation.' },
  { id: 'performance', label: 'Performance', description: 'Coaching cadence, skill reps, accountability.' },
  { id: 'retention', label: 'Retention', description: 'Stay interviews, growth moves, recognition moments.' },
];

const STORAGE_KEYS = {
  lastGroup: 'ai-helper-last-group',
  recent: 'ai-helper-recent',
};

function loadArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function storeArray(key: string, value: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(iso?: string) {
  if (!iso) return 'Not yet';
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AIHelperRibbon({
  employees,
  selectedEmployeeId,
  onSelectedEmployeeChange,
  onLaunchReviewParser,
  onLaunchDraftReview,
  onLaunchPlanWizard,
  employeePlans,
  performanceReviews,
  watchlistIds,
  currentUserName,
}: AIHelperRibbonProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'onboarding' | 'performance' | 'retention'>('performance');
  const [lastGroupKey, setLastGroupKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.lastGroup);
  });
  const [recentIds, setRecentIds] = useState<string[]>(() => loadArray(STORAGE_KEYS.recent));

  const selectedEmployee = useMemo(() => employees.find(emp => emp.id === selectedEmployeeId) ?? null, [employees, selectedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployeeId) return;

    setRecentIds(prev => {
      const next = [selectedEmployeeId, ...prev.filter(id => id !== selectedEmployeeId)].slice(0, 5);
      storeArray(STORAGE_KEYS.recent, next);
      return next;
    });
  }, [selectedEmployeeId]);

  const directReports = useMemo(() => {
    if (!currentUserName) return [];
    return employees.filter(emp => emp.manager_name && emp.manager_name.toLowerCase() === currentUserName.toLowerCase());
  }, [employees, currentUserName]);

  const locationGroupedEmployees = useMemo(() => {
    const map = new Map<string, { label: string; employees: Employee[] }>();

    employees.forEach(emp => {
      const department = emp.department?.name ?? 'Unassigned';
      const location = emp.location ?? 'Location TBD';
      const key = `${department}||${location}`;
      const label = `${department} • ${location}`;

      if (!map.has(key)) {
        map.set(key, { label, employees: [] });
      }
      map.get(key)!.employees.push(emp);
    });

    return Array.from(map.entries()).map(([key, group]) => ({
      key,
      label: group.label,
      employees: group.employees.sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [employees]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return employees
      .filter(emp => {
        const haystack = [emp.name, emp.title ?? '', emp.department?.name ?? '', emp.location ?? ''].join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, normalizedSearch]);

  const recentlyViewedEmployees = recentIds
    .map(id => employees.find(emp => emp.id === id))
    .filter((emp): emp is Employee => Boolean(emp));

  const selectedPlan = selectedEmployee ? employeePlans[selectedEmployee.id] : undefined;
  const planProgress = selectedPlan ? calculatePlanProgress(selectedPlan.action_items || []) : null;
  const overdueActions = selectedPlan ? getOverdueActionItems(selectedPlan.action_items || []).length : 0;

  const planStatus = useMemo(() => {
    if (!selectedPlan) return 'No plan yet';
    if (selectedPlan.status === 'completed') return 'Plan completed';
    if (overdueActions > 0) return 'Needs check-in';
    if (planProgress !== null && planProgress >= 75) return 'On track';
    return 'In progress';
  }, [selectedPlan, overdueActions, planProgress]);

  const lastCheckInDate = selectedPlan?.last_reviewed || selectedPlan?.updated_at;
  const buddyName = (selectedPlan as any)?.buddy_name ?? 'Assign buddy';

  const reviewRecord = selectedEmployee ? performanceReviews[selectedEmployee.id] : undefined;
  const managerPending = Boolean(selectedEmployee && (!reviewRecord?.manager || reviewRecord.manager.status !== 'completed'));
  const selfPending = Boolean(selectedEmployee && (!reviewRecord?.self || (reviewRecord.self.status !== 'completed' && reviewRecord.self.status !== 'submitted')));

  const aiFlags = useMemo(() => {
    const flags: string[] = [];
    if (selectedEmployee) {
      if (watchlistIds.has(selectedEmployee.id)) flags.push('Watchlist signal');
      if (!selectedPlan) flags.push('No plan yet');
      if (managerPending) flags.push('Manager review pending');
      if (selfPending) flags.push('Self review pending');
    }
    return flags;
  }, [selectedEmployee, selectedPlan, managerPending, selfPending, watchlistIds]);

  const phaseHint = useMemo(() => {
    if (!selectedPlan) return 'Foundation';
    if (planProgress !== null) {
      if (planProgress < 35) return 'Foundation';
      if (planProgress < 70) return 'Integration';
      return 'Impact';
    }
    return 'Foundation';
  }, [selectedPlan, planProgress]);

  const handleSelectEmployee = useCallback((employee: Employee) => {
    onSelectedEmployeeChange(employee.id);
    setSearchTerm('');
    const group = locationGroupedEmployees.find(group => group.employees.some(emp => emp.id === employee.id));
    if (group) {
      setLastGroupKey(group.key);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.lastGroup, group.key);
      }
    }
  }, [locationGroupedEmployees, onSelectedEmployeeChange]);

  const handlePlanTemplateChange = (template: 'onboarding' | 'performance' | 'retention') => {
    setSelectedTemplate(template);
  };

  const handlePlanWizardLaunch = () => {
    onLaunchPlanWizard(selectedTemplate);
  };

  const lastGroupFromStorage = lastGroupKey;

  return (
    <section className="mb-6" id="ai-assist-center">
      <div className="surface-card space-y-6 p-5">
        <header className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            AI Assist Center
          </h3>
          <p className="text-sm text-slate-500 max-w-2xl">
            Pick a teammate, see their context, and launch the right assistant without leaving your flow.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, team, or location"
                  className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div className="max-h-72 space-y-4 overflow-y-auto px-4 py-3 text-sm">
                {normalizedSearch ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Search results</p>
                    {searchResults.length === 0 ? (
                      <p className="text-xs text-slate-400">No matches found.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {searchResults.map((employee) => (
                          <SelectorRow
                            key={employee.id}
                            employee={employee}
                            isActive={selectedEmployeeId === employee.id}
                            onSelect={handleSelectEmployee}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <>
                    {recentlyViewedEmployees.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recently viewed</p>
                        <ul className="space-y-1.5">
                          {recentlyViewedEmployees.map((employee) => (
                            <SelectorRow
                              key={employee.id}
                              employee={employee}
                              isActive={selectedEmployeeId === employee.id}
                              onSelect={handleSelectEmployee}
                            />
                          ))}
                        </ul>
                      </div>
                    )}

                    {directReports.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">My direct reports</p>
                        <ul className="space-y-1.5">
                          {directReports.map((employee) => (
                            <SelectorRow
                              key={employee.id}
                              employee={employee}
                              isActive={selectedEmployeeId === employee.id}
                              onSelect={handleSelectEmployee}
                            />
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      {locationGroupedEmployees.map((group) => {
                        const isDefaultOpen = selectedEmployee ? group.employees.some(emp => emp.id === selectedEmployee.id) : group.key === lastGroupFromStorage;
                        return (
                          <details key={group.key} className="rounded-lg border border-slate-100 bg-slate-50" open={isDefaultOpen}>
                            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {group.label}
                            </summary>
                            <ul className="space-y-1.5 px-3 pb-3">
                              {group.employees.map((employee) => (
                                <SelectorRow
                                  key={employee.id}
                                  employee={employee}
                                  isActive={selectedEmployeeId === employee.id}
                                  onSelect={handleSelectEmployee}
                                />
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <aside className="w-full space-y-3 lg:w-80">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              {selectedEmployee ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-8 w-8 text-indigo-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.name}</p>
                      {selectedEmployee.title && (
                        <p className="text-xs text-slate-500">{selectedEmployee.title}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <ContextChip icon={Building2} label="Dept" value={selectedEmployee.department?.name ?? 'Unassigned'} />
                    <ContextChip icon={MapPin} label="Location" value={selectedEmployee.location ?? 'TBD'} />
                    <ContextChip icon={User} label="Manager" value={selectedEmployee.manager_name ?? 'Assign manager'} />
                    <ContextChip icon={UserCircle} label="Buddy" value={buddyName} />
                    <ContextChip icon={Sparkles} label="Phase" value={phaseHint} />
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Plan status</p>
                    <p className="mt-1 text-slate-600">{planStatus}</p>
                    <div className="mt-2 flex items-center gap-3 text-slate-500">
                      <span>Progress {planProgress !== null ? `${planProgress}%` : 'N/A'}</span>
                      <span>Last check-in {formatDate(lastCheckInDate)}</span>
                    </div>
                  </div>

                  {aiFlags.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-rose-600">AI flags</p>
                      <ul className="list-disc pl-5 text-xs text-slate-600">
                        {aiFlags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a teammate to unlock AI shortcuts.</p>
              )}
            </div>
          </aside>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ActionCard
            title="Create from manager write-up"
            description="Paste a manager draft. We’ll match the person, place them on the 9-box, generate a review draft, and suggest a starter plan."
            onPrimary={onLaunchReviewParser}
            primaryLabel="Start import"
          >
            <ol className="space-y-2 text-xs text-slate-600">
              {[
                'Match employee to review context',
                'Place in 9-box and draft review',
                'Suggest starter plan objectives',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
                  <span>{index + 1}. {step}</span>
                </li>
              ))}
            </ol>
          </ActionCard>

          <ActionCard
            title="Generate a manager review"
            description="Drop quick notes, wins, and risks. AI will draft a balanced manager review with evidence." 
            onPrimary={onLaunchDraftReview}
            primaryLabel="Draft review"
          >
            <ul className="space-y-1.5 text-xs text-slate-600">
              {[
                'Top wins this cycle',
                'Growth edge or blocker',
                'Support the team needs',
                'Customer or partner feedback',
                'Next-cycle stretch goal',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-3 w-3 text-indigo-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </ActionCard>

          <ActionCard
            title="Generate SMART plan"
            description="Pick the template and we’ll propose objectives, cadence, and owners—ready to edit before you create."
            onPrimary={handlePlanWizardLaunch}
            primaryLabel="Build plan"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {PLAN_TEMPLATE_OPTIONS.map((option) => {
                  const isActive = selectedTemplate === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handlePlanTemplateChange(option.id)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                {PLAN_TEMPLATE_OPTIONS.find(option => option.id === selectedTemplate)?.description}
              </p>
            </div>
          </ActionCard>
        </div>
      </div>
    </section>
  );
}

function SelectorRow({ employee, isActive, onSelect }: { employee: Employee; isActive: boolean; onSelect: (employee: Employee) => void }) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(employee);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(employee)}
      onKeyDown={handleKeyDown}
      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${
        isActive ? 'bg-indigo-50 text-indigo-700 shadow-inner ring-1 ring-indigo-200' : 'hover:bg-slate-100'
      }`}
    >
      <span className="truncate">
        <EmployeeNameLink
          employee={employee}
          className="truncate text-left text-sm font-semibold text-slate-900 hover:text-blue-600 focus-visible:ring-blue-500"
          onClick={(event) => event.stopPropagation()}
        >
          {employee.name}
        </EmployeeNameLink>
        {employee.title && <span className="ml-1 text-xs text-slate-500">· {employee.title}</span>}
      </span>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect(employee);
        }}
        className={`rounded-full p-1 transition ${
          isActive ? 'text-indigo-500 hover:bg-indigo-100' : 'text-slate-300 hover:bg-slate-200 hover:text-slate-500'
        }`}
        aria-label={`Focus on ${employee.name}`}
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ContextChip({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
      <Icon className="h-3 w-3 text-slate-400" />
      {label}: {value}
    </span>
  );
}

function ActionCard({
  title,
  description,
  children,
  onPrimary,
  primaryLabel,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onPrimary: () => void;
  primaryLabel: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <div>{children}</div>
      </div>
      <button
        type="button"
        onClick={onPrimary}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
      >
        <Wand2 className="h-3.5 w-3.5" />
        {primaryLabel}
      </button>
    </div>
  );
}
