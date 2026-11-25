/**
 * OGAM-owned Personal Mesh mDNS discovery, pairing-code policy, TXT record codec, and orchestrator.
 *
 * Uses zero external npm packages, zero Node-only APIs, and zero runtime relative `.ts` imports so
 * it runs identically in Node 26 `--experimental-strip-types` and React Native Metro/Hermes.
 *
 * Replaces `@offgrid/sync` `PAIRING_CODE_ALPHABET`, `PAIRING_CODE_LENGTH`, `createTxtRecord`,
 * `isDialableAddress`, `CompositeDiscoveryService`, `DiscoveryOrchestrator`, and
 * `@offgrid/sync/rn-discovery` `RnDiscovery`.
 */

import type {
  DeviceInfo,
  DevicePlatform,
  DiscoveredDevice,
  DiscoveryScanSnapshot,
  DiscoveryService,
  DiscoverySource,
  PeerLink,
  PeerLinkEvent,
  RnZeroconf,
  SyncDiscoveryHealthSnapshot,
  SyncEngineLike,
  SyncHealthFact,
} from '../types/syncContracts';

export const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 8;

const SERVICE_TYPE = 'offgrid';
const SERVICE_PROTOCOL = 'tcp';
const SERVICE_DOMAIN = 'local.';
const SERVICE_NAME_PREFIX = 'OffGrid-';
const ALLOWED_PLATFORMS = new Set<DevicePlatform>([
  'ios',
  'android',
  'macos',
  'windows',
  'linux',
]);

/** Normalizes and validates an 8-character pairing passphrase against `PAIRING_CODE_ALPHABET`. */
export function normalizePairingCode(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[\s-]+/g, '').toUpperCase();
  if (cleaned.length !== PAIRING_CODE_LENGTH) return null;
  for (let i = 0; i < cleaned.length; i += 1) {
    if (!PAIRING_CODE_ALPHABET.includes(cleaned[i])) return null;
  }
  return cleaned;
}

/**
 * Returns true if `host` is a routable non-loopback/non-link-local/non-multicast peer address or
 * hostname acceptable for Personal Mesh dialing.
 */
export function isDialableAddress(host?: string | null): boolean {
  if (typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return false;

  // Handle IPv6 / bracketed IPv6 literals
  const unbracketed =
    lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
  if (unbracketed.includes(':')) {
    if (unbracketed === '::' || unbracketed === '::1') return false;
    if (/^fe[89ab][0-9a-f]:/i.test(unbracketed)) return false;
    if (unbracketed.startsWith('::ffff:')) {
      return isDialableAddress(unbracketed.slice('::ffff:'.length));
    }
    return true;
  }

  // Handle dotted-quad IPv4
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(unbracketed);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if (
      [a, b, c, d].some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)
    ) {
      return false;
    }
    if (a === 0 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a >= 224) return false;
    return true;
  }

  return /^[a-z0-9._-]+$/i.test(unbracketed);
}

/** Encodes a `DeviceInfo` record into flat string mDNS TXT fields. */
export function createTxtRecord(device: DeviceInfo): Record<string, string> {
  const txt: Record<string, string> = {
    id: device.id,
    name: device.name,
    platform: device.platform,
    version: device.version || '1',
  };
  if (isDialableAddress(device.host)) {
    txt.host = device.host.trim();
  }
  if (Number.isInteger(device.port) && device.port > 0) {
    txt.port = String(device.port);
  }
  return txt;
}

/** Parses an mDNS TXT record back into partial device metadata. */
export function parseTxtRecord(
  raw: Record<string, unknown> | undefined,
): (Partial<DeviceInfo> & { id: string; name: string; platform: DevicePlatform }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const platform =
    typeof raw.platform === 'string' && ALLOWED_PLATFORMS.has(raw.platform as DevicePlatform)
      ? (raw.platform as DevicePlatform)
      : null;
  if (!id || !name || !platform) return null;

  const version =
    typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : '1';
  const host = typeof raw.host === 'string' ? raw.host.trim() : '';
  const portNum =
    typeof raw.port === 'number'
      ? raw.port
      : typeof raw.port === 'string' && raw.port.trim()
        ? Number(raw.port)
        : 0;

  return {
    id,
    name,
    platform,
    version,
    ...(isDialableAddress(host) ? { host } : {}),
    ...(Number.isInteger(portNum) && portNum > 0 ? { port: portNum } : {}),
  };
}

