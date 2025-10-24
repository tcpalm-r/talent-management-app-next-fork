import { X, Pin, ExternalLink, GitCompare, Sparkles } from 'lucide-react';
import { useEmployeeFocus } from '../context/EmployeeFocusContext';
import { useQuickAction } from '../context/QuickActionContext';
import { EmployeeNameLink } from './unified';

export function EmployeeContextBar() {
  const { focusedEmployees, unpinEmployee, clearAll, compareMode, setCompareMode } = useEmployeeFocus();
  const { executeAction } = useQuickAction();

  if (focusedEmployees.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-b border-gray-200 shadow-sm">
      <div className="max-w-[1800px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left side: Focused employees */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Pin className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Focused ({focusedEmployees.length})
              </span>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {focusedEmployees.map((focused) => (
                <div
                  key={focused.employee.id}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-300 shadow-sm hover:shadow-md transition-all flex-shrink-0"
                >
                  {/* Mini avatar */}
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shadow-inner">
                    {focused.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  
                  {/* Name and title */}
                  <div className="flex flex-col min-w-0">
                    <EmployeeNameLink
                      employee={focused.employee}
                      className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 focus-visible:ring-blue-500"
                      onClick={(event) => event.stopPropagation()}
                    />
                    {focused.employee.title && (
                      <span className="text-xs text-gray-500 truncate">
                        {focused.employee.title}
                      </span>
                    )}
                  </div>
                  
                  {/* Quick actions */}
                  <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => executeAction({
                        type: 'open-employee-detail',
                        employeeId: focused.employee.id,
                      })}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Open details"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => unpinEmployee(focused.employee.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Unpin"
                    >
                      <X className="w-3.5 h-3.5 text-gray-600 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right side: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {/* Compare mode toggle (2+ employees) */}
            {focusedEmployees.length >= 2 && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-full transition-all ${
                  compareMode
                    ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 shadow-sm'
                }`}
              >
                <GitCompare className="w-4 h-4" />
                Compare {focusedEmployees.length}
              </button>
            )}
            
            {/* AI suggestions */}
            {focusedEmployees.length > 0 && (
              <button
                onClick={() => {
                  // This will trigger AI suggestions for focused employees
                  console.log('AI suggestions for:', focusedEmployees.map(f => f.employee.name));
                }}
                className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full hover:from-purple-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                AI Insights
              </button>
            )}
            
            {/* Clear all */}
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded-full transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
        
        {/* Compare mode active indicator */}
        {compareMode && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-blue-700">
              <GitCompare className="w-3.5 h-3.5" />
              <span className="font-medium">
                Comparison mode active - viewing {focusedEmployees.length} employees side-by-side
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
