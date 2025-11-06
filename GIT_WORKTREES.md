# Git Worktrees Setup

This document describes the git worktree structure for parallel development.

## Current Worktrees

All worktrees are located in `/Users/thomas.palmer/.cursor/worktrees/talent-management-next/`:

1. **main** - `/Users/thomas.palmer/talent-management-next`
   - Production-ready code
   - Only merge PRs here

2. **feature/360-feedback** - `../feature-360-feedback`
   - 360° Feedback System development
   - Components: Feedback360Dashboard, Survey360Wizard, Quick360Modal, CreateWithAIModal

3. **feature/employee-management** - `../feature-employee-management`
   - Employee directory and profiles
   - Components: EmployeeList, EmployeeDetailModal, PeopleDashboard

4. **feature/performance-development** - `../feature-performance-development`
   - Performance review workflows
   - Components: OneOnOneModal, RetentionPlanModal, CriticalRoleSetupModal

5. **refactor/large-components** - `../refactor-large-components`
   - Refactoring large components (>1,500 LOC each)
   - Component decomposition work

6. **fix/bugs** - `../fix-bugs`
   - Bug fixes and hotfixes
   - Production issue resolution

7. **fix/ui** - `../fix-ui`
   - UI/UX fixes and improvements
   - Styling, layout, and visual polish
   - Component design system updates
   - Responsive design fixes
   - Accessibility improvements

8. **test/coverage** - `../test-coverage`
   - Test development and improvements
   - Jest unit tests and Playwright E2E tests

9. **docs/documentation** - `../docs-documentation`
   - Documentation updates
   - Component and API documentation

10. **chore/dependencies** - `../chore-dependencies`
    - Dependency updates
    - Security patches

11. **infra/database** - Current worktree (`8h3lo`)
    - Database migrations
    - Schema changes
    - Supabase optimizations

## Quick Commands

### List all worktrees
```bash
git worktree list
```

### Switch to a worktree
```bash
cd ../feature-360-feedback
# or for UI fixes:
cd ../fix-ui
```

### Create new branch in worktree
```bash
cd ../feature-360-feedback
git checkout -b feature/new-subfeature
```

### Sync with main
```bash
git fetch origin main
git merge origin/main
```

### Remove a worktree (after branch is merged)
```bash
git worktree remove ../feature-360-feedback
```

## Running Multiple Dev Servers

Each worktree can run its own dev server on different ports:

```bash
# In feature-360-feedback worktree
npm run dev:360  # Runs on port 3005

# In feature-employee-management worktree
npm run dev:employee  # Runs on port 3006

# In feature-performance-development worktree
npm run dev:performance  # Runs on port 3007

# Default (any worktree)
npm run dev  # Runs on port 3004
```

## Port Configuration

- Default: `3004` (main worktree)
- 360 Feedback: `3005`
- Employee Management: `3006`
- Performance Development: `3007`

You can override ports using the PORT environment variable:
```bash
PORT=3010 npm run dev
```

## Best Practices

1. **Regular Sync**: Periodically merge `main` into feature branches
2. **Cleanup**: Remove worktrees when branches are merged
3. **Port Management**: Use different ports per worktree if running multiple dev servers
4. **Environment**: Each worktree shares the same `.env` file (be aware of conflicts)
5. **Branch Naming**: Follow existing convention (`feature/*`, `fix/*`, `refactor/*`, etc.)

## Workflow Benefits

- **Parallel Development**: Work on multiple features simultaneously
- **Context Switching**: Switch between worktrees instantly (no stashing)
- **CI/CD Integration**: Each worktree can push to its branch independently
- **No Conflicts**: Independent development without blocking each other

