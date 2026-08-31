import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type PermissionState = 'concedida' | 'negada' | 'negada_permanentemente';
export interface LocationPermissionStates { foreground: PermissionState; background: PermissionState }
type PermissionResponse = Pick<Location.PermissionResponse, 'status' | 'canAskAgain'>;
export interface PermissionApi {
  getForegroundPermissionsAsync(): Promise<PermissionResponse>;
  requestForegroundPermissionsAsync(): Promise<PermissionResponse>;
  getBackgroundPermissionsAsync(): Promise<PermissionResponse>;
  requestBackgroundPermissionsAsync(): Promise<PermissionResponse>;
}

const mapPermission = ({ status, canAskAgain }: PermissionResponse): PermissionState =>
  status === Location.PermissionStatus.GRANTED ? 'concedida' : canAskAgain ? 'negada' : 'negada_permanentemente';

export class LocationPermissions {
  constructor(private readonly api: PermissionApi = Location) {}

  async getCurrent(): Promise<LocationPermissionStates> {
    const [foreground, background] = await Promise.all([
      this.api.getForegroundPermissionsAsync(),
      this.api.getBackgroundPermissionsAsync(),
    ]);
    return { foreground: mapPermission(foreground), background: mapPermission(background) };
  }

  async checkAndRequest(): Promise<LocationPermissionStates> {
    let foreground = await this.api.getForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED && foreground.canAskAgain) foreground = await this.api.requestForegroundPermissionsAsync();
    if (foreground.status !== Location.PermissionStatus.GRANTED) {
      return { foreground: mapPermission(foreground), background: mapPermission(await this.api.getBackgroundPermissionsAsync()) };
    }
    let background = await this.api.getBackgroundPermissionsAsync();
    if (background.status !== Location.PermissionStatus.GRANTED && background.canAskAgain) background = await this.api.requestBackgroundPermissionsAsync();
    return { foreground: mapPermission(foreground), background: mapPermission(background) };
  }

  openAppSettings(): Promise<void> { return Linking.openSettings(); }
}
