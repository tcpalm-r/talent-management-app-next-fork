# Talent Management App - Component Architecture Analysis

## Executive Summary

- **Total Components:** 27 React TSX components
- **Directory Structure:** 3 subdirectories (root, `unified/`, `admin/`)
- **Largest Components:** Feedback360Dashboard (2,584 lines), OneOnOneModal (2,101 lines), EmployeeDetailModal (1,834 lines)
- **Code Organization:** Well-organized by feature area with clear subdirectories for unified UI patterns

---

## 1. Directory Structure & Organization

### Root Components (19 files)
Main application components handling major features and workflows.

### Unified Components (8 files in `unified/`)
Reusable UI patterns, shared components, and design system elements.

### Admin Components
Empty directory (admin-specific components may be in `/app/` routes)

---

## 2. All Components by Directory

### Root Level Components (19)

#### Major Feature Components (Largest/Most Complex)

| Component | Lines | Purpose | Key Dependencies |
|-----------|-------|---------|------------------|
| **Feedback360Dashboard.tsx** | 2,584 | Main 360-degree feedback dashboard; displays surveys, analytics, and management interface | supabase, Survey360Wizard, CreateWithAIModal, exportReport |
| **OneOnOneModal.tsx** | 2,101 | Comprehensive one-on-one meeting management with agendas, notes, transcripts, and AI summaries | generateOneOnOneSummary, transcriptImporter, EmployeeNameLink |
| **EmployeeDetailModal.tsx** | 1,834 | Rich employee profile modal with 9 sub-panels (overview, performance, development, notes, advanced); integrates all HR workflows | analyzePerformanceReview, ManagerNotes, OneOnOneModal, RetentionPlanModal, AICoachMicroPanel |
| **Survey360Wizard.tsx** | 1,611 | Step-by-step survey creation wizard; handles question selection, reviewer assignment, and deployment | supabase, QUESTION_LIBRARY, CreateWithAIModal |
| **RetentionPlanModal.tsx** | 790 | Retention strategy modal for at-risk employees; includes stay interviews, compensation, benefits | EmployeeNameLink |
| **AdminSettings.tsx** | 672 | Admin dashboard for employee management, role assignment, and 360 default question configuration | getActiveUsers, updateUserProfile, QUESTION_LIBRARY |

#### Medium-Sized Components

| Component | Lines | Purpose | Key Dependencies |
|-----------|-------|---------|------------------|
| **EmployeeList.tsx** | 377 | List/grid view of employees with search, filtering, and inline actions | EmployeeDetailModal, Quick360Modal, EmployeeCardUnified |
| **ManagerNotes.tsx** | 518 | Displays manager feedback notes with severity levels, tags, and acknowledgment tracking | (standalone UI component) |
| **Quick360Modal.tsx** | 476 | Quick survey creation modal with inline question editing and reviewer management | supabase, QUESTION_LIBRARY, EmployeeNameLink |
| **CreateWithAIModal.tsx** | 427 | AI-powered survey creation using natural language; includes speech-to-text support | useSpeechToText |
| **CriticalRoleSetupModal.tsx** | 389 | Succession planning modal for critical roles; manages backups, successors, and development plans | EmployeeNameLink |

#### Smaller UI/Layout Components

| Component | Lines | Purpose | Key Dependencies |
|-----------|-------|---------|------------------|
| **Dashboard.tsx** | 339 | Main application container; orchestrates view routing (360-feedback, directory, admin, insights) | PeopleDashboard, Feedback360Dashboard, AdminSettings, Sidebar, TopHeader |
| **PeopleDashboard.tsx** | ~150 | Employee directory view; delegates to EmployeeList | EmployeeList |
| **AICoachMicroPanel.tsx** | 284 | Inline AI assistant suggestions with icons, priorities, and auto-hide; appears contextually | UnifiedAICoachContext |
| **Sidebar.tsx** | ~100 | Navigation sidebar with role-based menu items (Talent, 360°, Insights, Admin) | (standalone UI) |
| **TopHeader.tsx** | 177 | Application header with user profile menu and role switcher | Avatar |
| **SurveyAIAssistant.tsx** | 241 | AI-powered feedback response assistant with speech-to-text | useSpeechToText |
| **InsightsPanel.tsx** | 145 | Team insights dashboard showing strengths, opportunities, and trends; role-aware | (computed insights) |
| **Avatar.tsx** | ~50 | User avatar component with initials fallback; supports xs/sm/md/lg sizes | (standalone UI) |

