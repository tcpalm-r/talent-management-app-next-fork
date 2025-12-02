#!/usr/bin/env node

/**
 * HTML Validation Script
 *
 * Validates HTML output from the Next.js build for:
 * - Valid HTML5 structure
 * - Semantic element usage
 * - Missing required attributes
 * - Duplicate IDs
 * - Proper nesting
 *
 * Usage: npm run validate:html
 */

const { HtmlValidate } = require('html-validate')
const fs = require('fs')
const path = require('path')

// Configuration for html-validate
const htmlValidateConfig = {
  extends: ['html-validate:recommended'],
  rules: {
    // Core HTML validity
    'element-permitted-content': 'error',
    'element-required-content': 'error',
    'element-permitted-occurrences': 'error',
    'element-permitted-parent': 'error',
    'element-permitted-order': 'warn',

    // Semantic HTML
    'prefer-native-element': 'warn',
    'no-redundant-role': 'warn',

    // Accessibility related
    'require-sri': 'off', // Not needed for internal assets
    'wcag/h30': 'error', // Links must have text
    'wcag/h32': 'error', // Forms must have submit button
    'wcag/h36': 'error', // Images must have alt
    'wcag/h37': 'error', // Image alt must have content
    'wcag/h67': 'error', // Empty alt only for decorative images
    'wcag/h71': 'warn', // Fieldsets should have legends

    // Attribute validation
    'attribute-boolean-style': 'warn',
    'attribute-empty-style': 'warn',
    'no-dup-attr': 'error',
    'no-dup-id': 'error',

    // Document structure
    'missing-doctype': 'error',
    'no-missing-references': 'error',
    'unique-landmark': 'warn',

    // Script/Style
    'script-type': 'off', // Modern browsers don't need type
    'no-inline-style': 'off', // Next.js uses inline styles

    // Forms
    'input-missing-label': 'warn',
    'form-dup-name': 'error',

    // Other
    'no-deprecated-attr': 'warn',
    'void-style': 'warn',
    'close-attr': 'error',
    'close-order': 'error',

    // Relax some rules for Next.js output
    'require-sri': 'off',
    'long-title': 'off',
    'no-trailing-whitespace': 'off',
  },
}

// Initialize validator
const htmlValidate = new HtmlValidate(htmlValidateConfig)

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Find all HTML files in a directory recursively
 */
function findHtmlFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files
  }

  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      findHtmlFiles(fullPath, files)
    } else if (item.endsWith('.html')) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Validate a single HTML file
 */
async function validateFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8')

  // For Next.js generated HTML, wrap in doctype if missing
  let content = html
  if (!content.toLowerCase().includes('<!doctype')) {
    content = `<!DOCTYPE html>\n${content}`
  }

  const report = await htmlValidate.validateString(content)

  return {
    filePath,
    valid: report.valid,
    errors: report.results[0]?.messages.filter((m) => m.severity === 2) || [],
    warnings: report.results[0]?.messages.filter((m) => m.severity === 1) || [],
  }
}

/**
 * Main validation function
 */
async function main() {
  log('\n📋 HTML Validation Report\n', 'blue')
  log('=' .repeat(60), 'gray')

  // Check for .next/server/app directory (App Router pages)
  const appDir = path.join(process.cwd(), '.next', 'server', 'app')
  // Check for .next/server/pages directory (Pages Router)
  const pagesDir = path.join(process.cwd(), '.next', 'server', 'pages')
  // Check for out directory (static export)
  const outDir = path.join(process.cwd(), 'out')

  const htmlFiles = [
    ...findHtmlFiles(appDir),
    ...findHtmlFiles(pagesDir),
    ...findHtmlFiles(outDir),
  ]

  if (htmlFiles.length === 0) {
    log('\n⚠️  No HTML files found. Run "npm run build" first.\n', 'yellow')
    log('Directories checked:', 'gray')
    log(`  - ${appDir}`, 'gray')
    log(`  - ${pagesDir}`, 'gray')
    log(`  - ${outDir}`, 'gray')
    process.exit(0)
  }

  log(`\nFound ${htmlFiles.length} HTML file(s) to validate\n`, 'gray')

  let totalErrors = 0
  let totalWarnings = 0
  const results = []

  for (const filePath of htmlFiles) {
    const result = await validateFile(filePath)
    results.push(result)
    totalErrors += result.errors.length
    totalWarnings += result.warnings.length
  }

  // Print results
  for (const result of results) {
    const relativePath = path.relative(process.cwd(), result.filePath)

    if (result.valid && result.warnings.length === 0) {
      log(`✅ ${relativePath}`, 'green')
    } else if (result.errors.length > 0) {
      log(`❌ ${relativePath}`, 'red')
    } else {
      log(`⚠️  ${relativePath}`, 'yellow')
    }

    // Print errors
    for (const error of result.errors) {
      log(`   ${error.line}:${error.column} ERROR: ${error.message}`, 'red')
      if (error.ruleId) {
        log(`   Rule: ${error.ruleId}`, 'gray')
      }
    }

    // Print warnings
    for (const warning of result.warnings) {
      log(
        `   ${warning.line}:${warning.column} WARN: ${warning.message}`,
        'yellow'
      )
    }
  }

  // Summary
  log('\n' + '=' .repeat(60), 'gray')
  log('\n📊 Summary\n', 'blue')
  log(`   Files checked: ${htmlFiles.length}`)
  log(`   Errors: ${totalErrors}`, totalErrors > 0 ? 'red' : 'green')
  log(`   Warnings: ${totalWarnings}`, totalWarnings > 0 ? 'yellow' : 'green')

  if (totalErrors > 0) {
    log('\n❌ Validation failed with errors\n', 'red')
    process.exit(1)
  } else if (totalWarnings > 0) {
    log('\n⚠️  Validation passed with warnings\n', 'yellow')
    process.exit(0)
  } else {
    log('\n✅ All HTML files are valid!\n', 'green')
    process.exit(0)
  }
}

// Run the validator
main().catch((error) => {
  log(`\n❌ Error: ${error.message}\n`, 'red')
  process.exit(1)
})
