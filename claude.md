# Talent Management App - Technical Documentation

> **Version:** 0.4.1 | **Updated:** 2025-11-20
> **Repo:** talent-management-next | **Deployment:** sonance-360-review | **URL:** https://sonance-360-review.vercel.app

---

## Quick Reference

### Tech Stack
| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | Next.js (App Router) | 14.2.33 | React SSR/SSG |
| **Language** | TypeScript | 5 | Type-safe development |
| **UI** | Tailwind CSS | 3.4.1 | Utility-first styling |
| **Database** | Supabase (PostgreSQL) | 2.76.1 | Primary data store |
| **Auth** | Auth0 + AI Intranet | - | SSO authentication |
| **AI** | Anthropic Claude | 0.67 | AI features |
| **Email** | Resend | 6.2.2 | Transactional emails |
| **Icons** | Lucide React | - | Icon library |
| **Validation** | Zod | 4.1.11 | Schema validation |
| **Testing** | Jest + Playwright | - | Unit + E2E tests |

### Key Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (port 3004) |
| `npm run dev:local` | Dev with mock auth |
| `npm run build` | Production build |
| `npm run test` | Run Jest unit tests |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run lint` | ESLint code check |

### Essential Environment Variables
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth (Production)
AI_INTRANET_URL=https://aiintranet.sonance.com
AUTH0_ISSUER_BASE_URL=https://[tenant].auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_SECRET=...
APP_ID=talent-management-app
APP_API_KEY=...

# Auth (Development - Bypass)
DISABLE_AUTH=true

# Services
ANTHROPIC_API_KEY=sk-ant-...  # Server-side only (secure)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=feedback@aiintranet.sonance.com
CRON_SECRET=<random-secret>
```

---

## Architecture Overview