export interface RnDiscoveryOptions {
  allowHostname?: boolean;
  log?: (message: string) => void;
}

interface RawZeroconfService {
  txt?: Record<string, unknown>;
  addresses?: unknown;
  host?: unknown;
  port?: unknown;
  name?: unknown;
}

function isLocalMdnsHost(host: string): boolean {
  return host.trim().toLowerCase().replace(/\.$/, '').endsWith('.local');
}

function parseRemovedDeviceId(raw: unknown): string | null {
  const rawName =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && typeof (raw as { name?: unknown }).name === 'string'
        ? (raw as { name: string }).name
        : '';
  if (!rawName) return null;
  const withoutService = rawName
    .replace(/\._offgrid\._tcp(?:\.local\.?)?\.?$/i, '')
    .split('._')[0]
    .trim();
  if (!withoutService) return null;
  return withoutService.startsWith(SERVICE_NAME_PREFIX)
    ? withoutService.slice(SERVICE_NAME_PREFIX.length)
    : withoutService;
}

/**
 * React Native `react-native-zeroconf` adapter implementing the OGAM `DiscoveryService` contract.
 */
export class RnDiscovery implements DiscoveryService {
  private readonly zeroconf: RnZeroconf;
  private readonly allowHostname: boolean;
  private readonly log?: (message: string) => void;
  private readonly discovered = new Map<string, DiscoveredDevice>();
  private foundListener: ((device: DiscoveredDevice) => void) | null = null;
  private lostListener: ((deviceId: string) => void) | null = null;
  private listenersAttached = false;
  private browsing = false;
  private advertisingName: string | null = null;
  private browseHealth: SyncHealthFact = { state: 'idle' };
  private advertiseHealth: SyncHealthFact = { state: 'idle' };

  constructor(
    zeroconf: RnZeroconf,
    options: RnDiscoveryOptions = {},
  ) {
    this.zeroconf = zeroconf;
    this.allowHostname = options.allowHostname ?? true;
    this.log = options.log;
  }

  private attachListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    this.zeroconf.on('resolved', (rawSvc: unknown) => {
      if (!rawSvc || typeof rawSvc !== 'object') return;
      const svc = rawSvc as RawZeroconfService;
      const parsed = parseTxtRecord(svc.txt);
      if (!parsed) return;

      const resolvedHost = this.selectDialableHost(svc, parsed.host);
      if (!resolvedHost) {
        this.log?.(
          `[SYNC] ignoring peer ${parsed.id} (${parsed.name}): no dialable address`,
        );
        return;
      }

      const rawPort =
        typeof svc.port === 'number' && svc.port > 0
          ? svc.port
          : (parsed.port ?? 0);
      if (!Number.isInteger(rawPort) || rawPort <= 0) return;

      const addresses = Array.isArray(svc.addresses)
        ? svc.addresses.filter((a): a is string => typeof a === 'string' && isDialableAddress(a))
        : [];

      const device: DiscoveredDevice = {
        id: parsed.id,
        name: parsed.name,
        platform: parsed.platform,
        version: parsed.version ?? '1',
        host: resolvedHost,
        port: rawPort,
        routeId: 'lan',
        lastSeen: Date.now(),
        ...(addresses.length > 0 ? { addresses } : {}),
      };
      this.discovered.set(device.id, device);
      this.foundListener?.(device);
    });

    this.zeroconf.on('remove', (raw: unknown) => {
      const deviceId = parseRemovedDeviceId(raw);
      if (!deviceId) return;
      this.discovered.delete(deviceId);
      this.lostListener?.(deviceId);
    });

