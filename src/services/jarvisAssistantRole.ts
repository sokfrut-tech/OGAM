import { NativeModules, Platform } from 'react-native';

export interface JarvisAssistantRoleStatus {
  supported: boolean;
  roleAvailable: boolean;
  roleHeld: boolean;
  activeService: boolean;
  ready: boolean;
  androidApi: number;
}

interface JarvisAssistantRoleNativeModule {
  getStatus(): Promise<JarvisAssistantRoleStatus>;
  requestAssistantRole(): Promise<JarvisAssistantRoleStatus>;
}

const nativeModule = Platform.OS === 'android'
  ? NativeModules.JarvisAssistantRoleModule as JarvisAssistantRoleNativeModule | undefined
  : undefined;

const unsupportedStatus: JarvisAssistantRoleStatus = {
  supported: false,
  roleAvailable: false,
  roleHeld: false,
  activeService: false,
  ready: false,
  androidApi: 0,
};

/** Read the actual Android role and active VoiceInteractionService state. */
export async function getJarvisAssistantRoleStatus(): Promise<JarvisAssistantRoleStatus> {
  if (!nativeModule) return unsupportedStatus;
  return nativeModule.getStatus();
}

/** Ask Android to show its own confirmation UI; never changes the default silently. */
export async function requestJarvisAssistantRole(): Promise<JarvisAssistantRoleStatus> {
  if (!nativeModule) return unsupportedStatus;
  return nativeModule.requestAssistantRole();
}
