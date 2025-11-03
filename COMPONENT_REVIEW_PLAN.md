# Component Review Planning Guide

## Quick Start

Two comprehensive analysis documents have been created:

1. **COMPONENT_ANALYSIS.md** - Detailed technical analysis (10 sections, 500+ lines)
   - Complete component inventory with line counts
   - Dependency analysis and data flow patterns
   - Refactoring opportunities
   - Recommended review sequence

2. **COMPONENT_QUICK_REFERENCE.txt** - Quick lookup guide (200+ lines)
   - Component statistics and distribution
   - Feature area grouping
   - Component interaction map
   - Key insights at a glance

---

## Component Overview at a Glance

```
TOTAL: 27 Components | ~14,458 Lines of Code | 5 Feature Areas
```

### By Directory
- **Root (19)** - Feature components and main app logic
- **unified/ (8)** - Design system and reusable patterns
- **admin/ (0)** - Admin components in /app/ routes

### By Size
- **Large (>1500 LOC)**: 4 components (44% of code)
- **Medium (500-1500)**: 7 components (35% of code)
- **Small (<500 LOC)**: 16 components (21% of code)

---

## The 4 Largest Components (Critical Review)

These four components represent 44% of the codebase and require careful review:

### 1. Feedback360Dashboard (2,584 lines)
**Purpose**: 360-degree feedback survey hub
**Features**:
- Survey list with filtering and search
- Survey creation/editing
- Response tracking and analytics
- Report export
- AI-assisted survey analysis

**Nested Components**: Survey360Wizard, Quick360Modal, CreateWithAIModal
**Dependencies**: supabase, exportReport utilities
**Review Focus**: 
- Consider splitting by tab (List, Create, Analytics)
- Event handling complexity
- State management patterns

### 2. OneOnOneModal (2,101 lines)
**Purpose**: One-on-one meeting management system
**Features**:
- Meeting scheduling and management
- Agenda item tracking
- Shared and private notes
- Transcript import and storage
- AI-powered meeting summaries
- Custom meeting templates

**Nested Components**: Meeting form, agenda section, notes section, transcript viewer
**Dependencies**: anthropicService, transcriptImporter
**Review Focus**:
- Modal state management
- Form validation
- AI integration implementation
- Transcript processing

### 3. EmployeeDetailModal (1,834 lines)
**Purpose**: Comprehensive employee profile modal
**Features**:
- 9 navigation panels (Overview, Performance, Development, Notes, Advanced)
- Multiple sub-modals (OneOnOne, RetentionPlan, CriticalRole, Survey)
- Performance analysis and action items
- Manager notes display
- AI coaching suggestions

**Nested Components**: 5+ child modals
**Dependencies**: Multiple service imports, AICoachMicroPanel
**Review Focus**:
- Modal composition pattern
- Navigation between sub-panels
- Context usage for suggestions
- Data fetching and state sync

### 4. Survey360Wizard (1,611 lines)
**Purpose**: Step-by-step survey creation wizard
**Features**:
- Employee selection
- Question selection with categorization
- Reviewer management and invitation
- Survey settings (due date, etc.)
- Draft management
- AI-assisted creation option

**Nested Components**: CreateWithAIModal integration
**Dependencies**: supabase, QUESTION_LIBRARY, email service
**Review Focus**:
- Step validation and flow
- Question library integration
- Reviewer assignment logic
- Data persistence

---

## Feature Area Coverage

### 1. 360° Feedback System (5 components)
**Components**: Feedback360Dashboard, Survey360Wizard, Quick360Modal, CreateWithAIModal, SurveyAIAssistant

**Workflow**:
1. User launches Feedback360Dashboard
2. Creates survey via:
   - Survey360Wizard (full step-by-step)
   - Quick360Modal (shortcut)
   - CreateWithAIModal (AI-generated)
3. System sends email invitations
4. Reviewers respond (possibly assisted by SurveyAIAssistant)
5. Results displayed and analyzed

**Review Priorities**:
- [ ] Survey creation flows are consistent
- [ ] Email invitation system works
- [ ] AI generation quality
- [ ] Analytics calculations accurate

---

### 2. Employee Management (4 components + design system)
**Components**: PeopleDashboard, EmployeeList, EmployeeDetailModal, EmployeeCardUnified

**Workflow**:
1. User navigates to Talent (PeopleDashboard)
2. Searches/filters employees (EmployeeList)
3. Clicks card preview (EmployeeCardUnified in 4 variants)
4. Opens full profile (EmployeeDetailModal with 9 panels)

**Review Priorities**:
- [ ] Search and filter performance
- [ ] Card variant consistency
- [ ] Modal responsiveness
- [ ] Data freshness and caching

---

### 3. Performance & Development (4 nested modals)
**Components**: OneOnOneModal, RetentionPlanModal, CriticalRoleSetupModal, + EmployeeDetailModal sub-panels

**Features**:
- **OneOnOneModal**: Meeting management with transcripts and AI summaries
- **RetentionPlanModal**: Stay interviews and retention strategies
- **CriticalRoleSetupModal**: Succession planning
- **EmployeeDetailModal Performance Panel**: Performance reviews and assessments

