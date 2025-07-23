// Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// NOTE: Automatic geocoding is temporarily disabled.
// The functionality is preserved in the code but not active.
// GPS coordinates should be entered manually for now.

let mapsPromise: Promise<void> | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const loadGoogleMaps = async (): Promise<void> => {
  // Disabled for now
  return Promise.resolve();
};

const tryGeocodeWithRetry = async (address: string): Promise<Coordinates | null> => {
  // Disabled for now
  return null;
};

export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  // Automatic geocoding is temporarily disabled
  // Return null to indicate no automatic coordinates
  return null;
}; 