### Frontend Stack
- **Next.js 14 App Router:** React Server Components + Client Components
- **TypeScript 5:** Strict mode, path aliases (@/*), ES2018 target
- **Tailwind CSS:** Custom design tokens, responsive utilities, primary color palette (50-900)
- **UI Libraries:** Lucide React (icons), @dnd-kit (drag & drop), html2canvas (screenshots)

### Backend & API
**Located in `app/api/`:**

| Endpoint | Purpose |
|----------|---------|
| `/auth/*` | Login, logout, callback, validate-token, me, switch-user, sync |
| `/surveys/*` | CRUD operations, reviewers, reminders, finalization, drafts |
| `/survey-completion/*` | Survey taking workflow (start, questions, submit) |
| `/360-default-questions` | Default question configuration |
| `/360-generate-report` | PDF report generation |
| `/ai/*` | Survey response generation, parsing, analysis |
| `/dashboard/*` | Dashboard data and statistics |
| `/employees/[id]/surveys` | Employee survey history |
| `/users/list` | User management with filtering |
| `/send-survey-invitation` | Email invitations |
| `/cron/send-survey-reminders` | Auto-reminder cron job (9 AM UTC daily) |

**Services:**
- **Email:** Resend for invitations, reminders, notifications
- **AI:** Anthropic Claude for survey analysis, response generation, AI Coach
- **Cron:** Vercel Cron Jobs for automatic reminders (authenticated via CRON_SECRET)

### Database (Supabase PostgreSQL)

**Key Tables:**
- `user_profiles` - Employee data with app_role field
- `feedback_360_surveys` - Survey metadata
- `feedback_360_reviewers` - Survey participants
- `feedback_360_questions` - Question bank
- `feedback_360_survey_questions` - Survey-question junction
- `feedback_360_responses` - Survey answers
- `departments` - Department data

**Materialized Views:**
- `employees` - Active employees (includes app_role)
- `active_users` - User activity tracking

**Access Pattern:**
1. **Client Components:** Use `lib/supabase.ts` (respects RLS)
2. **Server Components/API:** Use `lib/supabase-admin.ts` (service role) or `lib/database.ts` (helpers)
3. **Type Safety:** Types from `lib/schema.ts` (no ORM layer)

---

## Authentication & Authorization

### Architecture
**Production Flow:** User → AI Intranet → Auth0 OAuth → JWT → This App

**Key Components:**
- `middleware.ts` - Route protection, JWT validation, mock user injection (dev mode)
- `lib/auth.ts` - Token validation, mock users, session helpers
- `lib/auth-wrapper.ts` - Client-side auth state, context providers
- `lib/auth-supabase.ts` - Syncs auth users to Supabase user_profiles

**Development Mode:**
Set `DISABLE_AUTH=true` to bypass authentication and inject mock user.

### Role-Based Access Control (RBAC)

| Role | 360 Survey Creation | Survey Deletion | Survey Modification | Survey Visibility |
|------|---------------------|-----------------|---------------------|-------------------|
| **Admin** | ✅ Yes | ✅ Own only | ✅ Any survey | All surveys |
| **SLT** | ✅ Yes | ✅ Own only | ✅ Own only | Own + direct reports + subject + reviewer |
| **Leader** | ❌ No | ❌ No | ✅ Own only | Own + direct reports + subject + reviewer |
| **User** | ❌ No | ❌ No | ✅ Own only | Own + subject + reviewer |

#### Survey Permissions by Role

**Survey Creation:**
- **Admin & SLT:** Can create surveys for any employee
- **Leader & User:** CANNOT create or sponsor surveys
- Enforced in: `/api/surveys/create`, `/api/surveys/save-draft`, `/api/surveys/update-draft`

**Survey Deletion:**
- **Admin & SLT:** Can delete surveys they created/sponsored
- **Leader & User:** Cannot delete surveys (they cannot create them)
- **No one** can delete another person's survey
- Enforced in: `/api/surveys/[id]` (DELETE method)

**Survey Modification:**
- **Admin:** Can modify any survey (status, name, due date, flags, etc.)
- **SLT, Leader, User:** Can only modify surveys they created/sponsored
- Enforced in: `/api/surveys/[id]` (PATCH method)

**Enforcement:**
- Client: Role-based filtering in Dashboard, Feedback360Dashboard
- Server: API routes validate role + ownership before operations
- Middleware: Validates all requests have authentication

**Session Management:**
- Cookies: `ai-intranet-session`, `ai-intranet-user`
- Cross-domain auth: `?auth_token=...` URL parameter
- Token validation: AI Intranet `/api/auth/validate-token` endpoint

---

## Major Features

### 1. 360° Feedback System
**Primary Components:**
- `Feedback360Dashboard.tsx` - Hub dashboard with role-based tabs (Sponsor | Reviewer | Subject)
- `Survey360Wizard.tsx` - Multi-step survey creation wizard
- `Quick360Modal.tsx` - Fast survey creation
- `CreateWithAIModal.tsx` - AI-powered survey generation
- `SurveyAIAssistant.tsx` - AI response helper

**Capabilities:**
- Survey creation with default + custom questions (configured via AdminSettings)
- Reviewer management (add/remove, email invitations)
- Draft saving/loading (persistent across sessions)
- Manual + automatic reminders (1-2 days before due date, configurable per survey)
- Anonymous feedback collection
- AI-powered response analysis and suggestions
- Survey status workflow: Draft → Active → Closed → Finalized (with revert option)
- PDF report generation

**Navigation:**
- Text-based tabs with underline indicator
- Status cards dynamically filtered by active role tab
- Statuses: Draft, In Progress, Completed, Needs Review, Needs Reanalysis, Finalized

### 2. Admin Settings Dashboard
**Location:** `components/AdminSettings.tsx`

**Employee Management:**
- Search-based interface (500px scrollable container)
- Inline editing: name, email, title, department, location, role
- Color-coded role badges (Purple: Admin, Teal: SLT, Blue: Leader, Gray: User)
- Soft delete (sets is_active=false)
- Changes persist to Supabase user_profiles

**360 Default Questions:**
- Configure 3 default questions for all surveys
- Browse categorized templates: Impact, Growth, Leadership, Collaboration, Performance, Value, Trust, General
- Create custom questions
- Settings persist to `/data/360-default-questions.json`

### 3. Employee Management
**Components:**
- `PeopleDashboard.tsx` - Directory container
- `EmployeeList.tsx` - Searchable grid/list with filters
- `EmployeeDetailModal.tsx` - 9-panel employee profile (OneOnOne, Retention, CriticalRole, etc.)
- `EmployeeCardUnified.tsx` - Reusable card with multiple layout variants (in unified/)

**Features:**
- Org chart visualization
- Department filtering
- Skills & capabilities tracking
- Import/export (CSV via PapaParse, JSZip)
- Manager relationships

### 4. AI Features
- **AI Coach** (`AICoachMicroPanel.tsx`) - Contextual assistance panel
- **Document Generation** - Action items (`lib/actionItemGenerator.ts`), survey insights (`lib/survey360Analyzer.ts`)
- **Analysis** - Review analysis (`lib/reviewAnalyzer.ts`)
- **AI-Assisted Responses** - `/api/ai/generate-survey-response`

---

## Component Architecture

### Organization
```
components/
├── Root/ - Feature-specific components
│   ├── Feedback360Dashboard.tsx (>1500 LOC)
│   ├── Survey360Wizard.tsx (>1500 LOC)
│   ├── EmployeeDetailModal.tsx (>1500 LOC)
│   ├── OneOnOneModal.tsx (>1500 LOC)
│   ├── AdminSettings.tsx (500-1500 LOC)
│   ├── RetentionPlanModal.tsx (500-1500 LOC)
│   └── ...other feature components
│
└── unified/ - Design system & reusable patterns
    ├── EmployeeCardUnified.tsx - Flexible card (4 layout variants)
    ├── BadgeSystem.tsx - Status indicators (8 badge types)
    ├── NavigationTabs.tsx - Tab navigation pattern
    ├── ModalLayout.tsx - Standardized modal wrapper
    ├── EmptyState.tsx - Consistent empty states
    ├── StatCard.tsx - Metric display cards
    ├── EmployeeNameLink.tsx - Context-aware employee links
    └── index.ts - Re-exports
```

### Component Hierarchy
```
Dashboard (Horizontal Layout)
├── Sidebar (nav + user profile/avatar)
└── Main Content:
    ├── PeopleDashboard → EmployeeList → EmployeeDetailModal (9 panels)
    ├── Feedback360Dashboard → Survey360Wizard/Quick360/CreateWithAI
    ├── AdminSettings (employee mgmt + default questions)
    └── InsightsPanel
```

### Key Patterns
✅ **Strengths:**
- Modular modal system with consistent ModalLayout base
- Unified design system components for consistency
- Context-driven navigation via EmployeeNameLink
- Three distinct AI integration points

⚠️ **Improvement Areas:**
- Large components (>1500 LOC) are refactoring candidates
- Modal nesting in EmployeeDetailModal (could use modal router)
- Prop drilling (more context providers recommended)
- Expand test coverage (Jest configured, needs more tests)

**For detailed component documentation, dependency graphs, and review sequences:** See [COMPONENTS.md](./docs/COMPONENTS.md)

---

## Configuration & Setup

### File-Based Settings
- `/data/360-default-questions.json` - Default survey questions (managed via AdminSettings)

### Configuration Files
| File | Purpose |
|------|---------|
| `next.config.mjs` | Next.js config (strict mode, transpile packages, build error handling) |
| `tailwind.config.ts` | Custom palette, grid templates, content paths |
| `tsconfig.json` | Strict mode, path aliases, ES2018 target |
| `vercel.json` | Deployment config, cron jobs |
| `jest.config.js` | Unit test config (50% coverage thresholds) |
| `playwright.config.ts` | E2E test config |

### NPM Scripts
| Script | Purpose |
|--------|---------|
| `dev` / `dev:local` / `dev:prod` | Dev server variants (via run-dev.sh) |
| `build` / `start` | Production build and start (port 3004) |
| `test` / `test:watch` / `test:coverage` | Jest unit tests |
| `e2e` / `e2e:ui` | Playwright E2E tests |
| `lint` | ESLint check |
| `setup-mcp` / `verify-db` / `mcp` | Database and MCP tooling |

**Note:** All dev scripts use `run-dev.sh` wrapper for environment variable loading and port configuration.

### MCP Integration
**GitHub MCP Server:** Configured for repository operations, code search, issue/PR management. Use `mcp_github_*` functions instead of manual git commands.

---

## Development Patterns

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

### Key Directories
```
talent-management-next/
├── app/           # Next.js app router
├── components/    # React components
├── lib/           # Utilities & services
├── context/       # React contexts
├── hooks/         # Custom hooks
├── scripts/       # Build/dev scripts
├── data/          # Runtime data (JSON settings)
├── types/         # TypeScript types
└── public/        # Static assets
```

### Best Practices
| Area | Practice |
|------|----------|
| **TypeScript** | Strict mode, full type coverage, Zod validation, types from lib/schema.ts |
| **React** | Functional components, hooks for state, Server Components default, clear client/server boundaries |
| **Styling** | Tailwind utilities, consistent design tokens, responsive, accessible |
| **Database** | Type-safe Supabase SDK queries (no ORM), materialized views for performance, proper indexing |
| **Security** | Environment validation, auth middleware, RBAC, secure API endpoints |

---

## Deployment

### Naming & URLs
- **Local Directory:** `talent-management-next`
- **GitHub Repo:** https://github.com/tcpalm-r/talent-management-app-next-fork
- **Vercel Project:** `sonance-360-review`
- **Production URL:** https://sonance-360-review.vercel.app

### Deployment Strategy
| Branch | Behavior |
|--------|----------|
| `main` | → Preview deployment (automatic) |
| Other branches | → Preview deployments (automatic) |
| Production | → Manual promotion via Vercel Dashboard |

**Production Deployment Process:**
1. Push changes to `main` (creates preview)
2. Test preview thoroughly
3. Go to [Vercel Dashboard](https://vercel.com/elliottamadors-projects/sonance-360-review)
4. Find preview deployment → Click "Promote to Production"

**Why This Setup:** Prevents accidental production deployments, allows thorough preview testing, provides explicit production control.

**Git Push Policy:** Always commit first, then ask user before pushing.

### Runtime Requirements
- **Node.js:** 20+
- **Port:** 3004 (dev and prod)
- **Environment Modes:** LOCAL_TESTING_MODE (dev with mocks) or Production

---

## Troubleshooting

### Common Issues
| Issue | Solution |
|-------|----------|
| Auth not working | Check `DISABLE_AUTH` env var, verify AI Intranet config |
| Database connection | Verify Supabase credentials in env |
| Build errors | Clear `.next/` directory and rebuild |
| Type errors | Run `npm run lint`, check imports |

### Debug Mode
- Use `dev:local` for local testing with mock auth
- Check `middleware.ts` for auth bypass logic
- Enable console logging in development
- Use `/api/debug/env` endpoint (dev only)

---

## Future Enhancements

| Area | Potential Improvements |
|------|------------------------|
| **Testing** | Expand Jest coverage, add component tests, more E2E scenarios |
| **Database** | Migrate file-based settings to DB, add migrations framework |
| **Performance** | Implement caching strategy, optimize bundle size, add monitoring |
| **Features** | Advanced analytics, custom report builder, mobile app, offline support |

---

## Additional Resources

### Documentation
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Auth0: https://auth0.com/docs
- Anthropic: https://docs.anthropic.com

### Internal Docs
- Migration scripts in project root
- Schema definitions in `lib/schema.ts`
- API documentation in route files
- Component JSDoc comments

---

**For detailed documentation:**
- Authentication setup and flows → [AUTHENTICATION.md](./docs/AUTHENTICATION.md)
- API endpoint specifications → [API.md](./docs/API.md)
- Component architecture deep-dive → [COMPONENTS.md](./docs/COMPONENTS.md)
- Environment variable guide → [ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- Deployment workflows → [DEPLOYMENT.md](./docs/DEPLOYMENT.md)
