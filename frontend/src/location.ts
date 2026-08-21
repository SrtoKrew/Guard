import * as Location from 'expo-location';

/**
 * Intenta obtener la ubicación actual del dispositivo. Pide permiso si hace falta.
 * Si el usuario deniega el permiso, o el GPS tarda demasiado, o falla por cualquier
 * motivo (interior de nave, sin señal...), devuelve { lat: null, lng: null } en vez
 * de bloquear la acción — la ubicación es un "extra", nunca debe impedir fichar o
 * reportar una incidencia.
 */
export async function getCurrentLocationSafe(): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { lat: null, lng: null };
    }
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!position) {
      return { lat: null, lng: null };
    }
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (e) {
    console.log('No se pudo obtener la ubicación:', e);
    return { lat: null, lng: null };
  }
}
