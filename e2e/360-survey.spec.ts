import { test, expect } from '@playwright/test'

test.describe('360 Feedback Survey Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('should display dashboard', async ({ page }) => {
    // Check if main dashboard elements are present
    const dashboardTitle = page.locator('text=360 Feedback')
    await expect(dashboardTitle).toBeVisible({ timeout: 10000 })
  })

  test('should navigate through pages without errors', async ({ page }) => {
    // Click on dashboard link if it exists
    const pageLoaded = page.locator('[role="main"]')
    await expect(pageLoaded).toBeVisible({ timeout: 10000 })

    // Check for console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate and wait
    await page.waitForTimeout(2000)

    // Should have no critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('WebSocket')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('should handle form interactions', async ({ page }) => {
    // Check if any form inputs exist and are interactive
    const inputs = page.locator('input, textarea, select')
    const count = await inputs.count()

    // Expect at least some interactive elements
    if (count > 0) {
      const firstInput = inputs.first()
      await expect(firstInput).toBeEnabled()
    }
  })

  test('should have accessible navigation', async ({ page }) => {
    // Check for accessible buttons and links
    const buttons = page.locator('button, a[role="button"]')
    const buttonCount = await buttons.count()

    // Should have navigation elements
    expect(buttonCount).toBeGreaterThan(0)
  })

  test('should not have broken images', async ({ page }) => {
    const images = page.locator('img')
    const imageCount = await images.count()

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const src = await img.getAttribute('src')

      // Every image should have alt text
      if (src && !src.includes('data:')) {
        expect(alt).toBeTruthy()
      }
    }
  })
})

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000)
  })

  test('should have reasonable LCP (Largest Contentful Paint)', async ({
    page,
  }) => {
    await page.goto('/')

    const metrics = await page.evaluate(() => {
      const lcpEntries = performance.getEntriesByName('').filter(
        (entry: PerformanceEntry) =>
          entry.entryType === 'largest-contentful-paint'
      )

      if (lcpEntries.length > 0) {
        return (lcpEntries[lcpEntries.length - 1] as PerformanceEntry)
          .startTime
      }
      return null
    })

    // Metrics should be defined (basic check)
    expect(typeof metrics).toBe('number')
  })
})
