import { NativeModules, Platform } from 'react-native';

type NativeStoragePermissionModule = {
  isAllFilesAccessGranted(): Promise<boolean>;
  openAllFilesAccessSettings(): Promise<boolean>;
};

const nativeModule = NativeModules.StoragePermissionModule as
  | NativeStoragePermissionModule
  | undefined;

/**
 * Android's special all-files-access permission is not requested automatically.
 * Prefer the Storage Access Framework for ordinary user-selected files/folders.
 */
export const StoragePermissionService = {
  async isAllFilesAccessGranted(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (!nativeModule) {
      throw new Error(
        'StoragePermissionModule is unavailable. Rebuild the Android application.',
      );
    }
    return nativeModule.isAllFilesAccessGranted();
  },

  async openAllFilesAccessSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (!nativeModule) {
      throw new Error(
        'StoragePermissionModule is unavailable. Rebuild the Android application.',
      );
    }
    return nativeModule.openAllFilesAccessSettings();
  },
};
