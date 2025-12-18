/**
 * Authentication Error Handler
 * 
 * Provides consistent handling of Circle API 401/403 errors
 * with actionable error messages and recovery suggestions
 */

export interface AuthErrorDetails {
  status: number;
  code?: string | number;
  message: string;
  isExpired: boolean;
  isInvalid: boolean;
  hint: string;
  recoveryAction: string;
  errorCode: string;
  errorType: string;
}

/**
 * Circle error codes for authentication
 */
const CIRCLE_ERROR_CODES = {
  TOKEN_EXPIRED: 155104,
  TOKEN_INVALID: 155105,
  ENTITY_NOT_FOUND: 155106,
  WALLET_NOT_FOUND: 155107,
} as const;

/**
 * Parse Circle API error and extract authentication details
 */
export function parseAuthError(error: any): AuthErrorDetails | null {
  const status = error?.status || error?.response?.status || error?.statusCode;
  
  // Only handle 401/403 errors
  if (status !== 401 && status !== 403) {
    return null;
  }

  const errorData = error?.response?.data || error?.data || {};
  const circleErrorCode = errorData?.code || error?.code;
  const errorMessage = errorData?.message || errorData?.error || error?.message || 'Authentication failed';

  const isExpired = circleErrorCode === CIRCLE_ERROR_CODES.TOKEN_EXPIRED ||
                   errorMessage.toLowerCase().includes('expired') ||
                   errorMessage.includes('155104');

  const isInvalid = circleErrorCode === CIRCLE_ERROR_CODES.TOKEN_INVALID ||
                   errorMessage.toLowerCase().includes('invalid') ||
                   errorMessage.includes('155105');

  // Determine error code and type
  let errorCode = 'AUTHENTICATION_FAILED';
  if (isExpired) {
    errorCode = 'TOKEN_EXPIRED';
  } else if (isInvalid) {
    errorCode = 'TOKEN_INVALID';
  } else if (circleErrorCode === CIRCLE_ERROR_CODES.ENTITY_NOT_FOUND) {
    errorCode = 'ENTITY_NOT_FOUND';
  } else if (circleErrorCode === CIRCLE_ERROR_CODES.WALLET_NOT_FOUND) {
    errorCode = 'WALLET_NOT_FOUND';
  }

  // Generate user-friendly message
  let message: string;
  let hint: string;
  let recoveryAction: string;

  if (isExpired) {
    message = 'Your authentication token has expired. Tokens expire after 60 minutes for security.';
    hint = 'The user token used for this request has expired. You need to refresh it or create a new user session.';
    recoveryAction = 'Refresh the token using /api/circle/users/refresh or create a new user via /api/circle/users';
  } else if (isInvalid) {
    message = 'Your authentication token is invalid or malformed.';
    hint = 'The user token provided is not valid. This may happen if the token was corrupted or never properly created.';
    recoveryAction = 'Create a new user session via /api/circle/users and complete the PIN challenge';
  } else if (status === 401) {
    message = 'Authentication failed. Your credentials are invalid or missing.';
    hint = 'The request lacks valid authentication credentials. Check that userId and userToken are provided and valid.';
    recoveryAction = 'Verify your Circle API key, App ID, and user credentials. Create a new user if needed.';
  } else {
    message = 'Access forbidden. You do not have permission to perform this action.';
    hint = 'The authenticated user does not have permission to access this resource.';
    recoveryAction = 'Verify the user has access to the requested wallet/resource. Check user permissions.';
  }

  return {
    status,
    code: circleErrorCode,
    message,
    isExpired,
    isInvalid,
    hint,
    recoveryAction,
    errorCode,
    errorType: 'AUTHENTICATION_ERROR',
  };
}

/**
 * Create a user-friendly error response for authentication errors
 */
export function createAuthErrorResponse(error: any, additionalContext?: Record<string, any>) {
  const authDetails = parseAuthError(error);

  if (!authDetails) {
    return null; // Not an auth error
  }

  return {
    success: false,
    error: authDetails.message,
    errorCode: authDetails.errorCode,
    errorType: authDetails.errorType,
    details: {
      status: authDetails.status,
      code: authDetails.code,
      isExpired: authDetails.isExpired,
      isInvalid: authDetails.isInvalid,
      hint: authDetails.hint,
      recoveryAction: authDetails.recoveryAction,
      ...additionalContext,
    },
  };
}

/**
 * Check if error requires user recreation
 */
export function requiresUserRecreation(error: any): boolean {
  const authDetails = parseAuthError(error);
  if (!authDetails) return false;

  return authDetails.isExpired || authDetails.isInvalid || authDetails.errorCode === 'ENTITY_NOT_FOUND';
}

/**
 * Check if error requires token refresh
 */
export function requiresTokenRefresh(error: any): boolean {
  const authDetails = parseAuthError(error);
  if (!authDetails) return false;

  return authDetails.isExpired && !authDetails.isInvalid;
}