    this.zeroconf.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.browseHealth = { state: 'failed', error: message, updatedAt: Date.now() };
      this.log?.(`[SYNC] discovery error: ${message}`);
    });
  }

  private selectDialableHost(
    svc: RawZeroconfService,
    txtHost?: string,
  ): string | null {
    const addresses = Array.isArray(svc.addresses) ? svc.addresses : [];
    for (const candidate of addresses) {
      if (typeof candidate !== 'string') continue;
      if (!this.allowHostname && isLocalMdnsHost(candidate)) continue;
      if (isDialableAddress(candidate)) return candidate.trim();
    }

    if (txtHost && isDialableAddress(txtHost)) {
      if (this.allowHostname || !isLocalMdnsHost(txtHost)) {
        return txtHost.trim();
      }
    }

    if (typeof svc.host === 'string' && svc.host.trim()) {
      const normalized = svc.host.trim().replace(/\.$/, '');
      if (
        (this.allowHostname || !isLocalMdnsHost(normalized)) &&
        isDialableAddress(normalized)
      ) {
        return normalized;
      }
    }

    return null;
  }

  async start(): Promise<void> {
    await this.startBrowsing();
  }

  async startBrowsing(): Promise<void> {
    this.attachListeners();
    this.browseHealth = { state: 'starting', updatedAt: Date.now() };
    this.zeroconf.scan(SERVICE_TYPE, SERVICE_PROTOCOL, SERVICE_DOMAIN);
    this.browsing = true;
    this.browseHealth = { state: 'ready', updatedAt: Date.now() };
  }

  async stopBrowsing(): Promise<void> {
    if (!this.browsing) {
      this.browseHealth = { state: 'stopped', updatedAt: Date.now() };
      return;
    }
    this.zeroconf.stop();
    this.browsing = false;
    this.discovered.clear();
    this.browseHealth = { state: 'stopped', updatedAt: Date.now() };
  }

  async rescan(): Promise<void> {
    this.attachListeners();
    this.browseHealth = { state: 'starting', updatedAt: Date.now() };
    if (this.browsing) {
      this.zeroconf.stop();
    }
    this.zeroconf.scan(SERVICE_TYPE, SERVICE_PROTOCOL, SERVICE_DOMAIN);
    this.browsing = true;
    this.browseHealth = { state: 'ready', updatedAt: Date.now() };
  }

  async advertise(device?: DeviceInfo): Promise<void> {
    if (!device) return;
    this.advertiseHealth = { state: 'starting', updatedAt: Date.now() };
    const serviceName = `${SERVICE_NAME_PREFIX}${device.id}`;
    if (this.advertisingName) {
      this.zeroconf.unpublishService(this.advertisingName);
    }
    this.zeroconf.publishService(
      SERVICE_TYPE,
      SERVICE_PROTOCOL,
      SERVICE_DOMAIN,
      serviceName,
      device.port,
      createTxtRecord(device),
    );
    this.advertisingName = serviceName;
    this.advertiseHealth = { state: 'ready', updatedAt: Date.now() };
  }

  async stopAdvertising(): Promise<void> {
    if (this.advertisingName) {
      this.zeroconf.unpublishService(this.advertisingName);
      this.advertisingName = null;
    }
    this.advertiseHealth = { state: 'stopped', updatedAt: Date.now() };
  }

  onDeviceFound(listener: (device: DiscoveredDevice) => void): void {
    this.foundListener = listener;
    for (const device of this.discovered.values()) listener(device);
  }

  onDeviceLost(listener: (deviceId: string) => void): void {
    this.lostListener = listener;
  }

  async stop(): Promise<void> {
    await this.stopAdvertising();
    await this.stopBrowsing();
    this.zeroconf.removeDeviceListeners();
    this.listenersAttached = false;
  }

  getDiscoveryHealthSnapshot(): SyncDiscoveryHealthSnapshot {
    return {
      routes: [
        {
          id: 'lan',
          browse: { ...this.browseHealth },
          advertise: { ...this.advertiseHealth },
          peerCount: this.discovered.size,
        },
      ],
    };
  }
}

export interface CompositeDiscoveryServiceOptions {
  sources: DiscoverySource[];
  onSourceError?: (sourceId: string, error: Error) => void;
}

/**
 * Combines multiple `DiscoverySource` backends (LAN mDNS + iOS Nearby Proximity) while keeping
 * optional sources resilient when one transport is unavailable.
 */
export class CompositeDiscoveryService implements DiscoveryService {
  private readonly sources: DiscoverySource[];
  private readonly onSourceError?: (sourceId: string, error: Error) => void;
  private readonly peersBySource = new Map<string, Map<string, DiscoveredDevice>>();
  private foundListener: ((device: DiscoveredDevice) => void) | null = null;
  private lostListener: ((deviceId: string) => void) | null = null;
  private listenersBound = false;

  constructor(options: CompositeDiscoveryServiceOptions) {
    this.sources = [...options.sources];
    this.onSourceError = options.onSourceError;
    for (const source of this.sources) {
      this.peersBySource.set(source.id, new Map());
    }
  }

  private ensureSourceListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;