**Review Priorities**:
- [ ] Modal nesting doesn't create UX issues
- [ ] Data persists correctly across modals
- [ ] AI integrations work reliably
- [ ] No duplicate data handling

---

### 4. Admin & Configuration (2 components)
**Components**: AdminSettings, Dashboard (admin view)

**Features**:
- Employee search and inline editing
- Role assignment (Admin/Leader/User)
- 360 default questions configuration
- Question library management
- Custom question creation

**Review Priorities**:
- [ ] Permissions enforcement
- [ ] Data validation on edits
- [ ] Question library completeness
- [ ] Settings persistence

---

### 5. Design System & Unified Components (7 in unified/)
**Components**: EmployeeCardUnified, BadgeSystem, NavigationTabs, ModalLayout, EmptyState, StatCard, EmployeeNameLink

**Consistency Checks**:
- [ ] Badge variants consistent across app
- [ ] Card layouts work in all contexts
- [ ] Modal sizes appropriate
- [ ] Empty states informative

---

## Dependency Analysis

### Hub Components (High Centrality)
These components are imported by many others:

1. **EmployeeDetailModal** ← EmployeeList
   - Central hub for all employee workflows
   - Contains 5+ nested modals

2. **Dashboard** ← Main app layout
   - Router component
   - Orchestrates all views

3. **Feedback360Dashboard** ← Dashboard
   - 360 feature hub
   - Composes wizard and modals

4. **EmployeeCardUnified** ← Used throughout
   - Reusable card pattern
   - 4 layout variants

### Universal Primitives
These are everywhere:

- **EmployeeNameLink** - 9+ components use it
- **BadgeSystem** - 8+ components use it
- **useToast** - Throughout app via unified/index.ts

---

## Recommended Review Phases

### Phase 1: Design System Foundation (2-3 days)
**Goal**: Verify consistency and reusability

1. unified/BadgeSystem.tsx
   - All 8 badge types present and consistent
   - Color/style conventions followed
   - Usage throughout app

2. unified/ModalLayout.tsx
   - Sizing logic correct (sm/md/lg/xl/full)
   - Accessibility features present
   - Header/footer rendering

3. unified/EmployeeCardUnified.tsx
   - All 4 variants work correctly
   - Drag-drop implementation clean
   - Props interface sensible

**Checklist**:
- [ ] No duplicate badge types
- [ ] Modal sizes responsive
- [ ] Card variants accessible
- [ ] No prop drilling issues

---

### Phase 2: Navigation & Routing (1-2 days)
**Goal**: Verify app structure and user flows

4. Dashboard.tsx
   - View routing logic clean
   - State management patterns
   - Prop passing structure

5. Sidebar.tsx
   - Role-based menu items correct
   - Navigation triggers work
   - Accessibility

6. TopHeader.tsx
   - User menu functions
   - Role switcher works
   - Avatar displays correctly

**Checklist**:
- [ ] Navigation works in all scenarios
- [ ] Role-based visibility correct
- [ ] No navigation dead-ends
- [ ] Mobile responsiveness

---

### Phase 3: Employee Management (3-4 days)
**Goal**: Verify employee CRUD and discovery workflows

7. PeopleDashboard.tsx
   - Container structure correct
   - Props passed efficiently

8. EmployeeList.tsx
   - Search functionality works
   - Filtering by department
   - Sorting options
   - Inline actions

9. EmployeeDetailModal.tsx (COMPLEX - Reserve most time)
   - All 9 sub-panels accessible
   - Data loading patterns
   - Modal nesting usability
   - AI coach integration
   - Performance review linking
   - Note management

**Checklist**:
- [ ] Search returns correct results
- [ ] Filters work in combination
- [ ] Modal opens/closes cleanly
- [ ] Data updates propagate
- [ ] No memory leaks

---

### Phase 4: 360 Feedback (3-4 days)
**Goal**: Verify survey creation and management workflows

10. Feedback360Dashboard.tsx (COMPLEX)
    - Survey list displays correctly
    - Status filters work
    - Export functionality
    - Analytics calculations
    - AI analysis integration

11. Survey360Wizard.tsx
    - Step validation works
    - Question selection logic
    - Reviewer assignment
    - Draft management
    - Email sending

12. Quick360Modal.tsx & CreateWithAIModal.tsx
    - Quick path works
    - AI generation quality
    - Form validation

**Checklist**:
- [ ] Surveys persist correctly
- [ ] Email invitations sent
- [ ] Response tracking accurate
- [ ] Analytics make sense
- [ ] Draft recovery works

---

### Phase 5: HR Workflows (2-3 days)
**Goal**: Verify complex HR features

13. OneOnOneModal.tsx (COMPLEX)
    - Meeting creation/editing
    - Agenda management
    - Notes visibility
    - Transcript handling
    - AI summary generation

14. RetentionPlanModal.tsx
    - Plan creation
    - Note management
    - Strategy tracking

