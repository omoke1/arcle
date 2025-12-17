/**
 * Location Parser Utilities
 * 
 * Extracts coordinates and location data from various formats
 */

export interface ParsedLocation {
  latitude: number;
  longitude: number;
  address?: string;
  isValid: boolean;
}

/**
 * Extract coordinates from a message string
 * Supports multiple formats:
 * - "latitude: 6.5244, longitude: 3.3792"
 * - "6.5244, 3.3792"
 * - Google Maps URLs
 * - Location emoji with coordinates
 */
export function parseLocationFromMessage(message: string): ParsedLocation | null {
  const lowerMessage = message.toLowerCase();

  // Pattern 1: "latitude: X, longitude: Y"
  const latLngPattern1 = /latitude:\s*(-?\d+\.?\d*)[,\s]+longitude:\s*(-?\d+\.?\d*)/i;
  const match1 = message.match(latLngPattern1);
  if (match1) {
    const lat = parseFloat(match1[1]);
    const lng = parseFloat(match1[2]);
    if (isValidCoordinate(lat, lng)) {
      return { latitude: lat, longitude: lng, isValid: true };
    }
  }

  // Pattern 2: "X, Y" (simple coordinate pair)
  const latLngPattern2 = /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/;
  const match2 = message.match(latLngPattern2);
  if (match2) {
    const lat = parseFloat(match2[1]);
    const lng = parseFloat(match2[2]);
    if (isValidCoordinate(lat, lng)) {
      return { latitude: lat, longitude: lng, isValid: true };
    }
  }

  // Pattern 3: Google Maps URL
  const googleMapsPattern = /(?:maps\.google\.com\/maps|google\.com\/maps)[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const match3 = message.match(googleMapsPattern);
  if (match3) {
    const lat = parseFloat(match3[1]);
    const lng = parseFloat(match3[2]);
    if (isValidCoordinate(lat, lng)) {
      return { latitude: lat, longitude: lng, isValid: true };
    }
  }

  // Pattern 4: Google Maps embed URL
  const embedPattern = /maps\/embed[^"]*q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const match4 = message.match(embedPattern);
  if (match4) {
    const lat = parseFloat(match4[1]);
    const lng = parseFloat(match4[2]);
    if (isValidCoordinate(lat, lng)) {
      return { latitude: lat, longitude: lng, isValid: true };
    }
  }

  // Pattern 5: Extract address if present
  const addressPattern = /(?:address|location):\s*([^\n]+)/i;
  const addressMatch = message.match(addressPattern);
  const address = addressMatch ? addressMatch[1].trim() : undefined;

  // If we found coordinates, return them
  if (match1 || match2 || match3 || match4) {
    const coords = match1 || match2 || match3 || match4;
    if (coords) {
      const lat = parseFloat(coords[1]);
      const lng = parseFloat(coords[2] || coords[1]);
      if (isValidCoordinate(lat, lng)) {
        return { latitude: lat, longitude: lng, address, isValid: true };
      }
    }
  }

  return null;
}

/**
 * Check if coordinates are valid (within valid lat/lng ranges)
 */
function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Check if a message contains location data
 */
export function hasLocationData(message: string): boolean {
  return parseLocationFromMessage(message) !== null;
}