---

### Unified Components (`unified/` subdirectory - 8 files)

Reusable design system components exported via `unified/index.ts`

| Component | Lines | Purpose | Type |
|-----------|-------|---------|------|
| **EmployeeCardUnified.tsx** | 616 | Flexible employee card with variants (grid, list, compact, detailed); drag-enabled | Compound Component |
| **BadgeSystem.tsx** | 254 | Badge library: Performance, Potential, Department, Status, Progress, Risk, ITP Score | Design System |
| **NavigationTabs.tsx** | ~100 | Reusable tab navigation with icon support, counts, and variants (primary, pills, underline) | UI Pattern |
| **ModalLayout.tsx** | 122 | Standardized modal wrapper with header, footer, and configurable sizes | Layout Component |
| **EmptyState.tsx** | ~80 | Consistent empty state display with icon, title, description, and CTA | UI Pattern |
| **StatCard.tsx** | ~100 | Metric display card with icon, trend indicator, and click handler | UI Component |
| **EmployeeNameLink.tsx** | ~80 | Clickable employee name that opens universal employee card via context | Smart Link |

**Exports via `unified/index.ts`:**
- All 7 component defaults
- `useToast` hook (re-exported from TalentAppContext)
- Badge system exports: Badge, PerformanceBadge, PotentialBadge, DepartmentBadge, StatusBadge, CountBadge, ProgressBadge, RiskBadge, ITPScoreBadge, BadgeComponents

---

## 3. Components Grouped by Feature Area

### 360° Feedback Management (5 components)
Core 360-degree feedback system

- **Feedback360Dashboard.tsx** - Main hub; survey creation, tracking, analytics
- **Survey360Wizard.tsx** - Multi-step survey builder
- **Quick360Modal.tsx** - Fast survey creation shortcut
- **CreateWithAIModal.tsx** - AI-assisted survey generation
- **SurveyAIAssistant.tsx** - AI response helper

**Data Flow:**
Feedback360Dashboard → (Survey360Wizard | Quick360Modal | CreateWithAIModal) → Survey created in Supabase

---

### Employee Management (4 components)
Employee directory, profiles, and discovery

- **PeopleDashboard.tsx** - Directory container
- **EmployeeList.tsx** - Searchable employee list/grid
- **EmployeeDetailModal.tsx** - Comprehensive profile modal
- **EmployeeCardUnified.tsx** - Reusable employee card

**Features:**
- Search, filter by department, status
- Inline editing capability
- Multi-view layouts (grid, list, compact, detailed)
- Drag-and-drop support

---

### Performance & Development (4 components)
HR workflows: reviews, assessments, planning

- **EmployeeDetailModal.tsx** - Contains sub-panels for performance
- **OneOnOneModal.tsx** - 1-on-1 meeting management
- **RetentionPlanModal.tsx** - Retention strategy/stay interviews
- **CriticalRoleSetupModal.tsx** - Succession planning

**Integrated In:** EmployeeDetailModal as modal-within-modal

---

### Admin & Configuration (2 components)
System administration and settings

- **AdminSettings.tsx** - Employee management + 360 default questions
- **Dashboard.tsx** - Main router (includes admin view)

**Responsibilities:**
- User role assignment (admin/leader/user)
- Default question template management
- Feature toggling and system configuration

---

### UI/UX & Navigation (6 components)
Navigation, layout, and design patterns

- **Dashboard.tsx** - Main layout orchestrator
- **Sidebar.tsx** - Primary navigation
- **TopHeader.tsx** - Header with user menu
- **Avatar.tsx** - User avatar utility
- **InsightsPanel.tsx** - Dashboard widget
- **AICoachMicroPanel.tsx** - Inline AI suggestions

---

### Design System / Unified Components (7 in `unified/`)
Reusable UI patterns and components

**Purpose:** Consistency across the application