15. CriticalRoleSetupModal.tsx
    - Role backup assignment
    - Successor tracking
    - Development timeline

**Checklist**:
- [ ] Meeting state persists
- [ ] Transcripts import correctly
- [ ] Notes are private/shared as intended
- [ ] AI summaries useful
- [ ] Retention plans tracked

---

### Phase 6: Admin & AI (1-2 days)
**Goal**: Verify admin features and AI integrations

16. AdminSettings.tsx
    - Employee search works
    - Inline editing saves
    - Role changes propagate
    - Question configuration persists
    - Custom questions work

17. AICoachMicroPanel.tsx & CreateWithAIModal.tsx
    - Suggestions appear contextually
    - Speech-to-text works (if present)
    - AI generation quality

**Checklist**:
- [ ] Permissions enforced
- [ ] No data corruption
- [ ] AI integrations reliable
- [ ] Error handling clear

---

## Code Quality Checklist

### For Each Component Review

**Structure**:
- [ ] Clear component responsibility
- [ ] Props interface documented
- [ ] State management patterns consistent
- [ ] Effects properly cleaned up

**Performance**:
- [ ] No unnecessary re-renders
- [ ] Memoization used where needed
- [ ] Large lists virtualized if needed
- [ ] Images optimized

**Accessibility**:
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] Color contrast sufficient
- [ ] Screen reader friendly

**Error Handling**:
- [ ] Try-catch blocks present
- [ ] Error states displayed
- [ ] User feedback clear
- [ ] Logging adequate

**TypeScript**:
- [ ] No `any` types (except justified)
- [ ] Props interfaces complete
- [ ] Return types specified
- [ ] Type safety throughout

**Testing**:
- [ ] Unit tests present
- [ ] Integration scenarios covered
- [ ] Edge cases handled
- [ ] Loading states tested

---

## Known Issues & Improvement Opportunities

### Code Size
- Top 4 components are 1,600+ lines each
- **Recommendation**: Decompose into sub-components
- **Example**: EmployeeDetailModal → separate panel files

### State Management
- Multiple context providers (3+ custom contexts)
- Props drilling in some areas (10+ props)
- **Recommendation**: Consider unified AppState pattern

### Testing
- No test files found (jest.config.js unused)
- **Recommendation**: 
  - Start with unified/ components
  - Add snapshot tests
  - Add integration tests for workflows

### Documentation
- Limited JSDoc comments
- **Recommendation**:
  - Add prop documentation
  - Create interaction diagrams
  - Document data flows

### Modal Architecture
- EmployeeDetailModal contains 5+ nested modals
- **Recommendation**: Consider modal router pattern

---

## Metrics to Track During Review

For each component, note:

```markdown
## ComponentName
- [ ] Code quality: ___/10
- [ ] Test coverage: ___/10
- [ ] Documentation: ___/10
- [ ] Performance: ___/10
- [ ] Accessibility: ___/10
- Issues found: (count)
- Refactoring needed: Yes/No
- Priority for fixes: High/Medium/Low
```

---

## Review Sign-Off Template

```markdown
# Component Review Sign-Off

## Phase [X]: [Phase Name]
Reviewed: [Date]
Reviewer: [Name]

### Components Reviewed
- [x] Component1.tsx - Status: ✓ Approved / ⚠️ Changes needed / ❌ Major issues
- [ ] Component2.tsx

### Summary
[Brief summary of findings]

### Issues Found
1. [Issue 1] - Priority: High/Medium/Low
2. [Issue 2]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

### Sign-Off
- Code quality: Approved
- Ready for: Merge / Further review
```

---

## Quick Statistics for Planning

| Metric | Value | Time Estimate |
|--------|-------|---|
| Total Components | 27 | - |
| Root Components | 19 | 4-5 days |
| Unified Components | 8 | 2-3 days |
| Largest Component | 2,584 lines | 4+ hours |
| Medium Components | 7 | 1 day |
| Small Components | 16 | 0.5 days |
| **Total Estimated Time** | **~12-15 days** | - |

---

## Tools & Resources

### For Analysis
- Component file sizes: `find components -name "*.tsx" -exec wc -l {} +`
- Import analysis: Search for imports in each component
- Dependency graph: Map imports manually or use tool

### For Testing
- Jest (configured in package.json)
- React Testing Library (optional add)
- Storybook (optional for component catalog)

### For Documentation
- JSDoc/TSDoc for TypeScript
- Markdown for guides (like this file)
- Diagrams in COMPONENT_ANALYSIS.md

---

## Next Steps

1. **Week 1**: Review Phases 1-2 (Design System + Navigation)
2. **Week 2**: Review Phases 3-4 (Employee Management + 360 Feedback)
3. **Week 3**: Review Phases 5-6 (HR Workflows + Admin)

Each phase includes checklist items to track progress.

See **COMPONENT_ANALYSIS.md** for detailed technical information.
See **COMPONENT_QUICK_REFERENCE.txt** for quick lookup.

---

*Last Updated: 2025-11-03*
*Component Count: 27 | Lines of Code: ~14,458*