    for (const source of this.sources) {
      const sourcePeers = this.peersBySource.get(source.id)!;
      source.service.onDeviceFound(device => {
        const tagged: DiscoveredDevice = {
          ...device,
          routeId: device.routeId ?? source.id,
        };
        sourcePeers.set(device.id, tagged);
        this.foundListener?.(tagged);
      });
      source.service.onDeviceLost(deviceId => {
        sourcePeers.delete(deviceId);
        const stillSeenElsewhere = [...this.peersBySource.values()].some(map =>
          map.has(deviceId),
        );
        if (!stillSeenElsewhere) {
          this.lostListener?.(deviceId);
        }
      });
    }
  }

  private async runOnSources(
    action: (source: DiscoverySource) => Promise<void>,
  ): Promise<void> {
    for (const source of this.sources) {
      try {
        await action(source);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        if (source.required) throw error;
        this.onSourceError?.(source.id, error);
      }
    }
  }

  async start(): Promise<void> {
    this.ensureSourceListeners();
    await this.runOnSources(source => source.service.start());
  }

  async startBrowsing(): Promise<void> {
    this.ensureSourceListeners();
    await this.runOnSources(source =>
      source.service.startBrowsing ? source.service.startBrowsing() : source.service.start(),
    );
  }

  async stopBrowsing(): Promise<void> {
    await this.runOnSources(async source => {
      if (source.service.stopBrowsing) {
        await source.service.stopBrowsing();
      }
      this.peersBySource.get(source.id)?.clear();
    });
  }

  async rescan(): Promise<void> {
    this.ensureSourceListeners();
    await this.runOnSources(source =>
      source.service.rescan ? source.service.rescan() : source.service.start(),
    );
  }

  async advertise(device?: DeviceInfo): Promise<void> {
    await this.runOnSources(async source => {
      if (source.service.advertise) {
        await source.service.advertise(device);
      }
    });
  }

  async stopAdvertising(): Promise<void> {
    await this.runOnSources(async source => {
      if (source.service.stopAdvertising) {
        await source.service.stopAdvertising();
      }
    });
  }

  onDeviceFound(listener: (device: DiscoveredDevice) => void): void {
    this.foundListener = listener;
    this.ensureSourceListeners();
    for (const sourcePeers of this.peersBySource.values()) {
      for (const device of sourcePeers.values()) listener(device);
    }
  }

  onDeviceLost(listener: (deviceId: string) => void): void {
    this.lostListener = listener;
    this.ensureSourceListeners();
  }

  async stop(): Promise<void> {
    await this.runOnSources(source => source.service.stop());
    for (const map of this.peersBySource.values()) map.clear();
  }

  getDiscoveryHealthSnapshot(): SyncDiscoveryHealthSnapshot {
    const routes = this.sources.flatMap(
      source => source.service.getDiscoveryHealthSnapshot?.().routes ?? [],
    );
    return { routes };
  }
}

export interface DiscoveryOrchestratorOptions {
  engine: SyncEngineLike;
  discovery: DiscoveryService;
  localDevice: DeviceInfo;
  getSharedSecret?: (deviceId: string) => string | undefined;
  listSavedDevices?: () => readonly DeviceInfo[];
  resolveEndpoint?: (device: DeviceInfo) => DeviceInfo | Promise<DeviceInfo>;
  hasCredential?: (deviceId: string) => boolean;
  getMembershipId?: (deviceId: string) => string | undefined;
  discoverable?: boolean;
  browsing?: boolean;
  admitSilently?: (device: DiscoveredDevice) => Promise<void>;
  onSilentJoinSettled?: (device: DiscoveredDevice, error?: unknown) => void;
  onDiscovered?: (device: DiscoveredDevice) => void;
  onLost?: (deviceId: string) => void;
  onDiscoveryStateChanged?: (snapshot: DiscoveryScanSnapshot) => void;
  onReconnectFailed?: (device: DeviceInfo, error: Error) => void;
}

/**
 * Coordinates mDNS/proximity peer discovery, automatic reconnection to saved peers, silent
 * licensed-mesh joins, discoverability/browsing toggles, and peer-link diagnostics.
 */