- **EmployeeCardUnified.tsx** - Flexible card for all employee displays
- **BadgeSystem.tsx** - Status indicators (performance, potential, department, etc.)
- **NavigationTabs.tsx** - Tab navigation pattern
- **ModalLayout.tsx** - Standard modal wrapper
- **EmptyState.tsx** - Consistent empty state pattern
- **StatCard.tsx** - Metric display pattern
- **EmployeeNameLink.tsx** - Smart employee name link

---

## 4. Dependency Analysis

### Most Connected Components (Hub Pattern)

**Highest Incoming Dependencies:**

1. **EmployeeDetailModal.tsx** (imported by: EmployeeList)
   - Central hub for all employee-centric workflows
   - Composes: ManagerNotes, OneOnOneModal, RetentionPlanModal, Survey360Wizard, CriticalRoleSetupModal

2. **Dashboard.tsx** (imported by: main app)
   - Application root router
   - Orchestrates: PeopleDashboard, Feedback360Dashboard, AdminSettings, Sidebar, TopHeader

3. **Feedback360Dashboard.tsx** (imported by: Dashboard)
   - 360 feature hub
   - Composes: Survey360Wizard, CreateWithAIModal, export utilities

4. **EmployeeCardUnified.tsx** (imported by: EmployeeList)
   - Reusable display component
   - Used throughout directory and search results

5. **EmployeeNameLink.tsx** (imported by: 9+ components)
   - Context-aware navigation primitive
   - Creates universal employee card access pattern

---

### External Library Dependencies

**Most Common:**

- **lucide-react** - Icons (all components use multiple icons)
- **supabase** - Database (Feedback360Dashboard, Survey360Wizard, Quick360Modal, EmployeeList)
- **React hooks** - useState, useEffect, useCallback, useRef, useMemo (all components)
- **react-dom** - createPortal (modals)
- **@dnd-kit** - Drag/drop (EmployeeCardUnified)

**Context Providers (Custom):**

- **UnifiedAICoachContext** - AICoachMicroPanel
- **QuickActionContext** - EmployeeNameLink
- **EmployeeFocusContext** - EmployeeCardUnified
- **TalentAppContext** - useToast hook (unified/index.ts)

---

### Data Flow Patterns

**Upward Data Flow (Props):**
```
Dashboard (state)
├── PeopleDashboard (props)
│   └── EmployeeList (props)
│       └── EmployeeCardUnified (props)
└── Feedback360Dashboard (props)
```

**Downward Events (Callbacks):**
```
Dashboard
├── onEmployeeUpdate()
├── onPlansUpdate()
├── onReviewSave()
└── onViewChange()
```

**Context Access (Horizontal):**
- AICoachMicroPanel ← UnifiedAICoachContext
- EmployeeNameLink ← QuickActionContext, EmployeeFocusContext
- unified/index.ts ← TalentAppContext (useToast)

---

## 5. Component Size Distribution

### By Lines of Code

**Large Components (>1500 lines):**
- Feedback360Dashboard (2,584)
- OneOnOneModal (2,101)
- EmployeeDetailModal (1,834)
- Survey360Wizard (1,611)

**Medium Components (500-1500 lines):**
- RetentionPlanModal (790)
- AdminSettings (672)
- EmployeeCardUnified (616)
- ManagerNotes (518)
- Quick360Modal (476)
- CreateWithAIModal (427)
- CriticalRoleSetupModal (389)

**Small Components (<500 lines):**
- EmployeeList (377)
- Dashboard (339)
- AICoachMicroPanel (284)
- SurveyAIAssistant (241)
- BadgeSystem (254)
- TopHeader (177)
- InsightsPanel (145)
- Avatar (~50)

---

## 6. Component Maturity & Pattern Assessment

### Well-Structured Patterns

✓ **Modular Modal System:**
- Consistent modal patterns (ModalLayout base)
- Compose complex modals from simple ones (e.g., EmployeeDetailModal contains nested modals)

✓ **Design System Integration:**
- Unified badge system (8 badge variants)
- Consistent card layouts (EmployeeCardUnified with multiple variants)
- Reusable empty states

✓ **Context-Driven Navigation:**
- QuickActionContext enables global employee profile access
- EmployeeNameLink available everywhere

