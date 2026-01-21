# ITP Self-Assessment Standalone App - Implementation Specification

## Overview

Build a standalone Next.js app for **ITP (Ideal Team Player)** self-assessments based on Patrick Lencioni's framework. This app connects to an existing Supabase backend that already has the required database tables.

The ITP framework evaluates employees across **3 virtues** with **4 behaviors each** (12 total), using a 5-point scale from "Not Living" to "Role Modeling".

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (existing instance - credentials will be provided)
- **Auth**: Supabase Auth (magic link with @sonance.com emails only)
- **Icons**: lucide-react

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=<will be provided>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<will be provided>
SUPABASE_SERVICE_ROLE_KEY=<will be provided>
```

---

## Authentication (Simple Approach)

### Requirements
- Users authenticate via **magic link** sent to their Sonance email
- Only `@sonance.com` email addresses are allowed
- After auth, look up the user in `user_profiles` table by email to get their `id`
- Store session in cookie, check on each request

### Auth Flow
1. User enters their Sonance email on login page
2. Validate email ends with `@sonance.com`
3. Send magic link via Supabase Auth
4. User clicks link, Supabase validates and redirects back
5. On callback, look up user in `user_profiles` by email
6. Store user info in session/cookie
7. Redirect to assessment page

### Middleware
- Check for valid Supabase session on protected routes
- If no session, redirect to `/login`
- Pass user data to API routes via headers or context

### Key Auth Code Pattern

```typescript
// lib/supabase.ts - Browser client
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// lib/supabase-admin.ts - Server client (bypasses RLS)
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// lib/auth.ts - Get authenticated user for API routes
import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

export async function getAuthenticatedUser(request: NextRequest) {
  // Get session from cookie or Authorization header
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    // Try getting from Supabase session cookie
    const supabaseCookie = request.cookies.get('sb-access-token')?.value;
    if (!supabaseCookie) return null;
  }

  // Verify with Supabase and get user
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  // Look up full profile from user_profiles
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, app_role, manager_id, manager_email')
    .eq('email', user.email)
    .single();

  return profile;
}
```

### Login Page Flow

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Sonance email
    if (!email.toLowerCase().endsWith('@sonance.com')) {
      setError('Please use your @sonance.com email address');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  // ... render form
}
```

---

## Database Schema (Already Exists - Do Not Create)

The following tables already exist in the Supabase database:

### `user_profiles` Table (Relevant Fields)
```sql
id UUID PRIMARY KEY
email TEXT
full_name TEXT
app_role TEXT  -- 'admin', 'leader', 'slt', 'user'
manager_id UUID
manager_email TEXT
```

### `itp_assessments` Table
```sql
CREATE TABLE itp_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'archived')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### `itp_responses` Table
```sql
CREATE TABLE itp_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES itp_assessments(id) ON DELETE CASCADE NOT NULL,
    behavior_key TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assessment_id, behavior_key)
);
```

---

## ITP Behaviors Data (Critical - Include This Exactly)

### The Three Virtues

1. **Humble** (Blue theme) - `#1d4ed8` / `bg-blue-*`
2. **Hungry** (Orange theme) - `#ea580c` / `bg-orange-*`
3. **People Smart** (Purple theme) - `#7c3aed` / `bg-purple-*`

### Complete Behavior Definitions (12 Total)