export class DiscoveryOrchestrator {
  private readonly engine: SyncEngineLike;
  private readonly discovery: DiscoveryService;
  private readonly localDevice: DeviceInfo;
  private readonly getSharedSecret: (deviceId: string) => string | undefined;
  private readonly listSavedDevices?: () => readonly DeviceInfo[];
  private readonly resolveEndpoint?: (device: DeviceInfo) => DeviceInfo | Promise<DeviceInfo>;
  private readonly hasCredential: (deviceId: string) => boolean;
  private readonly getMembershipId?: (deviceId: string) => string | undefined;
  private readonly admitSilently?: (device: DiscoveredDevice) => Promise<void>;
  private readonly onSilentJoinSettled?: (device: DiscoveredDevice, error?: unknown) => void;
  private readonly onDiscovered?: (device: DiscoveredDevice) => void;
  private readonly onLost?: (deviceId: string) => void;
  private readonly onDiscoveryStateChanged?: (snapshot: DiscoveryScanSnapshot) => void;
  private readonly onReconnectFailed?: (device: DeviceInfo, error: Error) => void;

  private discoverable: boolean;
  private browsing: boolean;
  private started = false;
  private scanning = false;
  private lastScanAt?: number;
  private lastError?: string;
  private readonly discovered = new Map<string, DiscoveredDevice>();
  private readonly peerLinks = new Map<string, PeerLink>();
  private readonly reconnectRetryArmed = new Set<string>();

  constructor(options: DiscoveryOrchestratorOptions) {
    this.engine = options.engine;
    this.discovery = options.discovery;
    this.localDevice = options.localDevice;
    this.getSharedSecret = options.getSharedSecret ?? (() => undefined);
    this.listSavedDevices = options.listSavedDevices;
    this.resolveEndpoint = options.resolveEndpoint;
    this.hasCredential =
      options.hasCredential ?? (id => this.getSharedSecret(id) !== undefined);
    this.getMembershipId = options.getMembershipId;
    this.discoverable = options.discoverable ?? true;
    this.browsing = options.browsing ?? true;
    this.admitSilently = options.admitSilently;
    this.onSilentJoinSettled = options.onSilentJoinSettled;
    this.onDiscovered = options.onDiscovered;
    this.onLost = options.onLost;
    this.onDiscoveryStateChanged = options.onDiscoveryStateChanged;
    this.onReconnectFailed = options.onReconnectFailed;

    this.discovery.onDeviceFound(device => {
      void this.handleDeviceFound(device);
    });
    this.discovery.onDeviceLost(deviceId => {
      this.handleDeviceLost(deviceId);
    });
  }

  private async handleDeviceFound(device: DiscoveredDevice): Promise<void> {
    if (device.id === this.localDevice.id) return;
    this.discovered.set(device.id, device);
    this.notePeerLink(device.id, { kind: 'discovered', routeId: device.routeId });
    this.onDiscovered?.(device);

    if (this.engine.isPaired(device.id)) return;

    if (this.hasCredential(device.id)) {
      await this.tryReconnectSavedPeer(device);
      return;
    }

    if (this.admitSilently) {
      try {
        await this.admitSilently(device);
        this.onSilentJoinSettled?.(device, undefined);
      } catch (error) {
        this.onSilentJoinSettled?.(device, error);
      }
    }
  }

  private async tryReconnectSavedPeer(device: DeviceInfo): Promise<void> {
    const secret = this.getSharedSecret(device.id);
    if (!secret) return;

    let endpoint: DeviceInfo = device;
    try {
      endpoint = this.resolveEndpoint ? await this.resolveEndpoint(device) : device;
    } catch {
      endpoint = device;
    }

    try {
      await this.engine.reconnect(endpoint, secret, this.getMembershipId?.(device.id));
      this.reconnectRetryArmed.delete(device.id);
      this.notePeerLink(device.id, { kind: 'connected', routeId: (device as DiscoveredDevice).routeId });
      await this.engine.retryMembershipRevocation?.(endpoint).catch(() => false);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.notePeerLink(device.id, { kind: 'reconnect_failed', error: error.message });
      // First failed attempt arms re-resolve retry; second failure reports onReconnectFailed.
      if (!this.reconnectRetryArmed.has(device.id)) {
        this.reconnectRetryArmed.add(device.id);
        return;
      }
      this.onReconnectFailed?.(endpoint, error);
    }
  }

  private handleDeviceLost(deviceId: string): void {
    if (!this.discovered.delete(deviceId)) return;
    this.reconnectRetryArmed.delete(deviceId);
    this.notePeerLink(deviceId, { kind: 'lost' });
    this.onLost?.(deviceId);
  }