✓ **AI Integration Points:**
- CreateWithAIModal for survey generation
- SurveyAIAssistant for response help
- AICoachMicroPanel for contextual suggestions

### Areas for Refactoring

⚠ **Large Components (Code Size):**
- EmployeeDetailModal (1,834 lines) - Consider breaking into sub-components
- Feedback360Dashboard (2,584 lines) - Could split into separate tabs/sections
- OneOnOneModal (2,101 lines) - Meeting, agenda, notes sections could be extracted

⚠ **Prop Drilling:**
- Multiple components pass 10+ props down
- Candidates for context providers: employee data, organization settings, user preferences

⚠ **Modal Composition:**
- EmployeeDetailModal contains 5+ nested modals
- Could use modal router pattern to flatten hierarchy

---

## 7. Feature Area Breakdown

### 360° Feedback System (100% Component Coverage)

**Creation Path:**
1. Feedback360Dashboard (launch point)
2. → Survey360Wizard (step-by-step) OR Quick360Modal (shortcut) OR CreateWithAIModal (AI-assisted)
3. → Supabase (persist survey + send invitations)

**Management Path:**
1. Feedback360Dashboard (list surveys)
2. → View responses, analytics, export reports
3. → Re-analysis if flagged for admin review

**Components:** 5 major, 2 utility

---

### Employee Management (100% Component Coverage)

**Discovery Path:**
1. Dashboard (navigation)
2. → PeopleDashboard (container)
3. → EmployeeList (with search/filter)
4. → EmployeeCardUnified (preview)
5. → EmployeeDetailModal (full profile)

**List View Variants:**
- Grid (4-column default)
- List (scrollable table)
- Compact (search results)
- Detailed (expanded info)

**Components:** 4 major, 1 design system (EmployeeCardUnified)

---

### Performance & Development Workflows

**One-on-One Meetings:**
- OneOnOneModal (standalone or from EmployeeDetailModal)
- Create meeting, agenda items, shared/private notes, transcripts, AI summary
- 2,101 lines (complex business logic)

**Performance Reviews:**
- Sub-panel in EmployeeDetailModal
- Links to: manager review, self-review, 360 feedback
- AI-powered analysis and action items

**Retention Planning:**
- RetentionPlanModal (from EmployeeDetailModal)
- Stay interview notes, strategies (compensation, career growth, flexibility)
- LTIP details tracking

**Succession Planning:**
- CriticalRoleSetupModal (from EmployeeDetailModal)
- Emergency backup assignment
- Successor identification
- Development plan timeline

**Components:** 4 major (all nested in EmployeeDetailModal)

---

### Admin & System Configuration

**Employee Management:**
- Search employees
- Inline edit (name, email, title, department, location, role)
- Soft delete (set is_active=false)
- Role assignment badges (Admin/Leader/User color-coded)

**360 Questions Configuration:**
- Set 3 default questions for all surveys
- Browse categorized template library (8 categories)
- Create custom questions
- Mix templates and custom questions
- Delete custom questions
- Persist to /data/360-default-questions.json

**Components:** AdminSettings (672 lines)

---

## 8. Key Insights for Component Review

### Strengths

1. **Clear Separation of Concerns:**
   - Feature components handle business logic
   - Design system components handle presentation
   - Navigation components handle routing

2. **Scalable Modal System:**
   - Nested modals work well (Dashboard → PeopleDashboard → EmployeeDetailModal → OneOnOneModal)
   - Consistent sizing (sm/md/lg/xl/full)

3. **Reusable Patterns:**
   - Badge system covers all status types
   - EmployeeCardUnified supports 4 view variants
   - NavigationTabs provides consistent tab UI

4. **Context-Driven Access:**
   - EmployeeNameLink enables global employee navigation
   - AICoachMicroPanel provides contextual AI assistance

### Improvement Opportunities

1. **Component Decomposition:**
   - Top 4 components are 1,600+ lines
   - Break into logical sub-components
   - Example: EmployeeDetailModal → Overview/Performance/Development/Notes panels as separate files

2. **State Management Consolidation:**
   - Multiple context providers (UnifiedAICoachContext, QuickActionContext, EmployeeFocusContext)
   - Consider unified app context or state machine

