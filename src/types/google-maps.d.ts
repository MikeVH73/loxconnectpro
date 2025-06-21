declare namespace google.maps {
  class Geocoder {
    geocode(
      request: { address: string },
      callback: (results: any[], status: string) => void
    ): void;
  }

  const GeocoderStatus: {
    OK: string;
    ZERO_RESULTS: string;
    OVER_DAILY_LIMIT: string;
    OVER_QUERY_LIMIT: string;
    REQUEST_DENIED: string;
    INVALID_REQUEST: string;
    UNKNOWN_ERROR: string;
  };

  class places {
    static Autocomplete: new (input: HTMLInputElement, options: any) => any;
  }

  interface GeocoderRequest {
    address?: string;
    location?: { lat: number; lng: number };
    placeId?: string;
    bounds?: LatLngBounds;
    componentRestrictions?: GeocoderComponentRestrictions;
    region?: string;
  }

  interface GeocoderResult {
    address_components: GeocoderAddressComponent[];
    formatted_address: string;
    geometry: {
      location: LatLng;
      location_type: GeocoderLocationType;
      viewport: LatLngBounds;
      bounds?: LatLngBounds;
    };
    place_id: string;
    types: string[];
    partial_match?: boolean;
  }

  interface LatLng {
    lat(): number;
    lng(): number;
    toString(): string;
    toUrlValue(precision?: number): string;
    toJSON(): { lat: number; lng: number };
  }

  class LatLngBounds {
    constructor(sw?: LatLng, ne?: LatLng);
    contains(latLng: LatLng): boolean;
    equals(other: LatLngBounds): boolean;
    extend(point: LatLng): LatLngBounds;
    getCenter(): LatLng;
    getNorthEast(): LatLng;
    getSouthWest(): LatLng;
    intersects(other: LatLngBounds): boolean;
    isEmpty(): boolean;
    toJSON(): { north: number; east: number; south: number; west: number };
    toString(): string;
    toUrlValue(precision?: number): string;
    union(other: LatLngBounds): LatLngBounds;
  }

  interface GeocoderAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }

  interface GeocoderComponentRestrictions {
    administrativeArea?: string;
    country?: string | string[];
    locality?: string;
    postalCode?: string;
    route?: string;
  }

  type GeocoderLocationType =
    | 'APPROXIMATE'
    | 'GEOMETRIC_CENTER'
    | 'RANGE_INTERPOLATED'
    | 'ROOFTOP';
} 