  private emitState(): void {
    this.onDiscoveryStateChanged?.(this.getDiscoveryState());
  }

  async start(): Promise<void> {
    this.started = true;
    this.scanning = this.browsing;
    this.lastScanAt = Date.now();
    this.lastError = undefined;
    try {
      if (this.browsing) {
        await this.discovery.start();
      }
      if (this.discoverable) {
        await this.discovery.advertise?.(this.localDevice);
      }
      for (const saved of this.listSavedDevices?.() ?? []) {
        if (!this.engine.isPaired(saved.id) && this.hasCredential(saved.id)) {
          void this.tryReconnectSavedPeer(saved);
        }
      }
    } catch (cause) {
      this.lastError = cause instanceof Error ? cause.message : String(cause);
      this.emitState();
      throw cause;
    }
    this.emitState();
  }

  async stop(): Promise<void> {
    this.started = false;
    this.scanning = false;
    this.discovered.clear();
    this.reconnectRetryArmed.clear();
    await this.discovery.stop();
    this.emitState();
  }

  async rescan(): Promise<void> {
    this.lastScanAt = Date.now();
    this.lastError = undefined;
    this.scanning = true;
    if (this.discovery.rescan) {
      await this.discovery.rescan();
    } else if (this.discovery.startBrowsing) {
      await this.discovery.startBrowsing();
    } else {
      await this.discovery.start();
    }
    this.emitState();
  }

  async refreshAdvertisement(): Promise<void> {
    if (!this.started) return;
    if (this.discoverable) {
      await this.discovery.advertise?.(this.localDevice);
    } else {
      await this.discovery.stopAdvertising?.();
    }
    this.emitState();
  }

  async setDiscoverable(next: boolean): Promise<void> {
    if (this.discoverable === next && this.started) return;
    this.discoverable = next;
    if (this.started) {
      await this.refreshAdvertisement();
    }
  }

  isDiscoverable(): boolean {
    return this.discoverable;
  }

  async setBrowsing(next: boolean): Promise<void> {
    if (this.browsing === next && this.started) return;
    this.browsing = next;
    this.scanning = this.started && next;
    if (this.started) {
      if (next) {
        if (this.discovery.startBrowsing) await this.discovery.startBrowsing();
        else await this.discovery.start();
      } else {
        await this.discovery.stopBrowsing?.();
      }
    }
    this.emitState();
  }

  isBrowsing(): boolean {
    return this.browsing;
  }

  getDiscoveryHealthSnapshot(): SyncDiscoveryHealthSnapshot {
    return (
      this.discovery.getDiscoveryHealthSnapshot?.() ?? {
        routes: [],
      }
    );
  }

  getDiscoveryState(): DiscoveryScanSnapshot {
    return {
      state: this.scanning ? 'scanning' : this.started ? 'idle' : 'stopped',
      scanning: this.scanning,
      browsing: this.browsing,
      discoverable: this.discoverable,
      peerCount: this.discovered.size,
      ...(this.lastScanAt !== undefined ? { lastScanAt: this.lastScanAt } : {}),
      ...(this.lastError !== undefined ? { error: this.lastError } : {}),
    };
  }

  handleDisconnected(deviceId: string, reason?: string): void {
    this.notePeerLink(deviceId, { kind: 'disconnected', ...(reason ? { error: reason } : {}) });
    if (!this.started || reason === 'local') return;
    const known =
      this.discovered.get(deviceId) ??
      this.listSavedDevices?.().find(d => d.id === deviceId);
    if (known && !this.engine.isPaired(deviceId) && this.hasCredential(deviceId)) {
      void this.tryReconnectSavedPeer(known);
    }
  }

  peerLink(deviceId: string): PeerLink {
    return this.peerLinks.get(deviceId) ?? { state: 'unknown' };
  }

  notePeerLink(deviceId: string, event: PeerLinkEvent): void {
    const rawState = event.kind ?? event.type ?? 'updated';
    const current = this.peerLinks.get(deviceId);
    this.peerLinks.set(deviceId, {
      state: rawState,
      routeId: event.routeId ?? current?.routeId,
      updatedAt: Date.now(),
      ...(event.error !== undefined ? { error: event.error } : {}),
    });
  }

  noteRosterChanged(): void {
    if (!this.started) return;
    for (const device of this.discovered.values()) {
      if (!this.engine.isPaired(device.id)) {
        void this.handleDeviceFound(device);
      }
    }
  }
}
