/**
 * Jest Setup File
 * 
 * Global test configuration and mocks
 */

// Mock environment variables
process.env.NEXT_PUBLIC_CIRCLE_APP_ID = 'test-app-id';
process.env.CIRCLE_API_KEY = 'TEST_API_KEY_test';
process.env.SESSION_KEY_MODULE_ARC_TESTNET = '0x1234567890123456789012345678901234567890';

// Mock window object for client-side tests
if (typeof window !== 'undefined') {
  window.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
}

// Suppress console errors in tests (optional)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

