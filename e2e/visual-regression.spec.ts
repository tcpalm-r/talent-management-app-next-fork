import { test, expect } from '@playwright/test'

/**
 * Visual Regression Tests
 *
 * Uses Playwright's built-in screenshot comparison to detect
 * unintended visual changes across different browsers and viewports.
 *
 * To update snapshots: npm run e2e:visual:update
 */

test.describe('Visual Regression - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Wait for any animations to complete
    await page.waitForTimeout(500)
  })

  test('Dashboard layout should match snapshot', async ({ page }) => {
    // Hide dynamic content that changes between runs
    await page.evaluate(() => {
      // Hide timestamps, dates, or counters that might change
      document
        .querySelectorAll('[data-testid="timestamp"], .timestamp, time')
        .forEach((el) => {
          ;(el as HTMLElement).style.visibility = 'hidden'
        })
    })

    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })

  test('Navigation sidebar should match snapshot', async ({ page }) => {
    // Only capture the sidebar/navigation area
    const sidebar = page.locator('nav, aside, [role="navigation"]').first()

    if ((await sidebar.count()) > 0) {
      await expect(sidebar).toHaveScreenshot('sidebar.png', {
        animations: 'disabled',
      })
    }
  })
})

test.describe('Visual Regression - Responsive Breakpoints', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 }, // iPhone SE
    { name: 'tablet', width: 768, height: 1024 }, // iPad
    { name: 'desktop', width: 1280, height: 720 }, // Standard desktop
    { name: 'wide', width: 1920, height: 1080 }, // Full HD
  ]

  for (const viewport of viewports) {
    test(`Dashboard at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })

      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      await expect(page).toHaveScreenshot(`dashboard-${viewport.name}.png`, {
        fullPage: false,
        animations: 'disabled',
      })
    })
  }
})

test.describe('Visual Regression - Interactive States', () => {
  test('Button hover state should match snapshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find first visible button
    const button = page.locator('button:visible').first()

    if ((await button.count()) > 0) {
      await button.hover()
      await page.waitForTimeout(200) // Wait for hover transition

      await expect(button).toHaveScreenshot('button-hover.png', {
        animations: 'disabled',
      })
    }
  })

  test('Input focus state should match snapshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find first visible input
    const input = page.locator('input:visible').first()

    if ((await input.count()) > 0) {
      await input.focus()
      await page.waitForTimeout(200)

      await expect(input).toHaveScreenshot('input-focus.png', {
        animations: 'disabled',
      })
    }
  })
})

test.describe('Visual Regression - Theme Consistency', () => {
  test('Color scheme should be consistent', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check that primary colors are applied consistently
    const primaryElements = page.locator(
      '.bg-primary, [class*="bg-primary"], .text-primary, [class*="text-primary"]'
    )
    const count = await primaryElements.count()

    // If we have themed elements, take a snapshot of the first few
    if (count > 0) {
      const firstElement = primaryElements.first()
      await expect(firstElement).toHaveScreenshot('primary-color-element.png', {
        animations: 'disabled',
      })
    }
  })
})

test.describe('Visual Regression - Component Library', () => {
  test('Cards should render consistently', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Look for card-like components
    const cards = page.locator(
      '.card, [class*="card"], .rounded-md.shadow, .rounded-xl.shadow'
    )

    if ((await cards.count()) > 0) {
      const firstCard = cards.first()
      await expect(firstCard).toHaveScreenshot('card-component.png', {
        animations: 'disabled',
      })
    }
  })

  test('Modals should render consistently', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Try to open a modal (look for common trigger patterns)
    const modalTrigger = page
      .locator(
        'button:has-text("New"), button:has-text("Create"), button:has-text("Add")'
      )
      .first()

    if ((await modalTrigger.count()) > 0) {
      await modalTrigger.click()
      await page.waitForTimeout(500)

      // Look for modal
      const modal = page
        .locator(
          '[role="dialog"], .modal, [class*="modal"], [data-testid="modal"]'
        )
        .first()

      if ((await modal.count()) > 0) {
        await expect(modal).toHaveScreenshot('modal-component.png', {
          animations: 'disabled',
        })
      }
    }
  })
})

test.describe('Visual Regression - Error States', () => {
  test('404 page should match snapshot', async ({ page }) => {
    await page.goto('/non-existent-page-xyz-123')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('404-page.png', {
      fullPage: false,
      animations: 'disabled',
    })
  })
})
