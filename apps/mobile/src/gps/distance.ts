const EARTH_RADIUS_METERS = 6_371_008.8;
const radians = (degrees: number) => degrees * Math.PI / 180;

export interface Coordinates { latitude: number; longitude: number }

export function haversineDistanceMeters(from: Coordinates, to: Coordinates): number {
  if (from.latitude === to.latitude && from.longitude === to.longitude) return 0;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
