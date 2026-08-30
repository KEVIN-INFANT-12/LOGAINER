// ============================================================
// Geolocation wrapper with proper permission handling
// ============================================================

export interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  timestamp: number | null;
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  error: string | null;
}

export const defaultLocationState: LocationState = {
  lat: null,
  lng: null,
  accuracy: null,
  timestamp: null,
  status: 'idle',
  error: null,
};

export async function requestLocationPermission(): Promise<PermissionState | null> {
  if (!navigator.permissions) return null;
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return null;
  }
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  });
}

export function watchPosition(
  onSuccess: (pos: GeolocationPosition) => void,
  onError: (err: GeolocationPositionError) => void
): number {
  if (!navigator.geolocation) {
    onError({ code: 2, message: 'Geolocation not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    return -1;
  }
  return navigator.geolocation.watchPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 10000,
  });
}

export function clearWatch(watchId: number) {
  if (watchId >= 0 && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

export function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case err.POSITION_UNAVAILABLE:
      return 'Location information is unavailable. Check your GPS signal.';
    case err.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown location error occurred.';
  }
}
