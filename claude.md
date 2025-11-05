# Talent Management App - Software Stack Documentation

## Overview
This is a full-stack TypeScript application focused on talent management, performance reviews, and AI-assisted HR workflows.

---

## Frontend Framework & UI Layer

### Core Framework
- **Next.js 14.2.33** (App Router)
  - React 18 (React Server Components + Client Components)
  - React Strict Mode enabled
  - Port: 3004 (dev/prod)

### Language
- **TypeScript 5**
  - Strict mode enabled
  - Full type safety across codebase
  - Path aliases: `@/*` maps to project root

### Styling & UI Components
- **Tailwind CSS 3.4.1** (Utility-first CSS framework)
  - Custom design tokens (primary colors, grid layouts)
  - Custom color palette (primary 50-900 shades)
  - Extended grid templates (3x3 layouts)
- **Lucide React** (Icon library)
- **clsx + tailwind-merge** (Dynamic class composition)
- **Custom CSS** (globals.css with design system)

### Specialized UI Libraries
- **React Flow** (Org charts, visual workflows) - Note: reactflow package not directly listed
- **@dnd-kit** (Drag & drop functionality)
  - @dnd-kit/core
  - @dnd-kit/utilities
- **Zod 4.1.11** (Schema validation)
- **html2canvas** (Screenshot/export capabilities)

---

## Authentication & Authorization

### Auth Provider
- **Auth0** (Custom implementation)
  - SSO support
  - OAuth integration
  - JWT token management
  - Note: @auth0/nextjs-auth0 package not directly in dependencies

### Custom Auth Layer
- **lib/auth.ts** - Core auth utilities
- **lib/auth-wrapper.ts** - Auth wrapper components
- **lib/auth-supabase.ts** - Supabase auth integration
- **Features:**
  - Mock user support for local development
  - Protected route middleware
  - Role-based access control (admin/leader/user)
  - Dev bypass mode with `AUTH_DISABLED` flag

### Middleware
- **middleware.ts**
  - Route protection for authenticated pages
  - AI Intranet URL routing (local/prod switching)
  - Environment-based configuration
  - Auth bypass for development mode

---

## Backend / API Layer

### API Routes (Next.js App Router)
Located in `app/api/`:

- **`/api/auth/*`**
  - Auth0 handlers
  - Custom sync endpoints
  - Token validation
  - Logout handling

- **`/api/360-default-questions`**
  - GET: Retrieve default 360 question settings
  - POST: Update default questions and custom questions
  - Settings stored in `/data/360-default-questions.json`

- **`/api/send-survey-invitation`**
  - Email workflow for 360 feedback surveys
  - Reviewer invitation management

### Email Service
- **Resend v6.2.2**
  - Transactional email API
  - 360 feedback invitations
  - System notifications
  - Survey reminders

### AI Integration
- **Anthropic SDK v0.67**
  - Claude API integration
  - Features:
    - AI Coach micro-panel
    - PIP document generation (lib/pipDocumentGenerator.ts)
    - Action item generation (lib/actionItemGenerator.ts)
    - Survey analysis & insights (lib/survey360Analyzer.ts)
    - Conversation scripts (lib/pipConversationScripts.ts)

---

## Database & ORM Layer

### Primary Database
- **Supabase (PostgreSQL Backend)**
  - @supabase/supabase-js v2.76.1 (Client SDK)
  - Direct postgres connection via connection pooler
  - Materialized views for performance optimization
  - Connection: `aws-0-us-west-1.pooler.supabase.com:6543`

### ORM Layer
- **Drizzle ORM v0.44.5**
  - Type-safe queries
  - postgres-js v3.4.7 (Database driver)
  - Schema definitions in lib/schema.ts
  - Transaction support

### Database Abstractions
- **lib/database.ts** - Query helper functions
  - getUserProfile, getActiveUsers
  - get360Questions, get360Surveys
  - Department queries
  - Statistics queries

- **lib/supabase.ts** - Main Supabase client
  - Client-side operations
  - Re-exports for convenience
  - Type definitions

- **lib/supabase-admin.ts** - Admin operations
  - Server-side only
  - Privileged operations
  - Service role key access

- **lib/db.ts** - Drizzle client setup
  - Connection management
  - Transaction helpers
  - Raw query execution

