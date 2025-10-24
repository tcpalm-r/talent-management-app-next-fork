import { useMemo } from 'react';
import { isModuleEnabled, areDependenciesMet, getModule, type ModuleKey } from '../config/modules';

/**
 * Hook to check if a module is enabled
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const isEnabled = useModule('360_feedback');
 *   
 *   if (!isEnabled) return null;
 *   
 *   return <Feedback360Dashboard />;
 * }
 * ```
 */
export function useModule(key: ModuleKey): boolean {
  return useMemo(() => {
    const enabled = isModuleEnabled(key);
    const depsMet = areDependenciesMet(key);
    return enabled && depsMet;
  }, [key]);
}

/**
 * Hook to get module configuration
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const module = useModuleConfig('ai_insights');
 *   
 *   return (
 *     <div>
 *       <h2>{module?.name}</h2>
 *       {module?.beta && <span>Beta</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useModuleConfig(key: ModuleKey) {
  return useMemo(() => getModule(key), [key]);
}

/**
 * Hook to check multiple modules at once
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const modules = useModules(['nine_box', 'calibration', 'performance_reviews']);
 *   
 *   // Returns: { nine_box: true, calibration: true, performance_reviews: false }
 *   return <div>9-Box is {modules.nine_box ? 'enabled' : 'disabled'}</div>;
 * }
 * ```
 */
export function useModules(keys: ModuleKey[]): Record<ModuleKey, boolean> {
  return useMemo(() => {
    const result: Partial<Record<ModuleKey, boolean>> = {};
    keys.forEach(key => {
      result[key] = isModuleEnabled(key) && areDependenciesMet(key);
    });
    return result as Record<ModuleKey, boolean>;
  }, [keys]);
}

