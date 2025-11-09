/**
 * Circle Developer Services Configuration
 * 
 * Aligned with Circle API documentation
 * https://developers.circle.com/wallets/docs
 */

// Circle API base URLs
const CIRCLE_SANDBOX_URL = "https://api-sandbox.circle.com";
const CIRCLE_PRODUCTION_URL = "https://api.circle.com";

export const circleConfig = {
  appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "",
  // Note: NEXT_PUBLIC_ vars are exposed to client, but we need server-side access
  // For server-side API routes, we can use either NEXT_PUBLIC_ or without it
  apiKey: process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY || "",
  entitySecret: process.env.CIRCLE_ENTITY_SECRET || "",
  environment: process.env.NEXT_PUBLIC_ENV || process.env.CIRCLE_ENV || "sandbox",
  // Always use production URL (api.circle.com) - same as SDK
  // The environment (testnet vs mainnet) is determined by the API key, not the base URL
  apiBaseUrl: CIRCLE_PRODUCTION_URL,
};

export interface CircleError {
  code: number;
  message: string;
  errors?: Array<{ message: string }>;
}

/**
 * Make authenticated request to Circle API
 * Uses API key authentication for REST API calls
 */
export async function circleApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = circleConfig.apiKey;
  
  if (!apiKey) {
    throw new Error("Circle API key not configured");
  }

  // Debug: Check API key format
  // Per Circle docs: https://developers.circle.com/w3s/web3-services-api-client-keys-auth
  // Format should be: TEST_API_KEY:key_id:key_secret or LIVE_API_KEY:key_id:key_secret
  const keyParts = apiKey.split(":");
  const isValidFormat = keyParts.length === 3 && 
    (keyParts[0] === "TEST_API_KEY" || keyParts[0] === "LIVE_API_KEY");
  
  console.log("API Key Debug:", {
    hasKey: !!apiKey,
    keyLength: apiKey.length,
    partCount: keyParts.length,
    firstPart: keyParts[0],
    isValidFormat,
    keyPreview: apiKey.substring(0, 30) + "...",
  });

  if (!isValidFormat) {
    throw new Error(
      `Invalid API key format. Expected format: TEST_API_KEY:key_id:key_secret or LIVE_API_KEY:key_id:key_secret. ` +
      `Got ${keyParts.length} parts, first part: "${keyParts[0] || 'missing'}". ` +
      `See https://developers.circle.com/w3s/web3-services-api-client-keys-auth for details.`
    );
  }

  const url = `${circleConfig.apiBaseUrl}${endpoint}`;
  
  // Circle API requires Bearer token authentication
  // Per Circle docs: https://developers.circle.com/w3s/web3-services-api-client-keys-auth
  // Format: authorization: Bearer TEST_API_KEY:key_id:key_secret
  
  // Convert options.headers to plain object if it's a Headers object
  const optionsHeaders: Record<string, string> = options.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : (options.headers as Record<string, string> | undefined) || {};
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "accept": "application/json", // Circle docs show this header
    "authorization": `Bearer ${apiKey}`, // Circle requires "Bearer" prefix with full API key
    ...optionsHeaders,
  };
  
  // Override with uppercase if provided in options (HTTP headers are case-insensitive)
  if (optionsHeaders.Authorization) {
    headers.authorization = optionsHeaders.Authorization;
  }
  if (optionsHeaders.Accept) {
    headers.accept = optionsHeaders.Accept;
  }
  
  // For user-controlled wallets, App ID might need to be in header
  // Some Circle endpoints require X-App-Id header
  // App ID should be included for user-related endpoints
  if (circleConfig.appId && (endpoint.includes("/v1/w3s/users") || endpoint.includes("/v1/w3s/wallets")) && !endpoint.includes("/developer/")) {
    // Try adding App ID as header (some Circle APIs require this)
    headers["X-App-Id"] = circleConfig.appId;
  }

  try {
    // Add timeout for Circle API requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    // Log request details for debugging (without sensitive data)
    console.log("Circle API Request:", {
      method: options.method || "GET",
      url,
      endpoint,
      hasApiKey: !!apiKey,
      apiKeyPrefix: keyParts[0],
      headers: {
        "Content-Type": headers["Content-Type"],
        "accept": headers.accept,
        "authorization": headers.authorization?.substring(0, 30) + "...",
        "X-App-Id": headers["X-App-Id"] || "not set",
      },
    });
    
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const error: CircleError = errorData || {
        code: response.status,
        message: response.statusText,
      };
      
      // Log full error details for debugging
      console.error("Circle API Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        endpoint,
        url,
      });
      
      const errorMessage = error.message || 
                          error.errors?.[0]?.message || 
                          `Circle API error: ${response.statusText} (${response.status})`;
      
      // Create an error object that preserves the full response details
      const apiError: any = new Error(errorMessage);
      apiError.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
      };
      apiError.endpoint = endpoint;
      apiError.url = url;
      throw apiError;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      // Handle timeout/abort errors
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        throw new Error("Request timed out. Please try again.");
      }
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

/**
 * Initialize Circle client
 */
export async function initializeCircleClient() {
  if (!circleConfig.apiKey) {
    throw new Error("Circle API key is required");
  }
  
  if (!circleConfig.appId && !circleConfig.entitySecret) {
    throw new Error("Either Circle App ID (for user wallets) or Entity Secret (for developer wallets) is required");
  }

  return {
    apiKey: circleConfig.apiKey,
    appId: circleConfig.appId,
    environment: circleConfig.environment,
    apiBaseUrl: circleConfig.apiBaseUrl,
    connected: true,
  };
}