### Database Schema
Key tables:
- `user_profiles` - Employee data with role field
- `feedback_360_surveys` - 360 review surveys
- `feedback_360_reviewers` - Survey participants
- `feedback_360_questions` - Question bank
- `feedback_360_survey_questions` - Survey-specific questions
- `feedback_360_responses` - Survey answers
- `assessments` - Performance assessments
- `performance_reviews` - Review cycles
- `departments` - Department data

Materialized views:
- `employees` - Active employees view
- `active_users` - User activity tracking
- `active_performance_reviews` - Current review cycles

---

## Data Management & Storage

### File-Based Settings
- **`/data/360-default-questions.json`**
  - Custom 360 question configuration
  - Default question IDs
  - Custom question text
  - Persisted via API endpoint

### CSV Import/Export
- **PapaParse v5.5.3** (CSV parsing)
- **JSZip v3.10.1** (Archive generation)
- **Features:**
  - Employee data import
  - Bulk operations
  - Export functionality (lib/export.ts)

### Data Management Libraries
- **lib/transcriptImporter.ts** - Import conversation transcripts
- **lib/export.ts** - Export utilities
- **lib/exportReport.ts** - Report export functionality

---

## Major Application Features

### 1. Admin Settings Dashboard
**Location:** `components/AdminSettings.tsx`

**Employee Management:**
- Search-based interface with scrollable results (500px container)
- Inline editing of employee fields:
  - Name (full_name)
  - Email
  - Title
  - Department
  - Location
  - Role (user/leader/admin)
- Color-coded role badges:
  - Purple: Admin
  - Blue: Leader
  - Gray: User
- Soft delete functionality (sets is_active=false)
- All changes persist to Supabase user_profiles table

**360 Default Questions:**
- Configure 3 default questions for all 360 reviews
- Browse categorized template questions:
  - Impact
  - Growth (Start/Stop/Continue)
  - Leadership
  - Collaboration
  - Performance
  - Value
  - Trust
  - General
- Create custom questions with free-form text
- Mix template and custom questions
- Delete custom questions
- Settings persist to JSON file

### 2. 360° Feedback System
**Components:**
- `Feedback360Dashboard.tsx` - Main dashboard
- `Survey360Wizard.tsx` - Survey creation wizard
- `Quick360Modal.tsx` - Quick survey creation

**Features:**
- Survey creation wizard
- Reviewer invitations via email
- Anonymous feedback collection
- Custom & template questions
- AI-powered analysis
- Response tracking
- Survey status management (draft/active/closed)
- Role-based filtering (admin/leader view)

### 3. 9-Box Talent Grid
Performance vs. Potential assessment matrix
- Visual grid layout
- Employee positioning
- Assessment tracking

### 4. Performance Review Management
- Multiple review frameworks
- Deadline tracking
- Participant management
- Review cycles
- Status tracking

### 5. Employee Management
**Components:**
- `EmployeeDetailModal.tsx` - Employee details (85KB, feature-rich)
- `EmployeeList.tsx` - List view
- `EmployeeCardUnified.tsx` - Unified card component (in unified/ directory)

**Features:**
- Org chart visualization (React Flow)
- Department filtering
- Skills & capabilities tracking
- Import/export functionality
- Employee profiles
- Manager relationships

### 6. AI Features
- **AI Coach** (AICoachMicroPanel.tsx)
  - Contextual assistance
  - Suggestions and insights

- **Document Generation**
  - Action item extraction (lib/actionItemGenerator.ts)
  - Survey analysis & insights (lib/survey360Analyzer.ts)

- **Analysis**
  - Review analysis (lib/reviewAnalyzer.ts)
  - Survey insights (lib/survey360Analyzer.ts)

### 7. Other Features
- **Dashboard** (Dashboard.tsx) - Main application dashboard
- **Critical Role Setup** (CriticalRoleSetupModal.tsx)

---

## Development Tools & Configuration

### Build & Dev Tools
- **Next.js** (Webpack bundler)
- **PostCSS** (CSS processing)
- **ESLint** (Code linting with next config)
- **dotenv** (Environment management)

### Configuration Files
- **next.config.mjs** - Next.js configuration
  - React strict mode
  - Transpile packages: lucide-react

- **tailwind.config.ts** - Tailwind configuration
  - Custom color palette
  - Extended grid templates
  - Content paths for all components

