/**
 * URL Validation Utility
 * Validates application URLs to prevent incorrect domains in production
 */

export interface UrlValidationResult {
  isValid: boolean;
  url?: string;
  error?: string;
}

/**
 * Validates and returns the application base URL
 * Ensures the URL is not localhost in production environments
 *
 * @param envVarName - Name of the environment variable for error messages
 * @returns Validation result with URL or error
 */
export function validateAppUrl(envVarName: string = 'NEXT_PUBLIC_APP_URL'): UrlValidationResult {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const isLocalTestingMode = process.env.LOCAL_TESTING_MODE === 'true';

  // If no URL is set, return error
  if (!appUrl) {
    return {
      isValid: false,
      error: `${envVarName} environment variable is not set`
    };
  }

  // Validate URL format
  try {
    const url = new URL(appUrl);

    // In production (not local testing mode), prevent localhost URLs
    if (isProduction && !isLocalTestingMode) {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return {
          isValid: false,
          error: `${envVarName} cannot be localhost in production. Current value: ${appUrl}`
        };
      }
    }

    return {
      isValid: true,
      url: appUrl
    };
  } catch (error) {
    return {
      isValid: false,
      error: `${envVarName} is not a valid URL: ${appUrl}`
    };
  }
}

/**
 * Gets the application base URL with validation
 * Throws an error if validation fails
 *
 * @param envVarName - Name of the environment variable for error messages
 * @returns The validated application URL
 * @throws Error if URL is invalid
 */
export function getValidatedAppUrl(envVarName: string = 'NEXT_PUBLIC_APP_URL'): string {
  const result = validateAppUrl(envVarName);

  if (!result.isValid) {
    throw new Error(result.error);
  }

  return result.url!;
}

/**
 * Gets the application base URL with a fallback
 * Logs a warning if using fallback
 *
 * @param fallbackUrl - Fallback URL to use if validation fails
 * @param envVarName - Name of the environment variable for logging
 * @returns The validated URL or fallback
 */
export function getAppUrlWithFallback(
  fallbackUrl: string,
  envVarName: string = 'NEXT_PUBLIC_APP_URL'
): string {
  const result = validateAppUrl(envVarName);

  if (!result.isValid) {
    console.warn(`URL validation warning: ${result.error}. Using fallback: ${fallbackUrl}`);
    return fallbackUrl;
  }

  return result.url!;
}
