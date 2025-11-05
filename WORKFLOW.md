# Development Workflow Guide

## Overview
This document outlines the git workflow, CI/CD process, and deployment strategy for the Talent Management Next app.

---

## Branch Strategy

### Branch Structure
```
main (production)
  ↳ feature/feature-name
  ↳ fix/bug-description
  ↳ chore/task-description
```

### Branch Naming Conventions
- `feature/*` - New features
- `fix/*` - Bug fixes
- `chore/*` - Maintenance tasks
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring

---

## Daily Development Workflow

### 1. Starting a New Feature

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-user-dashboard

# Verify you're on the right branch
git branch --show-current
```

### 2. Development Cycle

```bash
# Make changes to code
# ...

# Check what changed
git status
git diff

# Stage and commit frequently
git add .
git commit -m "feat(dashboard): add user stats component"

# Push to GitHub (triggers CI validation - NO deployment)
git push origin feature/add-user-dashboard
```

**What happens on push:**
- ✅ GitHub Actions CI runs (linting, type checking, build, tests)
- ✅ Security checks run
- ❌ NO Vercel deployment (only main branch deploys)

### 3. Pre-Push Checklist

Before pushing, always run locally:

```bash
npm run lint          # ESLint + TypeScript checks
npm run build         # Verify build succeeds
npm run test          # Run unit tests (if applicable)
```

### 4. Creating a Pull Request

```bash
# Ensure all changes are pushed
git push origin feature/add-user-dashboard

# Create PR via GitHub CLI
gh pr create \
  --title "feat: Add user dashboard with stats" \
  --body "## Summary
- Adds new user dashboard component
- Displays user activity stats
- Responsive design

## Testing
- [x] Build passes locally
- [x] Tested in dev:local mode
- [x] Tested in dev:prod mode
- [ ] Reviewed by team

## Screenshots
[Add screenshots if applicable]"

# Or create via GitHub web interface
```

**What happens on PR:**
- ✅ GitHub Actions CI runs again
- ✅ Commit message validation (Conventional Commits)
- ✅ Build artifacts validated
- ✅ PR comments with testing checklist

### 5. Merging to Main (Deployment)

**Before merging:**
- ✅ CI checks must pass
- ✅ Code review approved (if team review enabled)
- ✅ Branch is up to date with main
- ✅ No merge conflicts

**Merge process:**
```bash
# Via GitHub web interface: Click "Merge Pull Request"
# OR via CLI:
gh pr merge --squash --delete-branch

# After merge, update local main
git checkout main
git pull origin main
```

**What happens on merge to main:**
- ✅ GitHub Actions CI runs final validation
- ✅ **Vercel automatically deploys to production**
- ✅ Deployment URL: https://employee-self-assessment.vercel.app

---

## Commit Message Guidelines

We follow **Conventional Commits** format:

### Format
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style (formatting, no logic change)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test additions/updates
- `chore` - Maintenance tasks
- `ci` - CI/CD changes

### Examples
```bash
git commit -m "feat(360-surveys): add survey export functionality"
git commit -m "fix(auth): resolve login redirect issue"
git commit -m "docs: update API documentation"
git commit -m "chore(deps): update dependencies"
```

---

## Deployment Configuration

### Vercel Settings (via vercel.json)

**Current configuration:**
- Production branch: `main` ONLY
- All other branches: NO auto-deploy
- Build command: `npm run build`
- Framework: Next.js

### Environment Variables (Vercel Dashboard)

Required for production:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH0_SECRET
AUTH0_BASE_URL
AUTH0_ISSUER_BASE_URL
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET
ANTHROPIC_API_KEY
RESEND_API_KEY
AI_INTRANET_URL_LOCAL
AI_INTRANET_URL_PROD
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. CI (Runs on ALL branches)
- **Trigger:** Push to any branch, PR to main
- **Jobs:**
  - Code Quality (linting, type checking)
  - Unit Tests
  - Security Audit
  - Build Verification

#### 2. Preview Deploy
- **Trigger:** PR creation/update
- **Action:** Posts testing checklist comment

#### 3. Commit Lint
- **Trigger:** PR creation/update
- **Action:** Validates commit message format

#### 4. E2E Tests
- **Trigger:** Push/PR to main or develop, daily at 2 AM
- **Action:** Runs Playwright E2E tests

#### 5. Dependency Updates
- **Trigger:** Weekly on Monday at 9 AM UTC
- **Action:** Creates automated PR with dependency updates

---

## Testing Strategy

### Local Testing

```bash
# Local development with mock data
npm run dev:local

# Local development with production services
npm run dev:prod

# Production build test
npm run build
npm run start
```

### Pre-deployment Checklist

Before merging to main:
- [ ] All CI checks passing
- [ ] Build succeeds locally (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tested in dev:local mode
- [ ] Tested in dev:prod mode
- [ ] No console errors in browser
- [ ] Responsive design verified
- [ ] Database queries work correctly
- [ ] Auth flow works (if applicable)

---

## Hotfix Workflow

For urgent production fixes:

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b fix/critical-auth-bug

# Make minimal, focused fix
# ...

# Test thoroughly
npm run build
npm run dev:prod

# Push and create PR (mark as urgent)
git push origin fix/critical-auth-bug
gh pr create --title "fix: Critical auth bug" --label urgent

# After approval, merge immediately
gh pr merge --squash --delete-branch
```

---

## Rollback Procedure

If deployment breaks production:

```bash
# Option 1: Revert via GitHub
gh pr revert <PR_NUMBER>

# Option 2: Revert locally
git checkout main
git pull origin main
git revert <commit_hash>
git push origin main

# Option 3: Rollback in Vercel Dashboard
# Go to Vercel → Deployments → Click previous deployment → Promote
```

---

## Best Practices

### Do:
✅ Commit frequently with descriptive messages
✅ Push to feature branch often (triggers CI validation)
✅ Run `npm run build` before creating PR
✅ Keep PRs focused and small
✅ Delete merged branches
✅ Review CI output before merging
✅ Test thoroughly in dev:prod mode

### Don't:
❌ Push directly to main
❌ Skip CI validation
❌ Create large, multi-purpose commits
❌ Merge with failing CI checks
❌ Commit sensitive data (.env files)
❌ Skip local testing before push
❌ Use generic commit messages ("fix stuff")

---

## Troubleshooting

### CI Failing

**TypeScript errors:**
```bash
npm run lint
npx tsc --noEmit
```

**Build errors:**
```bash
rm -rf .next
npm ci
npm run build
```

**Test failures:**
```bash
npm test
```

### Deployment Failing

**Check Vercel logs:**
1. Go to Vercel dashboard
2. Click on failed deployment
3. Review build logs
4. Check environment variables

**Verify environment variables:**
```bash
# In Vercel dashboard, ensure all required env vars are set
# See "Environment Variables" section above
```

### Merge Conflicts

```bash
# Update your branch with latest main
git checkout feature/your-branch
git fetch origin main
git merge origin/main

# Resolve conflicts in your editor
# ...

# Complete merge
git add .
git commit -m "chore: merge main into feature branch"
git push origin feature/your-branch
```

---

## Additional Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## Quick Reference Commands

```bash
# Start new feature
git checkout -b feature/name

# Daily workflow
git add .
git commit -m "feat: description"
git push

# Create PR
gh pr create

# Merge PR
gh pr merge --squash --delete-branch

# Update main locally
git checkout main && git pull

# Check branch
git branch --show-current

# View CI status
gh pr checks
```

---

Last Updated: 2025-11-04