```typescript
// HUMBLE (4 behaviors)

1. Recognition
   - Key: 'recognition'
   - Not Living: "Mostly concerned with personal accomplishments rather than team accomplishments"
   - Living: "Proactively recognizes team accomplishments vs individual accomplishments"
   - Role Modeling: "Encourages others to recognize team accomplishments and always refers to 'we' when we succeed and 'I' when we fail"

2. Collaboration
   - Key: 'collaboration'
   - Not Living: "Resists collaboration out of arrogance, fear, or insecurity. Often thinks, 'I knew that wouldn't work' or says, 'Well I could have told you that'"
   - Living: "Collaborates, asks others for input, and is comfortable being challenged"
   - Role Modeling: "Creates an environment where everyone feels comfortable to contribute and share their ideas"

3. Handling Mistakes
   - Key: 'handling_mistakes'
   - Not Living: "Does not easily admit mistakes, quick to make excuses, and is generally defensive when receiving feedback"
   - Living: "Easily admits mistakes and learns from each of them"
   - Role Modeling: "Proactively owns mistakes and demonstrates to others how admitting and 'owning' mistakes can build trust - not erode it"

4. Communication
   - Key: 'communication'
   - Not Living: "Uses absolute terms like: 'Always', 'Never', 'Certainly', or 'Undoubtedly'"
   - Living: "Uses words like: 'Perhaps', 'I think', and 'My gut says that'"
   - Role Modeling: "Is very comfortable saying: 'I don't know' or 'I could use your input'"

// HUNGRY (4 behaviors)

5. Initiative
   - Key: 'initiative'
   - Not Living: "Does the bare minimum to get by"
   - Living: "Quick to jump in to the next initiative or opportunity with enthusiasm and passion"
   - Role Modeling: "My passion for my work and the Team could be described as 'contagious'"

6. Passion
   - Key: 'passion'
   - Not Living: "Is indifferent about our products, customers, and our team. Avoids interactions with customers and team members"
   - Living: "Is passionate about what we do, our customer's businesses, and team member's lives"
   - Role Modeling: "Engages with our customers and employees and displays passion for our products, our customers, and teammates"

7. Drive
   - Key: 'drive'
   - Not Living: "Has a 'That's not my job' attitude"
   - Living: "Willing to take on tedious or challenging tasks whenever necessary"
   - Role Modeling: "Looks for opportunities to do both high level and low level tasks - coaches others to do the same"

8. Connects To Company Goals
   - Key: 'connects_to_company_goals'
   - Not Living: "Struggles to tie individual responsibilities to company goals - eager for opportunity but may struggle understanding the bigger picture"
   - Living: "Easily connects the work of self and others to the company's goals"
   - Role Modeling: "Helps others find ways to contribute to the team and actively looks for next projects/areas to tackle"

// PEOPLE SMART (4 behaviors)

9. Adaptability
   - Key: 'adaptability'
   - Not Living: "Often offends others; unable to 'read the room'"
   - Living: "Can quickly assess the room and alter delivery on the spot to appeal to the audience"
   - Role Modeling: "Helps others learn to adapt to different personality styles and situations"

10. Focus
    - Key: 'focus'
    - Not Living: "Too focused on office politics and gossip"
    - Living: "Focuses on the important things and ignores office politics and gossip"
    - Role Modeling: "Calls it out when people are focusing on office politics or gossip and draws people's focus back to the Team's initiatives"

11. Conflict Resolution
    - Key: 'conflict_resolution'
    - Not Living: "Hesitates to address conflict and/or avoids uncomfortable situations"
    - Living: "Participates in constructive conflict to drive for resolution"
    - Role Modeling: "Drives constructive conflict and productive debate to help produce the best outcome"

12. Skill Identification
    - Key: 'skill_identification'
    - Not Living: "Fails to recognize and appreciate others skills and experiences"
    - Living: "Values the skills and experience of others and asks them to weigh in"
    - Role Modeling: "Seeks to learn more about others skills/experiences and helps them find ways to contribute to the Team and the discussion"
```

### Rating Scale

| Rating | Label | Description |
|--------|-------|-------------|
| 1 | Not Living | Shows the negative behavior pattern |
| 2 | (unlabeled) | Between Not Living and Living |
| 3 | Living | Demonstrates the positive behavior |
| 4 | (unlabeled) | Between Living and Role Modeling |
| 5 | Role Modeling | Exemplary, teaches others |

---

## Features Required

### 1. Authentication
- Login page with email input
- Validate email is `@sonance.com`
- Magic link via Supabase Auth
- Auth callback handler
- Protected routes via middleware
- Logout functionality

### 2. Self-Assessment Flow

**Start New Assessment**
- User clicks "Start Self-Assessment"
- Creates new `itp_assessments` record with `status: 'draft'`
- Only one draft allowed per user at a time

**Rate Behaviors**
- Display all 12 behaviors grouped by virtue (Humble, Hungry, People Smart)
- Each behavior shows:
  - Behavior name
  - All three level descriptions (Not Living, Living, Role Modeling) visible simultaneously
  - 5-point slider with snapping to integer values
- User can rate in any order

**Auto-Save (Critical)**
- After user stops interacting for 2 seconds, auto-save all changed responses
- Show save status indicator: "Saving..." / "Saved" / "Save failed"
- Also save immediately on page visibility change (tab switch, close)

**Submit Assessment**
- Validate all 12 behaviors are rated
- If incomplete, show which behaviors are missing
- On submit:
  1. Archive any previously submitted assessment (set `status: 'archived'`)
  2. Update current assessment to `status: 'submitted'`, set `submitted_at`

### 3. View Assessment

**Submitted Assessment View**
- Read-only view of submitted ratings
- Show ratings grouped by virtue
- Display submitted date
- Option to start new assessment (archives current)

