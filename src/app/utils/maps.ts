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
    throw new Error('Google Maps API key not found');
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
};

export const geocodeAddress = async (address: string): Promise<Coordinates> => {
  if (!window.google) {
    throw new Error('Google Maps not loaded');
  }

  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0] && results[0].geometry && results[0].geometry.location) {
        const location = results[0].geometry.location;
        resolve({
          lat: location.lat(),
          lng: location.lng()
        });
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
}; 