3. **Testing Infrastructure:**
   - No test files present (jest.config.js exists but unused)
   - Recommend adding snapshot tests for unified components first
   - Integration tests for modal workflows

4. **Documentation:**
   - Add JSDoc/TSDoc to complex components
   - Component interaction diagrams
   - Props interface documentation

5. **Performance:**
   - Large modals might benefit from code splitting
   - Consider lazy loading for less-used sub-panels
   - Memoization opportunities in nested renders

---

## 9. Component Interaction Diagram

```
Application Root
│
├─ Dashboard (Router)
│  │
│  ├─ Sidebar (Navigation)
│  ├─ TopHeader (Header)
│  │
│  └─ Views:
│     ├─ PeopleDashboard
│     │  └─ EmployeeList
│     │     ├─ EmployeeCardUnified (grid/list/compact/detailed)
│     │     ├─ EmployeeDetailModal (on click)
│     │     │  ├─ Overview Panel
│     │     │  ├─ Performance Panel
│     │     │  ├─ Development Panel
│     │     │  ├─ Notes Panel (ManagerNotes)
│     │     │  └─ Advanced Panel
│     │     │     ├─ OneOnOneModal
│     │     │     ├─ RetentionPlanModal
│     │     │     ├─ CriticalRoleSetupModal
│     │     │     └─ Survey360Wizard
│     │     │
│     │     └─ Quick360Modal (quick survey)
│     │
│     ├─ Feedback360Dashboard
│     │  ├─ Survey List (with EmployeeCardUnified previews)
│     │  ├─ Survey360Wizard (create new)
│     │  ├─ Quick360Modal (fast create)
│     │  ├─ CreateWithAIModal (AI generate)
│     │  └─ SurveyAIAssistant (AI response help)
│     │
│     ├─ AdminSettings
│     │  ├─ Employee Management (edit, delete, role assignment)
│     │  └─ 360 Default Questions Manager
│     │
│     └─ InsightsPanel
│        └─ Team Insights (read-only dashboard)
│
└─ AICoachMicroPanel (appears contextually)
```

---

## 10. Recommended Review Sequence

For a thorough component review, audit in this order:

### Phase 1: Foundation (Start Here)
1. **unified/EmployeeCardUnified.tsx** - Review all variants and drag implementation
2. **unified/BadgeSystem.tsx** - Verify all 8 badge types consistent
3. **unified/ModalLayout.tsx** - Check modal sizing and accessibility

### Phase 2: Navigation & Routing
4. **Dashboard.tsx** - View router logic and state management
5. **Sidebar.tsx** - Navigation structure and role-based menu
6. **TopHeader.tsx** - User menu and role switcher

### Phase 3: Employee Management
7. **PeopleDashboard.tsx** - Container component
8. **EmployeeList.tsx** - Search, filter, inline actions
9. **EmployeeDetailModal.tsx** - Main profile modal (complex)

### Phase 4: 360 Feedback
10. **Feedback360Dashboard.tsx** - Survey hub (complex)
11. **Survey360Wizard.tsx** - Step wizard
12. **Quick360Modal.tsx** - Fast path

### Phase 5: HR Workflows
13. **OneOnOneModal.tsx** - Meeting management (complex)
14. **RetentionPlanModal.tsx** - Retention strategy
15. **CriticalRoleSetupModal.tsx** - Succession planning

### Phase 6: Admin & AI
16. **AdminSettings.tsx** - System configuration
17. **AICoachMicroPanel.tsx** - AI suggestions
18. **CreateWithAIModal.tsx** - AI generation

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Components | 27 |
| Root Components | 19 |
| Unified/Shared | 8 |
| Admin-Specific | 0 (in subdirectory) |
| Total Lines of Code | ~14,458 |
| Largest Component | Feedback360Dashboard (2,584 lines) |
| Average Component Size | 535 lines |
| Components >1000 lines | 4 |
| Components <200 lines | 9 |
| External npm dependencies | 8+ (lucide-react, supabase, @dnd-kit, etc.) |
| Custom contexts | 3+ |
| Modal components | 6 |
| Feature areas covered | 4 major |

