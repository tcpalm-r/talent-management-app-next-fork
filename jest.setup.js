// jest.setup.js
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
process.env.DISABLE_AUTH = 'true'
process.env.NEXT_PUBLIC_DISABLE_AUTH = 'true'

// Polyfill Web APIs for Next.js testing
if (typeof Request === 'undefined') {
  global.Request = class Request {}
}
if (typeof Response === 'undefined') {
  global.Response = class Response {}
}
if (typeof Headers === 'undefined') {
  global.Headers = class Headers {}
}

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}))

// Suppress console errors in tests
global.console.error = jest.fn()
global.console.warn = jest.fn()
