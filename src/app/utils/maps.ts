// Google Maps types
declare global {
  interface Window {
    google: {
      maps: {
        Geocoder: new () => {
          geocode: (request: { address: string }, callback: (results: any[], status: string) => void) => void;
        };
        GeocoderStatus: {
          OK: string;
        };
        places: {
          Autocomplete: new (input: HTMLInputElement, options: any) => any;
        };
      };
    };
  }
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export const loadGoogleMaps = async (): Promise<void> => {
  if (window.google) return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('Google Maps API key not found in environment variables');
    throw new Error('Google Maps API key not found');
  }

  return new Promise((resolve, reject) => {
    try {
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
        reject(new Error('Failed to load Google Maps'));
      };
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      reject(error);
    }
  });
};

export const geocodeAddress = async (address: string): Promise<Coordinates> => {
  try {
    if (!window.google) {
      console.log('Loading Google Maps...');
      await loadGoogleMaps();
    }

    return new Promise((resolve, reject) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0] && results[0].geometry && results[0].geometry.location) {
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
    console.error('Error in geocodeAddress:', error);
    throw error;
  }
}; 