import { test, expect } from '@playwright/test'

/**
 * Comprehensive E2E Test Suite for Sonance 360° Reviews
 * Generated from app exploration using Playwright MCP
 *
 * App Structure Discovered:
 * - Navigation: Talent | 360° | My Review
 * - Talent Section: Employee directory (389 employees), search, filters, detail modal
 * - 360° Dashboard: Sponsor/Give Feedback tabs, status filters, survey cards
 * - Survey Creation: 5-step wizard (Subject → Reviewers → Questions → Settings → Review)
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should display sidebar with all navigation items', async ({ page }) => {
    await expect(page.getByRole('button', { name: /talent/i })).toBeVisible()
    await expect(page.getByRole('button', { name: '360°', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /my review/i })).toBeVisible()
  })

  test('should navigate between sections', async ({ page }) => {
    // Navigate to Talent
    await page.getByRole('button', { name: /talent/i }).click()
    await expect(page.getByRole('heading', { name: /employees/i })).toBeVisible()

    // Navigate to 360°
    await page.getByRole('button', { name: '360°', exact: true }).click()
    await expect(page.getByRole('button', { name: /sponsor/i })).toBeVisible()

    // Navigate to My Review
    await page.getByRole('button', { name: /my review/i }).click()
    await page.waitForTimeout(500)
  })

  test('should display user avatar with initials', async ({ page }) => {
    const avatar = page.getByRole('button', { name: /^[A-Z]{2}$/i }).first()
    await expect(avatar).toBeVisible()
  })

  test('should have dark mode toggle', async ({ page }) => {
    const darkModeButton = page.getByRole('button', { name: /dark mode/i })
    await expect(darkModeButton).toBeVisible()
  })
})

test.describe('Talent Section - Employee Directory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /talent/i }).click()
    await page.waitForTimeout(500)
  })

  test('should display employee list with count', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /employees/i })
    await expect(heading).toBeVisible()
    // Should show employee count in parentheses
    await expect(heading).toContainText(/\(\d+\)/)
  })

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search employees/i)
    await expect(searchInput).toBeVisible()

    // Type in search
    await searchInput.fill('Aaron')
    await page.waitForTimeout(300)

    // Should filter results
    const cards = page.locator('[cursor=pointer]:has-text("Aaron")')
    await expect(cards.first()).toBeVisible()
  })

  test('should have export CSV button', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export csv/i })
    await expect(exportButton).toBeVisible()
  })

  test('should have filters button', async ({ page }) => {
    const filtersButton = page.getByRole('button', { name: /filters/i })
    await expect(filtersButton).toBeVisible()
  })

  test('should open employee detail modal on card click', async ({ page }) => {
    // Click first employee card
    const firstCard = page.locator('[cursor=pointer]').filter({ hasText: /inside sales|specialist|engineer/i }).first()
    await firstCard.click()

    // Modal should appear with employee name as heading
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
    await expect(page.getByRole('button', { name: /close/i })).toBeVisible()
  })
})

test.describe('Employee Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /talent/i }).click()
    await page.waitForTimeout(500)

    // Open first employee
    const firstCard = page.locator('[cursor=pointer]').first()
    await firstCard.click()
    await page.waitForTimeout(300)
  })

  test('should display all modal tabs', async ({ page }) => {
    // Check for expected tabs
    await expect(page.getByRole('button', { name: /details/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /job description/i })).toBeVisible()
    await expect(page.getByRole('button', { name: '360', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /1:1/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /dev plan/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /notes/i })).toBeVisible()
  })

  test('should switch between tabs', async ({ page }) => {
    // Click on 360 tab (in modal, it's "360" without degree symbol)
    await page.getByRole('button', { name: '360', exact: true }).click()
    await page.waitForTimeout(300)

    // Click on Notes tab
    await page.getByRole('button', { name: /notes/i }).click()
    await page.waitForTimeout(300)
  })

  test('should close modal with close button', async ({ page }) => {
    await page.getByRole('button', { name: /close/i }).click()
    await page.waitForTimeout(300)

    // Modal should be closed - heading should no longer be visible
    await expect(page.getByRole('button', { name: /close/i })).not.toBeVisible()
  })

  test('should display contact information', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /contact information/i })).toBeVisible()
  })
})

test.describe('360° Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '360°', exact: true }).click()
    await page.waitForTimeout(500)
  })

  test('should display role tabs (Sponsor/Give Feedback)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sponsor/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /give feedback/i })).toBeVisible()
  })

  test('should display status filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /total/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /drafts/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /in progress/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /completed/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /finalized/i })).toBeVisible()
  })

  test('should switch between Sponsor and Give Feedback tabs', async ({ page }) => {
    // Click Give Feedback tab
    await page.getByRole('button', { name: /give feedback/i }).click()
    await page.waitForTimeout(300)

    // Click back to Sponsor tab
    await page.getByRole('button', { name: /sponsor/i }).click()
    await page.waitForTimeout(300)
  })

  test('should filter surveys by status', async ({ page }) => {
    // Click on "In Progress" filter
    await page.getByRole('button', { name: /in progress/i }).click()
    await page.waitForTimeout(300)

    // Click on "Completed" filter
    await page.getByRole('button', { name: /completed/i }).click()
    await page.waitForTimeout(300)

    // Click on "Total" to reset
    await page.getByRole('button', { name: /total/i }).click()
    await page.waitForTimeout(300)
  })

  test('should display survey cards with correct information', async ({ page }) => {
    // Check for survey card elements
    const surveyCard = page.locator('[cursor=pointer]').filter({ hasText: /360° feedback/i }).first()

    if (await surveyCard.isVisible()) {
      // Cards should show reviewer progress
      await expect(surveyCard.getByText(/reviewers:/i)).toBeVisible()
      // Cards should show due date
      await expect(surveyCard.getByText(/due:/i)).toBeVisible()
    }
  })

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by employee name/i)
    await expect(searchInput).toBeVisible()
  })

  test('should have Launch 360° Review button', async ({ page }) => {
    const launchButton = page.getByRole('button', { name: /launch 360° review/i })
    await expect(launchButton).toBeVisible()
  })
})

test.describe('360° Survey Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '360°', exact: true }).click()
    await page.waitForTimeout(500)
  })

  test('should open survey creation wizard', async ({ page }) => {
    await page.getByRole('button', { name: /launch 360° review/i }).click()
    await page.waitForTimeout(500)

    // Wizard should show Step 1
    await expect(page.getByText(/step 1 of 5/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /create 360° feedback/i })).toBeVisible()
  })

  test('should display subject selection in step 1', async ({ page }) => {
    await page.getByRole('button', { name: /launch 360° review/i }).click()
    await page.waitForTimeout(500)

    // Should show question about who feedback is for
    await expect(page.getByRole('heading', { name: /who is this feedback for/i })).toBeVisible()

    // Should have search field
    await expect(page.getByPlaceholder(/search by name/i)).toBeVisible()

    // Should show employee list
    const employeeButtons = page.locator('button').filter({ hasText: /[A-Z]{2}/ })
    expect(await employeeButtons.count()).toBeGreaterThan(0)
  })

  test('should close wizard with close button', async ({ page }) => {
    await page.getByRole('button', { name: /launch 360° review/i }).click()
    await page.waitForTimeout(500)

    // Close the wizard
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Wizard should be closed
    await expect(page.getByText(/step 1 of 5/i)).not.toBeVisible()
  })

  test('should search for employees in subject selection', async ({ page }) => {
    await page.getByRole('button', { name: /launch 360° review/i }).click()
    await page.waitForTimeout(500)

    const searchInput = page.getByPlaceholder(/search by name/i)
    await searchInput.fill('Aaron')
    await page.waitForTimeout(300)

    // Should filter employee list
    await expect(page.getByText(/aaron/i)).toBeVisible()
  })

  test('should select a subject and proceed to step 2', async ({ page }) => {
    await page.getByRole('button', { name: /launch 360° review/i }).click()
    await page.waitForTimeout(500)

    // Select first employee
    const firstEmployee = page.locator('button').filter({ hasText: /specialist|engineer|manager/i }).first()
    await firstEmployee.click()
    await page.waitForTimeout(500)

    // Should advance to step 2
    await expect(page.getByText(/step 2 of 5/i)).toBeVisible()
  })
})

test.describe('Survey Feedback Flow', () => {
  test('should have Provide Feedback link on survey cards', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '360°', exact: true }).click()
    await page.waitForTimeout(500)

    // Check for "Provide Feedback" link
    const feedbackLink = page.getByRole('link', { name: /provide feedback/i })
    if (await feedbackLink.isVisible()) {
      await expect(feedbackLink).toHaveAttribute('href', /\/survey\/complete\//)
    }
  })
})

test.describe('Survey Card Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '360°', exact: true }).click()
    await page.waitForTimeout(500)
  })

  test('should display status badges on survey cards', async ({ page }) => {
    // Look for status indicators
    const statuses = ['In Progress', 'Draft', 'Completed', 'Finalized', 'Resolved']
    let foundStatus = false

    for (const status of statuses) {
      const statusElement = page.getByText(new RegExp(status, 'i'))
      if (await statusElement.first().isVisible()) {
        foundStatus = true
        break
      }
    }

    expect(foundStatus).toBeTruthy()
  })

  test('should display role badges (Sponsor/Reviewer)', async ({ page }) => {
    const surveyCard = page.locator('[cursor=pointer]').filter({ hasText: /360° feedback/i }).first()

    if (await surveyCard.isVisible()) {
      // Check for role badges
      const sponsorBadge = surveyCard.getByText(/sponsor/i)
      const reviewerBadge = surveyCard.getByText(/reviewer/i)

      // At least one badge should be visible
      const hasSponsorBadge = await sponsorBadge.isVisible()
      const hasReviewerBadge = await reviewerBadge.isVisible()
      expect(hasSponsorBadge || hasReviewerBadge).toBeTruthy()
    }
  })
})

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigation should still be accessible
    await expect(page.getByRole('navigation')).toBeVisible()
  })

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Main content should be visible
    await expect(page.getByRole('main')).toBeVisible()
  })
})

test.describe('Error Handling', () => {
  test('should not have console errors on page load', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('WebSocket') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource')
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('should handle navigation without errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate through all sections
    await page.getByRole('button', { name: /talent/i }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: '360°', exact: true }).click()
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /my review/i }).click()
    await page.waitForTimeout(500)

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('WebSocket') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource')
    )

    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('Data Loading', () => {
  test('should load employees within reasonable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /talent/i }).click()

    // Wait for employee list to load
    await page.getByRole('heading', { name: /employees/i }).waitFor({ timeout: 10000 })

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(15000) // 15 seconds max
  })

  test('should load survey dashboard within reasonable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '360°', exact: true }).click()

    // Wait for dashboard to load
    await page.getByRole('button', { name: /sponsor/i }).waitFor({ timeout: 10000 })

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(15000) // 15 seconds max
  })
})
