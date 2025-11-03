# Testing & CI/CD Guide

This document outlines the testing strategy and CI/CD workflows for the Talent Management application.

## Local Testing

### Unit Tests (Jest)

Run unit tests for utility functions, business logic, and components:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Generate coverage report
npm test:coverage
```

**Test files** are located in `__tests__/` directory and follow the `.test.ts` or `.spec.ts` naming convention.

### E2E Tests (Playwright)

Run end-to-end tests for critical user workflows:

```bash
# Run E2E tests
npm run e2e

# Run with UI mode (interactive)
npm run e2e:ui

# Run specific test file
npx playwright test e2e/360-survey.spec.ts

# Run with debug mode
PWDEBUG=1 npm run e2e
```

**Test files** are located in `e2e/` directory and follow the `.spec.ts` naming convention.

### Test Coverage

Coverage reports are generated in the `coverage/` directory:

```bash
npm test:coverage
open coverage/lcov-report/index.html
```

**Coverage Thresholds:**
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

## CI/CD Workflows

### Main CI Workflow (`ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**
1. **Code Quality** - Linting, type checking, unused code detection
2. **Unit Tests** - Jest tests with coverage reporting
3. **Build** - Next.js build verification
4. **Security** - npm audit, CodeQL scanning, secret detection
5. **Performance** - Bundle size analysis, accessibility checks
6. **Environment** - Configuration validation

### E2E Workflow (`e2e.yml`)

Runs E2E tests on schedule and for pull requests.

**Features:**
- Runs on multiple browsers (Chrome, Firefox, Safari)
- Scheduled daily at 2 AM UTC
- Generates HTML test reports
- Comments test results on PRs

### Dependency Updates (`dependencies.yml`)

Automatically checks for and updates dependencies weekly.

**Features:**
- Runs every Monday at 9 AM UTC
- Creates PR with updated dependencies
- Includes vulnerability audit
- Can be triggered manually

### Commit Linting (`commit-lint.yml`)

Validates commit messages follow Conventional Commits format.

**Valid Types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `style:` - Code style
- `refactor:` - Refactoring
- `perf:` - Performance
- `test:` - Tests
- `ci:` - CI/CD
- `chore:` - Maintenance

**Example Commits:**
```
feat(360-surveys): add survey export functionality
fix(employee-modal): resolve null reference error
docs: update README with API docs
chore: update dependencies
```

### Preview Deploy (`preview-deploy.yml`)

Builds and validates preview deployments for PRs.

**Features:**
- Builds on every PR
- Validates build artifacts
- Comments preview URL on PR
- Can be connected to Vercel, Netlify, etc.

## Key Metrics

### Code Coverage

We aim to maintain **50%+** coverage for:
- Core business logic
- Utility functions
- Shared components
- API routes

### Performance

- **Bundle Size:** < 200MB
- **LCP:** < 3 seconds
- **FCP:** < 2 seconds

### Security

- No hardcoded secrets
- npm audit: moderate or higher
- CodeQL scanning enabled
- SAST checks on all code

## GitHub Secrets Configuration

The following secrets must be configured in your GitHub repository:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
AI_INTRANET_URL_LOCAL
AI_INTRANET_URL_PROD
```

See [.github/workflows/ci.yml](.github/workflows/ci.yml) for complete configuration.

## Best Practices

### Writing Tests

1. **Test behavior, not implementation**
   ```typescript
   // ✅ Good
   expect(survey.status).toBe('draft')

   // ❌ Bad
   expect(component.state.internalStatus).toBe('DRAFT_INTERNAL')
   ```

2. **Use descriptive test names**
   ```typescript
   it('should calculate 60% completion when 3 of 5 reviewers respond', () => {
     // ...
   })
   ```

3. **Mock external dependencies**
   ```typescript
   jest.mock('@/lib/supabase')
   ```

4. **Test edge cases**
   ```typescript
   it('should handle zero reviewers gracefully', () => {
     // ...
   })
   ```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Example:
```
feat(360-surveys): add survey completion tracking

- Track reviewer response progress
- Display completion percentage
- Notify admin when 80% complete

Fixes #123
```

### Pull Requests

1. Ensure all CI checks pass
2. Maintain/improve code coverage
3. Include tests for new functionality
4. Update documentation if needed
5. Follow commit message convention

## Troubleshooting

### Tests failing locally but passing in CI

- Clear Jest cache: `npm test -- --clearCache`
- Update snapshots: `npm test -- -u`
- Check for timing issues in E2E tests
- Verify environment variables

### E2E tests timing out

- Increase timeout: `test.setTimeout(60000)`
- Check if app is running on port 3004
- Verify network connectivity
- Check for missing API mocks

### Coverage threshold not met

- Add tests for untested code
- Use `/* istanbul ignore */` comments for untestable code
- Run `npm test:coverage` to identify gaps

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Next Steps

1. ✅ Set up Jest and Playwright
2. ✅ Configure GitHub Actions workflows
3. **→ Write tests for core business logic**
4. **→ Set up preview deployments**
5. **→ Monitor metrics and coverage trends**

For questions or issues, open an issue in the repository.
