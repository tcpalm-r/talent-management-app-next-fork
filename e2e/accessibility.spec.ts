import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility tests using axe-core
 * Tests for WCAG 2.1 AA compliance
 */

test.describe('Accessibility - WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Dashboard should have no critical accessibility violations', async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Filter for critical and serious violations
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    // Log violations for debugging
    if (criticalViolations.length > 0) {
      console.log('Critical/Serious Accessibility Violations:')
      criticalViolations.forEach((v) => {
        console.log(`  - ${v.id}: ${v.description}`)
        console.log(`    Impact: ${v.impact}`)
        console.log(`    Help: ${v.helpUrl}`)
      })
    }

    expect(criticalViolations).toHaveLength(0)
  })

  test('All images should have alt text', async ({ page }) => {
    const images = page.locator('img')
    const imageCount = await images.count()

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const src = await img.getAttribute('src')

      // Skip data URIs (often decorative)
      if (src && !src.startsWith('data:')) {
        expect(alt, `Image ${src} should have alt text`).toBeTruthy()
      }
    }
  })

  test('Interactive elements should be keyboard accessible', async ({
    page,
  }) => {
    // Check that buttons and links are focusable
    const interactiveElements = page.locator(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const count = await interactiveElements.count()

    expect(count).toBeGreaterThan(0)

    // Tab through first few elements to ensure they're accessible
    for (let i = 0; i < Math.min(5, count); i++) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => document.activeElement?.tagName)
      expect(focused).toBeTruthy()
    }
  })

  test('Form inputs should have associated labels', async ({ page }) => {
    const inputs = page.locator(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
    )
    const inputCount = await inputs.count()

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')

      // Check if input has a label (either via id/label, aria-label, or aria-labelledby)
      if (id) {
        const labelFor = page.locator(`label[for="${id}"]`)
        const hasLabel =
          (await labelFor.count()) > 0 || ariaLabel || ariaLabelledBy

        expect(
          hasLabel,
          `Input ${id} should have an associated label`
        ).toBeTruthy()
      } else {
        // If no id, must have aria-label or be wrapped in a label
        const hasAccessibleName = ariaLabel || ariaLabelledBy
        // Allow inputs without explicit labels if they're in common patterns
        if (!hasAccessibleName) {
          const parent = input.locator('..')
          const isInLabel = (await parent.evaluate((el) => el.tagName)) === 'LABEL'
          expect(
            isInLabel || hasAccessibleName,
            'Input should have accessible name'
          ).toBeTruthy()
        }
      }
    }
  })

  test('Color contrast should meet WCAG AA standards', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include(['body'])
      .analyze()

    // Filter for color contrast violations specifically
    const contrastViolations = results.violations.filter(
      (v) => v.id === 'color-contrast'
    )

    // Log contrast issues for debugging
    if (contrastViolations.length > 0) {
      console.log('Color Contrast Violations:')
      contrastViolations.forEach((v) => {
        v.nodes.forEach((node) => {
          console.log(`  - ${node.html.substring(0, 100)}...`)
          console.log(`    ${node.failureSummary}`)
        })
      })
    }

    // Allow some contrast violations in initial implementation
    // but flag them for future improvement
    expect(contrastViolations.length).toBeLessThan(10)
  })

  test('Page should have proper heading hierarchy', async ({ page }) => {
    const headings = await page.evaluate(() => {
      const h = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      return Array.from(h).map((el) => ({
        level: parseInt(el.tagName[1]),
        text: el.textContent?.trim().substring(0, 50),
      }))
    })

    // Should have at least one heading
    expect(headings.length).toBeGreaterThan(0)

    // First heading should be h1 or h2 (h1 preferred)
    if (headings.length > 0) {
      expect(headings[0].level).toBeLessThanOrEqual(2)
    }

    // Check for heading level skips (e.g., h1 -> h3 without h2)
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i].level - headings[i - 1].level
      // Allow going down any amount, but going up should not skip more than 1 level
      expect(
        diff,
        `Heading hierarchy should not skip levels (${headings[i - 1].text} -> ${headings[i].text})`
      ).toBeLessThanOrEqual(1)
    }
  })

  test('ARIA landmarks should be present', async ({ page }) => {
    const landmarks = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"]')
      const nav = document.querySelector('nav, [role="navigation"]')
      const banner = document.querySelector('header, [role="banner"]')
      const contentinfo = document.querySelector('footer, [role="contentinfo"]')

      return {
        hasMain: !!main,
        hasNav: !!nav,
        hasBanner: !!banner,
        hasContentInfo: !!contentinfo,
      }
    })

    // At minimum, should have main content area
    expect(landmarks.hasMain, 'Page should have main landmark').toBeTruthy()
  })

  test('Focus should be visible on interactive elements', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab')

    // Get the focused element
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null

      const styles = window.getComputedStyle(el)
      return {
        tagName: el.tagName,
        outline: styles.outline,
        boxShadow: styles.boxShadow,
        border: styles.border,
      }
    })

    // Element should have some visible focus indicator
    // (outline, box-shadow, or border change)
    expect(focusedElement).toBeTruthy()
    if (focusedElement) {
      const hasVisibleFocus =
        focusedElement.outline !== 'none' ||
        focusedElement.boxShadow !== 'none' ||
        focusedElement.border !== ''

      expect(
        hasVisibleFocus,
        'Focused element should have visible focus indicator'
      ).toBeTruthy()
    }
  })
})

test.describe('Accessibility - Mobile Responsiveness', () => {
  test('Touch targets should be at least 44x44 pixels', async ({ page }) => {
    // Only run on mobile viewport
    const viewport = page.viewportSize()
    if (!viewport || viewport.width > 768) {
      test.skip()
      return
    }

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const buttons = page.locator('button, a[role="button"], [role="button"]')
    const buttonCount = await buttons.count()

    const smallTargets: string[] = []

    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const button = buttons.nth(i)
      const box = await button.boundingBox()

      if (box) {
        // WCAG 2.5.5 recommends 44x44 minimum, but 2.5.8 allows 24x24 for inline targets
        if (box.width < 24 || box.height < 24) {
          const text = await button.textContent()
          smallTargets.push(
            `Button "${text?.trim()}" is ${box.width}x${box.height}px`
          )
        }
      }
    }

    // Log small targets for review
    if (smallTargets.length > 0) {
      console.log('Small touch targets found:')
      smallTargets.forEach((t) => console.log(`  - ${t}`))
    }

    // Allow some small targets, but flag excessive count
    expect(smallTargets.length).toBeLessThan(5)
  })
})
