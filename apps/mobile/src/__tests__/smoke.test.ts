import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';

describe('Flux mobile test environment', () => {
  it('loads the base native-module mocks', () => {
    expect(Location.requestForegroundPermissionsAsync).toBeDefined();
    expect(TaskManager.defineTask).toBeDefined();
    expect(Speech.speak).toBeDefined();
    expect(Haptics.impactAsync).toBeDefined();
  });
});
