/**
 * UUID Generator Utility
 * Works in both browser and Node.js environments
 */

/**
 * Generate a UUID v4
 * Works in both browser (Web Crypto API) and Node.js (crypto module)
 */
export function generateUUID(): string {
  // Browser environment - use Web Crypto API
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  
  // Node.js environment - use crypto module
  if (typeof require !== "undefined") {
    try {
      const crypto = require("crypto");
      return crypto.randomUUID();
    } catch {
      // Fallback if crypto module not available
    }
  }
  
  // Fallback implementation (RFC 4122 compliant)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}



