import { NativeModules, Platform } from 'react-native';

type NativeDownloadsPermissionModule = {
  accessState(): Promise<{
    media: boolean;
    allFiles: boolean;
    canRequestAllFiles: boolean;
  }>;
  requestAllFilesAccess(): Promise<boolean>;
};

const nativeModule = NativeModules.SyncDownloadsModule as
  | NativeDownloadsPermissionModule
  | undefined;

/**
 * Reuses the app's existing Downloads native bridge instead of introducing a second
 * Android permission implementation. The system permission is global to this app,
 * while SAF remains the preferred route for user-selected folders.
 */
export const StoragePermissionService = {
  async isAllFilesAccessGranted(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (!nativeModule) {
      throw new Error(
        'SyncDownloadsModule is unavailable. Rebuild the Android application.',
      );
    }
    const state = await nativeModule.accessState();
    return state.allFiles;
  },

  async openAllFilesAccessSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (!nativeModule) {
      throw new Error(
        'SyncDownloadsModule is unavailable. Rebuild the Android application.',
      );
    }
    return nativeModule.requestAllFilesAccess();
  },
};