- **tsconfig.json** - TypeScript configuration
  - Strict mode enabled
  - Path aliases (@/*)
  - ESNext target

- **postcss.config.mjs** - PostCSS configuration

### Testing & Quality
- TypeScript strict mode
- React Strict Mode
- ESLint Next.js config
- No unit test framework currently

### Custom Scripts
Located in `scripts/`:
- **setup-mcp.js** - MCP server setup
- **verify-supabase.js** - Database verification
- **smart-supabase-mcp.js** - Database tooling

### NPM Scripts
```json
{
  "dev": "next dev -p 3004",
  "dev:open": "next dev -p 3004 --turbo",
  "dev:local": "LOCAL_TESTING_MODE=true next dev -p 3004",
  "dev:prod": "LOCAL_TESTING_MODE=false next dev -p 3004",
  "build": "next build",
  "start": "next start -p 3004",
  "lint": "next lint",
  "setup-mcp": "node scripts/setup-mcp.js",
  "verify-db": "node scripts/verify-supabase.js",
  "mcp": "node scripts/smart-supabase-mcp.js"
}
```

---

## Environment & Deployment

### Runtime
- **Node.js 20+** required
- **Port:** 3004 (both dev and production)

### Environment Modes
- **LOCAL_TESTING_MODE** - Local development with mock data
- **Production Mode** - Live environment

### Required Environment Variables

**Supabase:**
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Auth0:**
```
AUTH0_SECRET=...
AUTH0_BASE_URL=http://localhost:3004 (or production URL)
AUTH0_ISSUER_BASE_URL=https://[tenant].auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
```

**AI Services:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Email:**
```
RESEND_API_KEY=re_...
```

**AI Intranet:**
```
AI_INTRANET_URL_LOCAL=http://localhost:3001
AI_INTRANET_URL_PROD=https://aiintranet.sonance.com
```

---

## Component Architecture

### Overview
- **Total Components:** 26 React components across 3 locations
- **Total Lines of Code:** ~14,458 lines
- **Average Component Size:** 535 lines
- **Root Level:** 18 feature components
- **Design System:** 7 unified/reusable components (plus index.ts)

### Component Organization

**Directory Structure:**
```
components/
├── Root (18 components) - Feature-specific components
├── unified/ (7 components + index.ts) - Design system & reusable patterns
└── admin/ (empty)
```

### Distribution by Size & Complexity

**Large Components (>1500 LOC) - 44% of total code:**
1. `Feedback360Dashboard.tsx` (2,584 lines) - 360° feedback hub & survey management
2. `OneOnOneModal.tsx` (2,101 lines) - 1-on-1 meeting management + transcripts
3. `EmployeeDetailModal.tsx` (1,834 lines) - Central employee profile (9 sub-panels)
4. `Survey360Wizard.tsx` (1,611 lines) - Multi-step survey builder

**Medium Components (500-1500 LOC) - 35% of total code:**
- `RetentionPlanModal.tsx` (790) - Retention strategy & stay interviews
- `AdminSettings.tsx` (672) - Employee management + question configuration
- `EmployeeCardUnified.tsx` (616) - Flexible card with 4 layout variants
- `ManagerNotes.tsx` (518) - Feedback notes with severity tracking
- `Quick360Modal.tsx` (476) - Fast survey creation
- `CreateWithAIModal.tsx` (427) - AI-powered survey generation
- `CriticalRoleSetupModal.tsx` (389) - Succession planning

**Small Components (<500 LOC) - 21% of total code:**
- Navigation: `Dashboard.tsx` (339), `Sidebar.tsx` (~100), `TopHeader.tsx` (177)
- Utilities: `EmployeeList.tsx` (377), `AICoachMicroPanel.tsx` (284), `SurveyAIAssistant.tsx` (241)
- Layout: `PeopleDashboard.tsx` (~150), `InsightsPanel.tsx` (145), `Avatar.tsx` (~50)

### Feature Area Organization

**1. 360° Feedback Management (5 components)**
- `Feedback360Dashboard.tsx` - Main hub for survey creation and tracking
- `Survey360Wizard.tsx` - Step-by-step survey builder
- `Quick360Modal.tsx` - Fast survey creation shortcut
- `CreateWithAIModal.tsx` - AI-assisted survey generation
- `SurveyAIAssistant.tsx` - AI response helper

**2. Employee Management (4 + design system)**
- `PeopleDashboard.tsx` - Directory container
- `EmployeeList.tsx` - Searchable employee grid/list
- `EmployeeDetailModal.tsx` - Comprehensive profile modal
- `EmployeeCardUnified.tsx` - Reusable card (grid/list/compact/detailed variants)

**3. Performance & Development (4 nested modals)**
- `OneOnOneModal.tsx` - 1-on-1 meeting management (2,101 lines)
- `RetentionPlanModal.tsx` - Retention strategy planning
- `CriticalRoleSetupModal.tsx` - Succession planning
- `ManagerNotes.tsx` - Feedback notes display
*(All nested within EmployeeDetailModal)*

**4. Admin & Configuration (2 components)**
- `AdminSettings.tsx` - Employee management + 360 default questions
- `Dashboard.tsx` - Main router (includes admin view)

**5. Navigation & Layout (6 components)**
- `Dashboard.tsx` - Main application orchestrator
- `Sidebar.tsx` - Navigation sidebar with role-based menu
- `TopHeader.tsx` - Application header + user menu
- `Avatar.tsx` - User avatar utility
- `InsightsPanel.tsx` - Team insights dashboard
- `AICoachMicroPanel.tsx` - Contextual AI suggestions

**6. Design System (7 components + index.ts in `unified/` subdirectory)**
- `EmployeeCardUnified.tsx` - Flexible card component (4 variants)
- `BadgeSystem.tsx` - Status indicators (8 badge types)
- `NavigationTabs.tsx` - Tab navigation pattern
- `ModalLayout.tsx` - Standardized modal wrapper
- `EmptyState.tsx` - Consistent empty state pattern
- `StatCard.tsx` - Metric display card
- `EmployeeNameLink.tsx` - Smart employee link with context-aware navigation
- `index.ts` - Re-exports for unified components

### Dependency Analysis

**Hub Components (Highest Centrality):**
1. `EmployeeDetailModal.tsx` - Imports 5+ nested modals (OneOnOne, Retention, CriticalRole)
2. `Dashboard.tsx` - Orchestrates all major feature areas
3. `Feedback360Dashboard.tsx` - Composes wizard, AI modal, and analytics
4. `EmployeeList.tsx` - Imports detail modal and card component

**Universal Primitives (Used Everywhere):**
- `EmployeeNameLink.tsx` - Imported by 9+ components for context-aware navigation
- `EmployeeCardUnified.tsx` - Used throughout for employee display
- `BadgeSystem.tsx` - Used in 8+ components for status indicators
- `useToast` hook - Available globally via `unified/index.ts`

**Context Providers:**
- `UnifiedAICoachContext` - Powers `AICoachMicroPanel`
- `QuickActionContext` - Enables global employee card access
- `EmployeeFocusContext` - Used by `EmployeeCardUnified`
- `TalentAppContext` - Provides `useToast` hook

### Component Interaction Architecture

```
Dashboard (Router)
├── Sidebar (nav)
├── TopHeader (header)
└── Views:
    ├── PeopleDashboard
    │  └── EmployeeList
    │     ├── EmployeeCardUnified (4 variants)
    │     └── EmployeeDetailModal (1,834 lines - 9 panels)
    │        ├── OneOnOneModal (2,101 lines)
    │        ├── RetentionPlanModal (790 lines)
    │        ├── CriticalRoleSetupModal (389 lines)
    │        └── Survey360Wizard (1,611 lines)
    ├── Feedback360Dashboard (2,584 lines - hub)
    │  ├── Survey360Wizard
    │  ├── Quick360Modal
    │  ├── CreateWithAIModal
    │  └── SurveyAIAssistant
    ├── AdminSettings (672 lines)
    └── InsightsPanel
```

### Key Patterns & Observations

✅ **Well-Implemented Patterns:**
- **Modular Modal System** - Consistent modal patterns with ModalLayout base
- **Design System Integration** - 8 unified components provide consistency
- **Context-Driven Navigation** - EmployeeNameLink enables global profile access
- **Nested Modal Composition** - Complex workflows compose simple modals effectively
- **AI Integration Points** - Three distinct AI features (Survey generation, Response help, Suggestions)

⚠️ **Areas for Improvement:**
- **Large Component Size** - Top 4 components range 1,600-2,600 lines (candidates for decomposition)
- **Modal Nesting** - EmployeeDetailModal contains 5+ nested modals (could flatten with modal router)
- **Prop Drilling** - Multiple components pass 10+ props (context providers would help)
- **No Test Coverage** - jest.config.js exists but no test files present
- **Limited Documentation** - Components lack JSDoc/TSDoc for complex logic

### Recommended Review Sequence

**Phase 1: Design System Foundation** (2-3 days)
- `BadgeSystem.tsx` - Verify 8 badge types consistency
- `EmployeeCardUnified.tsx` - Review 4 layout variants
- `ModalLayout.tsx` - Check sizing and accessibility

**Phase 2: Navigation & Routing** (1-2 days)
- `Dashboard.tsx` - Main router and state orchestration
- `Sidebar.tsx` - Navigation structure
- `TopHeader.tsx` - User menu and role switching

**Phase 3: Employee Management** (3-4 days)
- `EmployeeList.tsx` - Search, filter, actions
- `EmployeeDetailModal.tsx` - Complex 9-panel modal (refactoring candidate)
- `PeopleDashboard.tsx` - Container coordination

**Phase 4: 360° Feedback System** (3-4 days)
- `Feedback360Dashboard.tsx` - Hub dashboard (refactoring candidate)
- `Survey360Wizard.tsx` - Wizard workflow
- `Quick360Modal.tsx` - Fast path

**Phase 5: HR Workflows** (2-3 days)
- `OneOnOneModal.tsx` - Meeting management (refactoring candidate)
- `RetentionPlanModal.tsx` - Retention planning
- `CriticalRoleSetupModal.tsx` - Succession planning

**Phase 6: Admin & AI Features** (1-2 days)
- `AdminSettings.tsx` - Configuration interface
- `AICoachMicroPanel.tsx` - AI suggestions
- `CreateWithAIModal.tsx` - AI generation

---

## Library Categories

### Core Dependencies (Production)
- **Framework:** next, react, react-dom
- **Database:** @supabase/supabase-js
- **AI:** @anthropic-ai/sdk
- **Email:** resend
- **UI:** lucide-react, @dnd-kit/core, @dnd-kit/utilities
- **Validation:** zod
- **Utilities:** uuid
- **Data:** papaparse, jszip, html2canvas, jspdf

### Dev Dependencies
- **TypeScript:** typescript, @types/*
- **Linting:** eslint, eslint-config-next
- **Styling:** tailwindcss, postcss
- **Environment:** dotenv

---

## Recent Updates

### Component Architecture Analysis (2025-11-03)

**Comprehensive Component Audit Completed:**
- Analyzed all 27 components across 3 locations
- Total codebase: ~14,458 lines of component code
- Created 3 detailed analysis documents:
  - `COMPONENT_ANALYSIS.md` - Technical deep dive (19 KB)
  - `COMPONENT_QUICK_REFERENCE.txt` - Quick lookup guide (11 KB)
  - `COMPONENT_REVIEW_PLAN.md` - 6-phase review framework (14 KB)

**Key Findings:**
- 4 large components (>1,500 LOC) contain 44% of code - refactoring candidates
- Well-organized design system with 8 unified components
- Clear feature area separation: 360° Feedback, Employee Management, Performance, Admin, Navigation
- 3 hub components with high centrality: Dashboard, EmployeeDetailModal, Feedback360Dashboard
- Context-driven navigation pattern enables global employee profile access
- No unit test coverage despite jest.config.js present

**Recommended Action Items:**
- Phase 1-6 component review plan outlined in this section
- Consider decomposing top 4 components (1,600+ lines each)
- Add JSDoc/TSDoc documentation to complex components
- Implement component testing framework (Jest/Vitest)
- Flatten modal composition hierarchy (EmployeeDetailModal nests 5+ modals)

---

### Latest Commit (Previous)

**Commit:** a670cae
**Date:** 2025-10-28

### Previous Changes:
1. **Admin Settings Panel**
   - Complete employee management interface
   - Search-based with scrollable results
   - Inline editing for all employee fields
   - Role management with visual badges
   - Soft delete functionality

2. **360 Default Questions**
   - Configure 3 default questions
   - Template question library
   - Custom question creation
   - Mix template and custom questions
   - Persistent settings via API

3. **Technical Additions**
   - New API route: `/api/360-default-questions`
   - Added 'role' field to UserProfile schema
   - Migration script for organization_settings table
   - Data directory for local settings storage
   - Updated .gitignore

---

## Architecture Patterns

### Next.js App Router Structure
```
app/
├── api/              # API routes
├── layout.tsx        # Root layout
├── page.tsx          # Home page
├── providers.tsx     # Context providers
├── AppWrapper.tsx    # Main app wrapper
└── globals.css       # Global styles
```

### Component Pattern
- Server Components by default
- Client Components marked with 'use client'
- Server-side data fetching where possible
- Client-side state management with hooks

### Database Access Pattern
1. **Client Components:** Use Supabase SDK (lib/supabase.ts)
2. **Server Components/API Routes:** Use Supabase admin SDK (lib/supabase-admin.ts) or database helpers (lib/database.ts)
3. **Type Safety:** TypeScript types from lib/schema.ts

### Auth Pattern
1. Middleware checks authentication
2. Mock user in development mode
3. Auth0 in production
4. Role-based access in components

---

## File Organization

### Key Directories
```
talent-management-next/
├── app/                    # Next.js app router
├── components/             # React components (34 files)
├── lib/                    # Utilities & services (26 files)
├── context/                # React contexts
├── hooks/                  # Custom hooks
├── scripts/                # Build/dev scripts
├── public/                 # Static assets
├── types/                  # TypeScript types
└── data/                   # Runtime data storage
```

### Configuration Files
```
├── next.config.mjs         # Next.js config
├── tailwind.config.ts      # Tailwind config
├── tsconfig.json           # TypeScript config
├── postcss.config.mjs      # PostCSS config
├── .eslintrc.json         # ESLint config
├── .gitignore             # Git ignore
└── package.json           # Dependencies
```

---

## Best Practices

### TypeScript
- Strict mode enabled
- Full type coverage
- Schema validation with Zod
- Type imports from lib/schema.ts

### React
- Functional components
- Hooks for state management
- Server Components when possible
- Clear client/server boundaries

### Styling
- Tailwind utility classes
- Consistent design tokens
- Responsive design
- Accessible components

### Database
- Type-safe queries with Drizzle
- Supabase for client operations
- Materialized views for performance
- Proper indexing

### Security
- Environment variable validation
- Auth middleware protection
- Role-based access control
- Secure API endpoints

---

## Future Considerations

### Potential Enhancements
1. **Testing:**
   - Expand Jest test coverage (currently 1 test file)
   - Add component testing
   - Expand Playwright E2E tests (currently 1 test file)

2. **Database:**
   - Implement organization_settings table
   - Move file-based settings to DB
   - Add data migrations framework

3. **Performance:**
   - Implement caching strategy
   - Optimize bundle size
   - Add performance monitoring

4. **Features:**
   - Advanced analytics
   - Custom report builder
   - Mobile app
   - Offline support

---

## Troubleshooting

### Common Issues
1. **Auth not working:** Check AUTH_DISABLED and environment variables
2. **Database connection:** Verify Supabase credentials
3. **Build errors:** Clear .next directory and rebuild
4. **Type errors:** Run `npm run lint` and check imports

### Debug Mode
- Use `dev:local` for local testing mode
- Check middleware.ts for auth bypass
- Enable console logging in development

---

## Additional Resources

### Documentation Links
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Drizzle ORM: https://orm.drizzle.team
- Auth0: https://auth0.com/docs
- Anthropic: https://docs.anthropic.com

### Internal Documentation
- Migration scripts in project root
- Schema definitions in lib/schema.ts
- API documentation in route files
- Component documentation in JSDoc comments

---

Last Updated: 2025-11-03
Version: 0.2.0 (Component Architecture Analysis Added)

## Important Naming Note

  **Local Directory & GitHub Repository:** `talent-management-next` (https://github.com/tcpalm-r/talent-management-app-next-fork)
  **Vercel Deployment Project:** `employee-self-assessment` (https://vercel.com/elliottamadors-projects/employee-self-assessment)
  When working on this project, remember that pushes to the GitHub repo automatically deploy to the employee-self-assessment Vercel project, NOT to a project named talent-management-next.