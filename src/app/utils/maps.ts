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

let mapsPromise: Promise<void> | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const loadGoogleMaps = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (window.google?.maps) return;
  if (mapsPromise) return mapsPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key not found in environment variables');
    throw new Error('Google Maps API key not found');
  }

  mapsPromise = new Promise((resolve, reject) => {
    try {
      // Remove any existing Google Maps scripts
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps loaded successfully');
        resolve();
      };
      script.onerror = (error) => {
        console.error('Failed to load Google Maps:', error);
        mapsPromise = null;
        reject(new Error('Failed to load Google Maps'));
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      mapsPromise = null;
      reject(error);
    }
  });

  return mapsPromise;
};

const tryGeocodeWithRetry = async (address: string): Promise<Coordinates> => {
  try {
    // First try Places Autocomplete
    const placesResult = await new Promise<string>((resolve, reject) => {
      try {
        if (!window.google?.maps?.places) {
          console.error('Google Maps Places API not loaded');
          resolve(address);
          return;
        }

        const autocompleteService = new window.google.maps.places.AutocompleteService();
        autocompleteService.getPlacePredictions(
          { input: address, types: ['address'] },
          (predictions: any[], status: string) => {
            if (status === 'OK' && predictions && predictions.length > 0) {
              resolve(predictions[0].description);
            } else {
              console.log('Places Autocomplete failed, using original address');
              resolve(address);
            }
          }
        );
      } catch (error) {
        console.error('Error in Places Autocomplete:', error);
        resolve(address);
      }
    });

    // Then use Geocoding service
    return new Promise((resolve, reject) => {
      if (!window.google?.maps) {
        reject(new Error('Google Maps API not loaded'));
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: placesResult }, (results: any[], status: string) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const location = results[0].geometry.location;
          const coordinates = {
            lat: location.lat(),
            lng: location.lng()
          };
          console.log('Geocoding successful:', coordinates);
          resolve(coordinates);
        } else {
          console.error('Geocoding failed:', status);
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  } catch (error) {
    throw error;
  }
};

export const geocodeAddress = async (address: string): Promise<Coordinates> => {
  if (!address.trim()) {
    throw new Error('Address is required');
  }

  if (typeof window === 'undefined') {
    throw new Error('geocodeAddress can only be called in browser environment');
  }

  try {
    if (!window.google?.maps) {
      console.log('Loading Google Maps...');
      await loadGoogleMaps();
    }

    while (retryCount < MAX_RETRIES) {
      try {
        const result = await tryGeocodeWithRetry(address);
        retryCount = 0; // Reset retry count on success
        return result;
      } catch (error) {
        console.error(`Geocoding attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying in ${RETRY_DELAY}ms...`);
          await delay(RETRY_DELAY);
        }
      }
    }

    // If we get here, all retries failed
    retryCount = 0; // Reset retry count
    throw new Error(`Failed to geocode address after ${MAX_RETRIES} attempts`);
  } catch (error) {
    console.error('Error in geocodeAddress:', error);
    throw error;
  }
}; 