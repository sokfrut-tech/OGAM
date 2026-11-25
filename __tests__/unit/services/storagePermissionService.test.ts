import {
  nativeModules,
  platform,
  resetReactNativeBoundary,
} from '../../utils/reactNativeBoundary';

jest.mock('react-native', () => {
  const boundary = require('../../utils/reactNativeBoundary');
  return {
    NativeModules: boundary.nativeModules,
    Platform: boundary.platform,
  };
});

type PermissionModule = {
  accessState: jest.Mock;
  requestAllFilesAccess: jest.Mock;
};

describe('StoragePermissionService', () => {
  const load = () => {
    let service: typeof import('../../../src/services/storagePermissionService').StoragePermissionService | undefined;
    jest.isolateModules(() => {
      service = require('../../../src/services/storagePermissionService').StoragePermissionService;
    });
    if (!service) throw new Error('StoragePermissionService did not load');
    return service;
  };

  let native: PermissionModule;

  beforeEach(() => {
    resetReactNativeBoundary();
    native = {
      accessState: jest.fn().mockResolvedValue({
        media: false,
        allFiles: false,
        canRequestAllFiles: true,
      }),
      requestAllFilesAccess: jest.fn().mockResolvedValue(true),
    };
    nativeModules.SyncDownloadsModule = native;
  });

  it('reads the actual all-files access state from the existing native bridge', async () => {
    native.accessState.mockResolvedValue({
      media: true,
      allFiles: true,
      canRequestAllFiles: true,
    });

    await expect(load().isAllFilesAccessGranted()).resolves.toBe(true);
    expect(native.accessState).toHaveBeenCalledTimes(1);
  });

  it('reports that broad access is not granted when Android says it is not', async () => {
    await expect(load().isAllFilesAccessGranted()).resolves.toBe(false);
  });

  it('opens Android settings only through an explicit service call', async () => {
    await expect(load().openAllFilesAccessSettings()).resolves.toBe(true);
    expect(native.requestAllFilesAccess).toHaveBeenCalledTimes(1);
  });

  it('does not require Android storage permission on other platforms', async () => {
    platform.OS = 'ios';
    delete nativeModules.SyncDownloadsModule;

    const service = load();
    await expect(service.isAllFilesAccessGranted()).resolves.toBe(true);
    await expect(service.openAllFilesAccessSettings()).resolves.toBe(true);
  });

  it('fails clearly if the Android native bridge is missing', async () => {
    delete nativeModules.SyncDownloadsModule;

    await expect(load().isAllFilesAccessGranted()).rejects.toThrow(
      'SyncDownloadsModule is unavailable',
    );
  });
});
