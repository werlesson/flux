jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6, High: 4 },
  getBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  getRegisteredTasksAsync: jest.fn(),
  isTaskDefined: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
  unregisterAllTasksAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}));

jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn(),
  isSpeakingAsync: jest.fn(),
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Heavy: 'heavy', Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: {
    Error: 'error',
    Success: 'success',
    Warning: 'warning',
  },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));
