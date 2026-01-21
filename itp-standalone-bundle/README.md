# ITP Standalone App Bundle

This bundle contains everything needed to create a standalone ITP (Ideal Team Player) self-assessment app that connects to your existing Supabase backend.

## Contents

```
itp-standalone-bundle/
├── README.md                          # This file
├── ITP_IMPLEMENTATION_SPEC.md         # Complete spec for Claude Code
└── code-bundle/
    ├── create_itp_tables.sql          # Database schema (already exists)
    ├── lib/
    │   └── itpBehaviors.ts            # Behavior definitions (COPY EXACTLY)
    ├── types/
    │   └── itp.ts                     # TypeScript type definitions
    ├── components/
    │   ├── ITPSelfAssessment.tsx      # Main container component
    │   ├── ITPVirtueSection.tsx       # Section for each virtue
    │   ├── ITPBehaviorSlider.tsx      # 5-point slider component
    │   ├── ITPAssessmentHistory.tsx   # Past assessments view
    │   └── ITPDashboard.tsx           # Simple dashboard wrapper
    └── api/
        └── itp/
            └── assessments/
                ├── route.ts           # GET list, POST create
                └── [id]/
                    ├── route.ts       # GET single, DELETE
                    ├── save-draft/
                    │   └── route.ts   # POST auto-save
                    └── submit/
                        └── route.ts   # POST submit
```

## Authentication

The standalone app uses **simple Supabase Auth** with magic links:
- Users enter their `@sonance.com` email
- Supabase sends a magic link
- User clicks link and is authenticated
- App looks up their profile in `user_profiles` table

This is much simpler than the full Sonance hub integration in the parent app.

## Quick Start

```bash
# Create new Next.js project
npx create-next-app@latest itp-app --typescript --tailwind --eslint --app --src-dir

# Install dependencies
cd itp-app
npm install @supabase/supabase-js @supabase/ssr lucide-react

# Copy the spec and behavior definitions
cp /path/to/itp-standalone-bundle/ITP_IMPLEMENTATION_SPEC.md ./
cp /path/to/itp-standalone-bundle/code-bundle/lib/itpBehaviors.ts src/lib/

# Create .env.local with your Supabase credentials
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF

# Start Claude Code and implement
claude
> Implement the ITP app according to ITP_IMPLEMENTATION_SPEC.md
```

## Environment Variables

Create `.env.local` with your Supabase credentials (same as talent-management-next):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Important Notes

1. **Database tables already exist** - Don't run the migration
2. **Same Supabase instance** - Use the same credentials as talent-management-next
3. **Copy `itpBehaviors.ts` exactly** - This contains all the behavior definitions
4. **Auth is simplified** - Uses Supabase magic link instead of Sonance hub SSO
5. **Only @sonance.com emails** - Validate on the login page

## What Claude Code Needs

Give Claude Code:
1. The `ITP_IMPLEMENTATION_SPEC.md` file
2. Copy `code-bundle/lib/itpBehaviors.ts` to `src/lib/`
3. Reference the component code in `code-bundle/components/` for UI patterns

The spec contains everything: auth flow, database schema, API endpoints, UI requirements, and complete behavior definitions.
