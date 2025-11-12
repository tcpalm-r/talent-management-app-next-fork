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
  global.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Headers(init?.headers || {})
      this._bodyData = body
    }

    static json(data, init) {
      const body = JSON.stringify(data)
      return new Response(body, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      })
    }

    async json() {
      if (typeof this._bodyData === 'string') {
        return JSON.parse(this._bodyData)
      }
      return this._bodyData
    }
  }
}
if (typeof Headers === 'undefined') {
  global.Headers = class Headers extends Map {
    constructor(init) {
      super()
      if (init) {
        if (init instanceof Headers || init instanceof Map) {
          for (const [key, value] of init) {
            this.set(key.toLowerCase(), value)
          }
        } else if (typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this.set(key.toLowerCase(), value)
          }
        }
      }
    }

    get(name) {
      return super.get(name.toLowerCase())
    }

    set(name, value) {
      return super.set(name.toLowerCase(), String(value))
    }

    has(name) {
      return super.has(name.toLowerCase())
    }

    delete(name) {
      return super.delete(name.toLowerCase())
    }

    getSetCookie() {
      // Return all Set-Cookie headers as an array
      const setCookies = []
      for (const [key, value] of this.entries()) {
        if (key === 'set-cookie') {
          // value could be a comma-separated string of cookies
          setCookies.push(value)
        }
      }
      return setCookies
    }
  }
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
