# Talent Management App - Next.js 14

This is the Next.js 14 version of the 9-Box Talent Assessment application, converted from the original Vite React project.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account with database set up
- Anthropic API key (optional, for AI features)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**

Copy the example env file and fill in your credentials:
```bash
cp .env.local.example .env.local
```

Update `.env.local` with your credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_key
```

3. **Set up the database:**

Run the following SQL files in your Supabase SQL Editor (in this order):
- `supabase-schema.sql` - Creates all tables
- `supabase-seed.sql` - Seeds test data (15 employees, 5 departments, etc.)

4. **Start the development server:**
```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## 📦 Project Structure

```
talent-management-next/
├── app/
│   ├── AppWrapper.tsx    # Main client component wrapper
│   ├── layout.tsx        # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/          # All React components (from original project)
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and services
├── types/              # TypeScript type definitions
├── config/             # Configuration files
├── supabase-schema.sql # Database schema
└── supabase-seed.sql   # Test data
```

## 🔑 Key Changes from Vite Version

### Environment Variables
- Changed from `VITE_*` to `NEXT_PUBLIC_*` prefix
- Moved from `import.meta.env` to `process.env`

### File Structure
- Moved from `src/` to Next.js App Router structure
- Components remain the same, just with updated imports
- Added `'use client'` directive to AppWrapper

### Imports
- Updated all relative imports to use `@/*` alias
- Changed `./lib/supabase` to `@/lib/supabase`
- Changed `./types` to `@/types`

### Configuration
- Replaced `vite.config.ts` with `next.config.mjs`
- Updated `tailwind.config.ts` to include new directories
- Removed Vite-specific build tools

## 🎯 Features

- **9-Box Talent Grid** - Drag & drop employees across performance/potential matrix
- **Real Supabase Database** - Persistent data storage
- **No Authentication** - Direct database access for testing
- **15 Test Employees** - Pre-seeded sample data
- **5 Departments** - Engineering, Sales, Marketing, HR, Finance
- **Modal Cell Views** - Click any cell to see detailed employee information
- **AI-Powered Features** - (Requires Anthropic API key)
  - Performance review analysis
  - Conversation coaching
  - 360 feedback generation

## 🛠️ Available Scripts

```bash
# Development
npm run dev          # Start dev server on port 3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## 🗄️ Database

The app uses Supabase with the following main tables:
- `organizations` - Company/organization data
- `departments` - Department information with colors
- `employees` - Employee records
- `assessments` - Performance/potential ratings
- `box_definitions` - 9-box grid configuration

Fixed Organization ID: `f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f`

## 🎨 Styling

- **Tailwind CSS 4** - Utility-first CSS framework
- **Custom CSS Variables** - Design system tokens
- **Responsive Design** - Mobile-friendly layouts
- **Custom Animations** - Smooth transitions and effects

## 🔧 Configuration Files

- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `.env.local` - Environment variables (git-ignored)

## 📝 Notes

- Port 3000 is configured by default
- React Strict Mode is enabled
- All components are now compatible with Next.js App Router
- Server-side rendering is not used (all client components)

## 🐛 Troubleshooting

**Blank page or errors?**
1. Check browser console for JavaScript errors
2. Verify environment variables are set correctly
3. Ensure Supabase tables are created
4. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+F5)

**Database connection issues?**
1. Verify Supabase URL and key in `.env.local`
2. Check that schema and seed SQL files have been run
3. Ensure network access to Supabase

**Build errors?**
1. Delete `.next` folder and rebuild
2. Clear npm cache: `npm cache clean --force`
3. Reinstall dependencies: `rm -rf node_modules && npm install`

## 📚 Migration from Vite

This project was migrated from Vite to Next.js 14. All original functionality has been preserved:
- ✅ All 119 TypeScript files migrated
- ✅ All components, hooks, and context providers retained
- ✅ Supabase integration updated for Next.js
- ✅ Tailwind CSS configuration preserved
- ✅ Custom styling and animations maintained

## 🤝 Contributing

When making changes:
1. Follow the existing code structure
2. Use TypeScript for type safety
3. Test all database operations
4. Ensure responsive design works
5. Update this README if needed

## 📄 License

This is a private project for talent management and assessment.