**Assessment History**
- List of past (archived) assessments
- Expandable to show full ratings
- Show date and overall average

### 4. Authorization Rules

| Action | Self | Manager | Admin |
|--------|------|---------|-------|
| View assessments | Yes | Yes (direct reports) | Yes (all) |
| Create assessment | Yes | No | Yes |
| Edit draft | Yes | No | Yes |
| Submit assessment | Yes | No | Yes |
| Delete draft | Yes | No | Yes |

Manager check: `user_profiles.manager_id === currentUser.id` OR `user_profiles.manager_email === currentUser.email`

---

## API Endpoints

### `GET /api/itp/assessments?employee_id=<uuid>`
Returns all assessments for an employee with their responses.

### `POST /api/itp/assessments`
Creates a new draft assessment.

**Request:**
```json
{ "employee_id": "uuid" }
```

### `POST /api/itp/assessments/[id]/save-draft`
Auto-saves responses to a draft assessment.

**Request:**
```json
{
  "responses": [
    { "behaviorKey": "recognition", "rating": 4 },
    { "behaviorKey": "collaboration", "rating": 3 }
  ]
}
```

### `POST /api/itp/assessments/[id]/submit`
Submits a completed assessment.

### `DELETE /api/itp/assessments/[id]`
Deletes a draft assessment (for reset functionality).

---

## UI Requirements

### Layout
- Clean, modern single-page design
- Header with app title, user info, and logout button
- Main content area for assessment
- Responsive (works on mobile)

### Login Page
- Sonance branding
- Email input field
- "Send Magic Link" button
- Error/success messages
- Note about @sonance.com requirement

### Virtue Sections
- Each virtue in its own card/section
- Color-coded borders/backgrounds:
  - Humble: Blue (`border-blue-200`, `bg-blue-50`)
  - Hungry: Orange (`border-orange-200`, `bg-orange-50`)
  - People Smart: Purple (`border-purple-200`, `bg-purple-50`)

### Behavior Slider Component
- 5-point horizontal slider
- Snaps to integer values on release
- Shows all 3 descriptions above slider in 3 columns
- Clickable dots at each position
- Smooth thumb animation

### Progress Indicator
- Bar showing X/12 behaviors rated
- Changes color when complete (blue -> green)

### Save Status
- Small indicator near header
- States: idle, "Saving...", "Saved", "Save failed"

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Main assessment page (protected)
│   ├── login/
│   │   └── page.tsx               # Login page
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts           # Supabase auth callback
│   └── api/
│       └── itp/
│           └── assessments/
│               ├── route.ts        # GET list, POST create
│               └── [id]/
│                   ├── route.ts    # GET single, DELETE
│                   ├── save-draft/
│                   │   └── route.ts
│                   └── submit/
│                       └── route.ts
├── components/
│   ├── ITPSelfAssessment.tsx      # Main container
│   ├── ITPVirtueSection.tsx       # Section for each virtue
│   ├── ITPBehaviorSlider.tsx      # Individual slider
│   └── ITPAssessmentHistory.tsx   # Past assessments view
├── lib/
│   ├── supabase.ts                # Browser client
│   ├── supabase-admin.ts          # Server client (service role)
│   ├── auth.ts                    # getAuthenticatedUser helper
│   └── itpBehaviors.ts            # Behavior definitions
├── middleware.ts                   # Auth middleware
└── types/
    └── index.ts                   # TypeScript types
```

---

## Reference Implementation

The `code-bundle/` directory contains the exact implementation from the parent app. Key files:

1. **`lib/itpBehaviors.ts`** - Behavior definitions (COPY EXACTLY)
2. **`types/itp.ts`** - TypeScript type definitions
3. **`components/`** - All UI components
4. **`api/`** - API route implementations

The API routes use `getAuthenticatedUser()` - you'll implement a simpler version using Supabase Auth.

---

## Getting Started

```bash
# Create new Next.js project
npx create-next-app@latest itp-app --typescript --tailwind --eslint --app --src-dir

# Install dependencies
cd itp-app
npm install @supabase/supabase-js @supabase/ssr lucide-react

# Copy the behavior definitions
cp ../itp-standalone-bundle/code-bundle/lib/itpBehaviors.ts src/lib/

# Set up environment variables
# Create .env.local with Supabase credentials

# Start development
npm run dev
```

Then tell Claude Code:
> Implement the ITP app according to ITP_IMPLEMENTATION_SPEC.md. Start with auth (Supabase magic link for @sonance.com emails), then build the assessment UI.
