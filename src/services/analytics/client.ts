/**
 * Jarvis fork: analytics transport is intentionally disabled.
 *
 * This module preserves the narrow interface used by the upstream analytics owner so
 * existing product flows remain functional, but it never creates a PostHog SDK client,
 * opens a network connection, queues events, or sends crash reports.
 */
type Properties = Record<string, unknown>;
type CaptureEvent = { event: string; properties?: Properties };

export interface AnalyticsClientOptions {
  crashes: boolean;
  beforeSend: (event: CaptureEvent) => CaptureEvent | null;
}

export interface AnalyticsClient {
  capture(event: string, properties?: Properties): void;
  screen(name: string, properties?: Properties): void;
  register(properties: Properties): void;
  close(): Promise<void>;
  forget(): Promise<void>;
  dropQueued(keep: (event: string) => boolean): void;
}

/** No remote analytics build is ever allowed in this fork. */
export function analyticsBuildAllowed(): boolean {
  return false;
}

/** Compatibility no-op. No third-party SDK is initialized. */
export function createAnalyticsClient(_options: AnalyticsClientOptions): AnalyticsClient {
  return {
    capture: () => undefined,
    screen: () => undefined,
    register: () => undefined,
    close: async () => undefined,
    forget: async () => undefined,
    dropQueued: () => undefined,
  };
}
