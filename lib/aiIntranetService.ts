/**
 * AI Intranet Service
 *
 * This service provides an interface for making authenticated API calls
 * to the AI Intranet backend. Currently a stub for future implementation.
 */

interface AIIntranetConfig {
  appId: string;
  appApiKey: string;
  baseUrl: string;
}

class AIIntranetService {
  private config: AIIntranetConfig;

  constructor() {
    this.config = {
      appId: process.env.APP_ID || process.env.NEXT_PUBLIC_APP_ID || '',
      appApiKey: process.env.APP_API_KEY || '',
      baseUrl: this.getBaseUrl(),
    };
  }

  /**
   * Determines the correct AI Intranet base URL based on environment
   */
  private getBaseUrl(): string {
    const localTestingMode = process.env.LOCAL_TESTING_MODE === 'true';

    if (localTestingMode) {
      return process.env.AI_INTRANET_URL_LOCAL ||
             process.env.NEXT_PUBLIC_AI_INTRANET_URL_LOCAL ||
             'http://localhost:3001';
    }

    return process.env.AI_INTRANET_URL_PROD ||
           process.env.NEXT_PUBLIC_AI_INTRANET_URL_PROD ||
           'https://aiintranet.sonance.com';
  }

  /**
   * Makes an authenticated request to the AI Intranet API
   * @param endpoint - The API endpoint to call (e.g., '/api/users')
   * @param options - Fetch options (method, body, headers, etc.)
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'X-App-ID': this.config.appId,
      'X-App-API-Key': this.config.appApiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`AI Intranet API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AI Intranet Service Error:', error);
      throw error;
    }
  }

  /**
   * Example GET request
   */
  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * Example POST request
   */
  async post<T = any>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Example PUT request
   */
  async put<T = any>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Example DELETE request
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Get current configuration (useful for debugging)
   */
  getConfig() {
    return {
      baseUrl: this.config.baseUrl,
      appId: this.config.appId,
      hasApiKey: !!this.config.appApiKey,
    };
  }
}

// Export a singleton instance
export const aiIntranetService = new AIIntranetService();

// Example usage:
//
// // In an API route or server component:
// import { aiIntranetService } from '@/lib/aiIntranetService';
//
// const userData = await aiIntranetService.get('/api/users/me');
// const result = await aiIntranetService.post('/api/data', { key: 'value' });
