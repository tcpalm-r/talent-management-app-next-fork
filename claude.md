# Talent Management App - Software Stack Documentation

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
- **Custom CSS** (globals.css with design system)

### Specialized UI Libraries
- **@dnd-kit** (Drag & drop functionality)
  - @dnd-kit/core
  - @dnd-kit/utilities
- **Zod 4.1.11** (Schema validation)
- **html2canvas** (Screenshot/export capabilities)

---

## Authentication & Authorization

### Auth Architecture Overview
This app uses a **custom "Sonance Auth" system** that integrates with the **AI Intranet (Sonance hub)** for centralized authentication across Sonance applications.

**Production Authentication Flow:**
- **Primary Auth Provider**: AI Intranet (https://aiintranet.sonance.com)
- **OAuth Provider**: Auth0 (used by AI Intranet for SSO)
- **Authentication Flow**: User → AI Intranet → Auth0 OAuth → JWT token → This app
- **Token Validation**: Middleware validates JWT by calling AI Intranet's `/api/auth/validate-token`
- **Session Management**: JWT stored in cookies (`ai-intranet-session`, `ai-intranet-user`)
- **Cross-Domain Auth**: Tokens can be passed via URL parameter (`?auth_token=...`)

**Development Authentication Mode:**
- Set `DISABLE_AUTH=true` or `NEXT_PUBLIC_DISABLE_AUTH=true` in environment
- Mock user automatically injected into all requests
- No external authentication calls required
- Useful for local development and testing

### Custom Auth Layer Files
- **lib/auth.ts** - Core auth utilities
  - AI Intranet token validation logic
  - Mock user constants for development
  - Session helper functions
  - `AUTH_DISABLED` constant exports
- **lib/auth-wrapper.ts** - Auth wrapper components
  - Client-side auth state management
  - User context providers
- **lib/auth-supabase.ts** - Supabase auth integration
  - Syncs authenticated users with Supabase user_profiles table

### Middleware
- **middleware.ts** - Route protection and auth enforcement
  - Checks authentication for all non-public routes
  - Validates JWT tokens with AI Intranet in production
  - Injects mock user headers/cookies in development mode
  - Handles cross-domain authentication via URL tokens
  - Skips auth for public paths (API routes, static assets, etc.)

### Auth API Routes
Located in `app/api/auth/`:

- **`/login`** - Initiates Auth0 login flow (redirects to AI Intranet)
  - Bypasses in development mode (when `DISABLE_AUTH=true`)

- **`/logout`** - Clears session cookies and logs user out

- **`/callback`** - Handles Auth0 OAuth callback after successful login
  - Exchanges authorization code for tokens
  - Sets session cookies

- **`/validate-token`** - Validates JWT token with AI Intranet API
  - Called by middleware on each request

- **`/me`** - Returns current authenticated user data
  - Reads from session cookies

- **`/switch-user`** - Development mode: Switch between mock users
  - Only available when `DISABLE_AUTH=true`
  - Allows testing different user roles

- **`/sync`** - Syncs user data from Auth0/AI Intranet to Supabase
  - Updates user_profiles table with latest user information

### Environment Variables

**Required for Production:**
```bash
# AI Intranet Integration (Primary Auth)
AI_INTRANET_URL=https://aiintranet.sonance.com
# or for local testing:
# AI_INTRANET_URL_LOCAL=http://localhost:3001
# AI_INTRANET_URL_PROD=https://aiintranet.sonance.com

APP_ID=talent-management-app
NEXT_PUBLIC_APP_ID=talent-management-app
APP_API_KEY=<secret-api-key>

# Auth0 Configuration (OAuth Provider)
AUTH0_ISSUER_BASE_URL=https://<tenant>.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<secret>
AUTH0_BASE_URL=https://your-app-url.com
AUTH0_SECRET=<secret-for-session-encryption>
```

**Development Mode:**
```bash
# Bypass all authentication
DISABLE_AUTH=true
# or
NEXT_PUBLIC_DISABLE_AUTH=true
```

### Role-Based Access Control (RBAC)
User roles are stored in `user_profiles.app_role` field (also accessible via the `employees` materialized view) with four levels:

- **Admin** - Full system access
  - Can view all surveys across the organization
  - Can manage all users and settings
  - Can delete, finalize, or revert any survey
  - Can access admin settings panel

- **SLT** (Senior Leadership Team) - Executive leadership access
  - Can view surveys they created
  - Can view surveys where they are the subject
  - Can view surveys for their direct reports
  - Can view surveys where they are a reviewer (except drafts)
  - Cannot see other leaders' draft surveys

- **Leader** - Team management access
  - Can view surveys they created
  - Can view surveys where they are the subject
  - Can view surveys for their direct reports
  - Can view surveys where they are a reviewer (except drafts)
  - Cannot see other leaders' draft surveys

- **User** - Individual contributor access
  - Can view surveys they created
  - Can view surveys where they are the subject
  - Can view surveys where they are a reviewer (except drafts)
  - Cannot see drafts created by others

**Permission Enforcement:**
- Client-side: Role-based filtering in components (Dashboard, Feedback360Dashboard)
- Server-side: API routes rely on authenticated user context
- Middleware: Ensures all requests have valid authentication

---

## Backend / API Layer

### API Routes (Next.js App Router)
Located in `app/api/`:

- **`/api/auth/*`**
  - AI Intranet authentication handlers (see Authentication & Authorization section above for details)
  - Routes: login, logout, callback, validate-token, me, switch-user, sync

- **`/api/360-default-questions`**
  - GET: Retrieve default 360 question settings
  - POST: Update default questions and custom questions
  - Settings stored in `/data/360-default-questions.json`

- **`/api/send-survey-invitation`**
  - Email workflow for 360 feedback surveys
  - Reviewer invitation management

- **`/api/surveys/*`** - Survey management
  - `/api/surveys/list` - List surveys with role-based filtering
  - `/api/surveys/create` - Create new survey
  - `/api/surveys/[id]` - Get/update survey by ID
  - `/api/surveys/[id]/details` - Get survey with full details
  - `/api/surveys/[id]/finalize` - Finalize survey
  - `/api/surveys/[id]/revert-draft` - Revert finalized survey to draft
  - `/api/surveys/[id]/reviewers` - Manage survey reviewers
  - `/api/surveys/[id]/reviewers/[reviewerId]` - Individual reviewer operations
  - `/api/surveys/[id]/send-reminders` - Send reminder emails
  - `/api/surveys/save-draft` - Save survey draft
  - `/api/surveys/load-draft` - Load saved draft
  - `/api/surveys/update-draft` - Update draft
  - `/api/surveys/update-status` - Update survey status

- **`/api/survey-completion/*`** - Survey completion workflow
  - `/api/survey-completion/survey` - Get survey for completion
  - `/api/survey-completion/questions` - Get survey questions
  - `/api/survey-completion/start` - Start survey completion
  - `/api/survey-completion/submit` - Submit completed survey

- **`/api/360-generate-report`**
  - Generate PDF reports from survey data
  - Export functionality for completed surveys

- **`/api/ai/*`** - AI integration endpoints
  - `/api/ai/generate-survey-response` - AI-assisted response generation
  - `/api/ai/parse-survey-description` - Parse natural language survey descriptions
  - `/api/ai/parse-survey-responses` - Analyze survey responses

- **`/api/dashboard/*`** - Dashboard data endpoints
  - `/api/dashboard/data` - Dashboard statistics
  - `/api/dashboard/surveys` - Dashboard survey data

- **`/api/employees/[id]/surveys`**
  - Get all surveys for a specific employee

- **`/api/users/list`**
  - List users with filtering and pagination

- **`/api/debug/env`**
  - Debug endpoint for environment variable inspection (development only)

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
    - Action item generation (lib/actionItemGenerator.ts)
    - Survey analysis & insights (lib/survey360Analyzer.ts)
    - Review analysis (lib/reviewAnalyzer.ts)

---

## Database & ORM Layer

### Primary Database
- **Supabase (PostgreSQL Backend)**
  - @supabase/supabase-js v2.76.1 (Client SDK)
  - Direct postgres connection via connection pooler
  - Materialized views for performance optimization
  - Connection via Supabase connection pooler

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

### Database Schema
Key tables:
- `user_profiles` - Employee data with role field
- `feedback_360_surveys` - 360 review surveys
- `feedback_360_reviewers` - Survey participants
- `feedback_360_questions` - Question bank
- `feedback_360_survey_questions` - Survey-specific questions
- `feedback_360_responses` - Survey answers
- `departments` - Department data

Materialized views:
- `employees` - Active employees view (includes app_role field)
- `active_users` - User activity tracking

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
  - Role (user/leader/slt/admin)
- Color-coded role badges:
  - Purple: Admin
  - Teal: SLT
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

**Navigation Structure:**
- **Primary Role-Based Tabs**: Sponsor | Reviewer | Subject
  - **Sponsor**: Surveys you created or are managing
  - **Reviewer**: Surveys where you are providing feedback
  - **Subject**: Surveys about you
- **Status Cards**: Dynamically update based on active role tab
  - Draft, In Progress, Completed, Needs Review, Needs Reanalysis, Finalized
- **Tab Style**: Text-based with underline indicator (no background colors or button appearance)

**Features:**
- Role-based primary navigation (Sponsor/Reviewer/Subject tabs)
- Survey creation wizard
- Survey draft saving/loading (persistent drafts)
- Reviewer invitations via email
- Survey reminders (automated email reminders)
- Anonymous feedback collection
- Custom & template questions
- AI-powered analysis
- AI-assisted response generation (`/api/ai/generate-survey-response`)
- Response tracking
- Survey status management (draft/active/closed/finalized)
- Survey finalization workflow (revert finalized surveys back to draft)
- Survey report generation (`/api/360-generate-report` - PDF export)
- Admin/SLT/Leader role-based permissions

### 3. Employee Management
**Components:**
- `EmployeeDetailModal.tsx` - Employee details (feature-rich)
- `EmployeeList.tsx` - List view
- `EmployeeCardUnified.tsx` - Unified card component (in unified/ directory)

**Features:**
- Org chart visualization
- Department filtering
- Skills & capabilities tracking
- Import/export functionality
- Employee profiles
- Manager relationships

### 4. AI Features
- **AI Coach** (AICoachMicroPanel.tsx)
  - Contextual assistance
  - Suggestions and insights

- **Document Generation**
  - Action item extraction (lib/actionItemGenerator.ts)
  - Survey analysis & insights (lib/survey360Analyzer.ts)

- **Analysis**
  - Review analysis (lib/reviewAnalyzer.ts)
  - Survey insights (lib/survey360Analyzer.ts)

### 5. Other Features
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
  - TypeScript build errors ignored (`ignoreBuildErrors: true`) - TODO: Fix schema mismatches
  - ESLint build errors ignored (`ignoreDuringBuilds: true`)

- **tailwind.config.ts** - Tailwind configuration
  - Custom color palette
  - Extended grid templates
  - Content paths for all components

- **tsconfig.json** - TypeScript configuration
  - Strict mode enabled
  - Path aliases (@/*)
  - ES2018 target

- **postcss.config.mjs** - PostCSS configuration

### Testing & Quality
- TypeScript strict mode
- React Strict Mode
- ESLint Next.js config
- **Jest** - Unit testing framework (configured in jest.config.js)
  - Test files in `__tests__/` and `**/__tests__/` directories
  - Coverage thresholds: 50% for branches, functions, lines, statements
  - Test utilities: @testing-library/react, @testing-library/jest-dom
- **Playwright** - E2E testing framework
  - E2E tests in `e2e/` directory
  - Test files: `360-survey.spec.ts`

### Custom Scripts
Located in `scripts/`:
- **setup-mcp.js** - MCP server setup
- **verify-supabase.js** - Database verification
- **smart-supabase-mcp.js** - Database tooling

### MCP Integration
This project has **Model Context Protocol (MCP) servers** configured and available:

- **GitHub MCP** - Repository and code management
  - Available tools for repository operations
  - Code search and file management
  - Issue and PR management
  - Use `mcp_github_*` functions for GitHub operations

**Note:** This MCP server is configured in the Cursor IDE environment. When working on this codebase, Claude has direct access to these tools and should use them for GitHub operations rather than suggesting manual steps.

### NPM Scripts
```json
{
  "dev": "bash ./run-dev.sh",
  "dev:open": "bash ./run-dev.sh --turbo",
  "dev:local": "LOCAL_TESTING_MODE=true bash ./run-dev.sh",
  "dev:prod": "LOCAL_TESTING_MODE=false bash ./run-dev.sh",
  "dev:360": "PORT=${PORT:-3005} bash ./run-dev.sh",
  "dev:employee": "PORT=${PORT:-3006} bash ./run-dev.sh",
  "dev:performance": "PORT=${PORT:-3007} bash ./run-dev.sh",
  "build": "next build",
  "start": "next start -p 3004",
  "lint": "next lint",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "setup-mcp": "node scripts/setup-mcp.js",
  "verify-db": "node scripts/verify-supabase.js",
  "mcp": "node scripts/smart-supabase-mcp.js",
  "generate-test-360": "npx ts-node scripts/generate-test-360-data.ts",
  "ts-prune": "ts-prune",
  "knip": "knip"
}
```

**Note:** All `dev` scripts use `run-dev.sh` wrapper script which handles environment variable loading and port configuration.

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

**Authentication:**
```
# Development Mode - Bypass Auth
DISABLE_AUTH=true
# or
NEXT_PUBLIC_DISABLE_AUTH=true

# Production Mode - AI Intranet + Auth0
AI_INTRANET_URL=https://aiintranet.sonance.com
AI_INTRANET_URL_LOCAL=http://localhost:3001
AI_INTRANET_URL_PROD=https://aiintranet.sonance.com
APP_ID=talent-management-app
NEXT_PUBLIC_APP_ID=talent-management-app
APP_API_KEY=<secret-api-key>

AUTH0_ISSUER_BASE_URL=https://[tenant].auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_BASE_URL=http://localhost:3004 (or production URL)
AUTH0_SECRET=...
```

**AI Services:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Email:**
```
RESEND_API_KEY=re_...
```

---

## Component Architecture

### Overview
- Components organized across 3 locations:
  - Root-level feature components
  - Unified design system components
  - Index re-export file

### Component Organization

**Directory Structure:**
```
components/
├── Root - Feature-specific components
├── unified/ - Design system & reusable patterns
└── admin/ (empty)
```

### Distribution by Size & Complexity

**Large Components (>1500 LOC):**
- `Feedback360Dashboard.tsx` - 360° feedback hub & survey management
- `OneOnOneModal.tsx` - 1-on-1 meeting management + transcripts
- `EmployeeDetailModal.tsx` - Central employee profile (9 sub-panels)
- `Survey360Wizard.tsx` - Multi-step survey builder

**Medium Components (500-1500 LOC):**
- `RetentionPlanModal.tsx` - Retention strategy & stay interviews
- `AdminSettings.tsx` - Employee management + question configuration
- `EmployeeCardUnified.tsx` - Flexible card with multiple layout variants
- `ManagerNotes.tsx` - Feedback notes with severity tracking
- `Quick360Modal.tsx` - Fast survey creation
- `CreateWithAIModal.tsx` - AI-powered survey generation
- `CriticalRoleSetupModal.tsx` - Succession planning

**Small Components (<500 LOC):**
- Navigation: `Dashboard.tsx`, `Sidebar.tsx`
- Utilities: `EmployeeList.tsx`, `AICoachMicroPanel.tsx`, `SurveyAIAssistant.tsx`
- Layout: `PeopleDashboard.tsx`, `InsightsPanel.tsx`, `Avatar.tsx`

### Feature Area Organization

**1. 360° Feedback Management**
- `Feedback360Dashboard.tsx` - Main hub for survey creation and tracking
- `Survey360Wizard.tsx` - Step-by-step survey builder
- `Quick360Modal.tsx` - Fast survey creation shortcut
- `CreateWithAIModal.tsx` - AI-assisted survey generation
- `SurveyAIAssistant.tsx` - AI response helper

**2. Employee Management**
- `PeopleDashboard.tsx` - Directory container
- `EmployeeList.tsx` - Searchable employee grid/list
- `EmployeeDetailModal.tsx` - Comprehensive profile modal
- `EmployeeCardUnified.tsx` - Reusable card with multiple layout variants

**3. Performance & Development**
- `OneOnOneModal.tsx` - 1-on-1 meeting management
- `RetentionPlanModal.tsx` - Retention strategy planning
- `CriticalRoleSetupModal.tsx` - Succession planning
- `ManagerNotes.tsx` - Feedback notes display
*(All nested within EmployeeDetailModal)*

**4. Admin & Configuration**
- `AdminSettings.tsx` - Employee management + 360 default questions
- `Dashboard.tsx` - Main router (includes admin view)

**5. Navigation & Layout**
- `Dashboard.tsx` - Main application orchestrator (horizontal layout: sidebar + main content)
- `Sidebar.tsx` - Navigation sidebar with role-based menu + user profile/avatar
- `Avatar.tsx` - User avatar utility
- `InsightsPanel.tsx` - Team insights dashboard
- `AICoachMicroPanel.tsx` - Contextual AI suggestions

**6. Design System (in `unified/` subdirectory)**
- `EmployeeCardUnified.tsx` - Flexible card component with multiple variants
- `BadgeSystem.tsx` - Status indicators with multiple badge types
- `NavigationTabs.tsx` - Tab navigation pattern
- `ModalLayout.tsx` - Standardized modal wrapper
- `EmptyState.tsx` - Consistent empty state pattern
- `StatCard.tsx` - Metric display card
- `EmployeeNameLink.tsx` - Smart employee link with context-aware navigation
- `index.ts` - Re-exports for unified components

### Dependency Analysis

**Hub Components (Highest Centrality):**
1. `EmployeeDetailModal.tsx` - Imports multiple nested modals (OneOnOne, Retention, CriticalRole)
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
Dashboard (Router - Horizontal Layout)
├── Sidebar (nav + user profile/avatar)
└── Main Content Area:
    ├── PeopleDashboard
    │  └── EmployeeList
    │     ├── EmployeeCardUnified
    │     └── EmployeeDetailModal (9 panels)
    │        ├── OneOnOneModal
    │        ├── RetentionPlanModal
    │        ├── CriticalRoleSetupModal
    │        └── Survey360Wizard
    ├── Feedback360Dashboard (hub)
    │  ├── NavigationTabs (Sponsor | Reviewer | Subject)
    │  ├── Survey360Wizard
    │  ├── Quick360Modal
    │  ├── CreateWithAIModal
    │  └── SurveyAIAssistant
    ├── AdminSettings
    └── InsightsPanel
```

### Key Patterns & Observations

✅ **Well-Implemented Patterns:**
- **Modular Modal System** - Consistent modal patterns with ModalLayout base
- **Design System Integration** - Unified components provide consistency
- **Context-Driven Navigation** - EmployeeNameLink enables global profile access
- **Nested Modal Composition** - Complex workflows compose simple modals effectively
- **AI Integration Points** - Three distinct AI features (Survey generation, Response help, Suggestions)

⚠️ **Areas for Improvement:**
- **Large Component Size** - Several large components are candidates for decomposition
- **Modal Nesting** - EmployeeDetailModal contains multiple nested modals (could flatten with modal router)
- **Prop Drilling** - Multiple components pass many props (context providers would help)
- **Test Coverage** - Jest is configured with test files, but coverage could be expanded
- **Limited Documentation** - Components lack JSDoc/TSDoc for complex logic

### Recommended Review Sequence

**Phase 1: Design System Foundation** (2-3 days)
- `BadgeSystem.tsx` - Verify 8 badge types consistency
- `EmployeeCardUnified.tsx` - Review 4 layout variants
- `ModalLayout.tsx` - Check sizing and accessibility

**Phase 2: Navigation & Routing** (1-2 days)
- `Dashboard.tsx` - Main router and horizontal layout orchestration
- `Sidebar.tsx` - Navigation structure + user profile/avatar/role switching

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
1. **Client Components:** Use Supabase SDK (lib/supabase.ts) - respects Row Level Security (RLS)
2. **Server Components/API Routes:** Use Supabase admin SDK (lib/supabase-admin.ts) or database helpers (lib/database.ts)
3. **Type Safety:** TypeScript types from lib/schema.ts (type definitions only, not ORM schema)
4. **Note:** All database operations use Supabase client directly - no ORM layer (Drizzle or similar)

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
├── components/             # React components
├── lib/                    # Utilities & services
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
- Type-safe queries with Supabase client
- Supabase SDK for all database operations (no ORM layer)
- TypeScript types from lib/schema.ts for type safety
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
   - Expand Jest test coverage
   - Add component testing
   - Expand Playwright E2E tests

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
1. **Auth not working:** Check DISABLE_AUTH environment variable and AI Intranet configuration
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
- Auth0: https://auth0.com/docs
- Anthropic: https://docs.anthropic.com

### Internal Documentation
- Migration scripts in project root
- Schema definitions in lib/schema.ts
- API documentation in route files
- Component documentation in JSDoc comments

---

Last Updated: 2025-11-18
Version: 0.4.0 (UI Restructure - Removed TopHeader, moved profile to sidebar, added role-based tabs to 360 dashboard)

## Important Naming Note

  **Local Directory & GitHub Repository:** `talent-management-next` (https://github.com/tcpalm-r/talent-management-app-next-fork)
  **Vercel Deployment Project:** `sonance-360-review` (https://vercel.com/elliottamadors-projects/sonance-360-review)
  **Production URL:** `https://sonance-360-review.vercel.app`
  
  **Deployment Branches:**
  - `main` branch → Production deployment (https://sonance-360-review.vercel.app)
  - Feature branches → Preview deployments only
  
  When working on this project, remember that only pushes to the `main` branch trigger production deployments to the sonance-360-review Vercel project.