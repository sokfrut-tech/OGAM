/**
 * OGAM-owned canonical Personal Mesh, transfer, provenance, and entitlement type contracts.
 *
 * Pure TypeScript type definitions (zero runtime code) decoupling `src/` from `@offgrid/sync`.
 */

export type DevicePlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux';

export interface DeviceInfo {
  id: string;
  name: string;
  platform: DevicePlatform;
  version: string;
  host: string;
  port: number;
}

export interface DiscoveredDevice extends DeviceInfo {
  lastSeen?: number;
  routeId?: string;
  addresses?: string[];
}

export interface RecordProvenance {
  originDeviceId: string;
  originDeviceName?: string;
}

export type SyncedTurnStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export type SyncedAssistantTimelineEntry =
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; toolIndex: number };

export interface SyncedToolArtifact {
  id?: string;
  name: string;
  arguments?: string;
  result: string;
  status?: 'running' | 'completed' | 'failed';
  durationMs?: number;
}

export interface SyncedRetrievalSource {
  name: string;
  score: number;
  documentId?: string;
  chunkId?: string;
  snippet?: string;
}

export interface SyncedMessageMetrics {
  modelName?: string;
  totalSeconds?: number;
  timeToFirstTokenSeconds?: number;
  decodeTokensPerSecond?: number;
  prefillTokensPerSecond?: number;
  completionTokens?: number;
  contextWindowTokens?: number;
  promptTokens?: number;
  estimatedPromptTokens?: number;
}

export interface SyncedMessageToolMetadata {
  callId?: string;
  name?: string;
  status?: 'running' | 'completed' | 'failed';
  durationMs?: number;
}

export interface SyncedMessageContextInput {
  videoStoryId?: string;
  parent?: string;
  selectedAt?: number;
  reasoning?: string;
  timeline?: readonly SyncedAssistantTimelineEntry[];
  notice?: boolean;
  toolsOffered?: readonly string[];
  metrics?: SyncedMessageMetrics;
  toolCalls?: readonly SyncedToolArtifact[];
  tool?: SyncedMessageToolMetadata;
  durationMs?: number;
  turnKind?: 'text' | 'image' | 'video';
  status?: SyncedTurnStatus;
  retrievalSources?: readonly SyncedRetrievalSource[];
}

export interface SyncedMessageTurnInput {
  role: string;
  content: string | readonly unknown[];
  context?: string | null;
  createdAt?: string;
  timestamp?: number;
}

export interface SyncedMessageTurnProjection {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning?: string;
  timeline?: SyncedAssistantTimelineEntry[];
  toolArtifacts?: SyncedToolArtifact[];
  retrievalSources?: SyncedRetrievalSource[];
  metrics?: SyncedMessageMetrics;
  notice?: boolean;
  toolsOffered?: string[];
  tool?: SyncedMessageToolMetadata;
  durationMs?: number;
  turnKind?: 'text' | 'image' | 'video';
  status: SyncedTurnStatus;
  parent?: string;
  selectedAt?: number;
  videoStoryId?: string;
}

export interface TransferredModelFile {
  name: string;
  sizeBytes: number;
  role: 'primary' | 'projector' | 'auxiliary' | string;
}

export interface TransferredModelOrigin {
  repoId: string;
  revision: string;
  path: string;
}

export interface TransferredModelManifest {
  id: string;
  name: string;
  kind: 'text' | 'vision' | 'transcription' | 'image' | 'video';
  source: 'downloaded' | 'local';
  engine?: string;
  platform?: DevicePlatform;
  origin?: TransferredModelOrigin;
  files: TransferredModelFile[];
  [key: string]: unknown;
}

export type ProDeviceAdmission = 'unknown' | 'active' | 'inactive';

export type PersonalMeshReconciliationReason =
  | 'launch'
  | 'foreground'
  | 'manual'
  | 'sync'
  | 'pairing'
  | 'activation'
  | 'reset'
  | (string & {});

export type PersonalMeshActivationFailureReason =
  | 'invalid_key'
  | 'license_invalid'
  | 'license_revoked'
  | 'license_expired'
  | 'expired'
  | 'seat_limit_reached'
  | 'device_cap_reached'
  | 'replacement_failed'
  | 'registration_failed'
  | 'mapping_required'
  | 'neither_licensed'
  | 'network_error'
  | 'offline'
  | (string & {});

export type PersonalMeshActivationResult =
  | { ok: true }
  | { ok: false; reason: PersonalMeshActivationFailureReason };

export interface PersonalMeshActivationFailureProjection {
  reason: string;
  title: string;
  description: string;
  retryable?: boolean;
}

export interface KnowledgeDocumentDescriptor {
  syncId: string;
  projectId: string;
  name: string;
  createdAt: string;
  enabled: boolean;
}

export type SharedFileKind =
  | 'screenshot'
  | 'download'
  | 'generated_media'
  | 'message_attachment';

export interface SharedFileDescriptor {
  syncId: string;
  kind: SharedFileKind;
  name: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  conversationId?: string;
  messageId?: string;
  metadataJson?: string;
  contentHash?: string;
}

export type WritingLearned =
  | { kind: 'term'; term: string }
  | { kind: 'rule-muted'; ruleId: string };

export interface AmbientDirectoryAccessCopy {
  configureLabel: string;
  description: string;
  limitation?: string;
  upgrade?: { label: string };
}

export type SyncHealthState = 'idle' | 'starting' | 'ready' | 'stopped' | 'failed';

export interface SyncHealthFact {
  state: SyncHealthState;
  error?: string;
  updatedAt?: number;
}

export interface SyncTransportRouteHealth extends SyncHealthFact {
  id: string;
}

export interface SyncTransportHealthSnapshot {
  listener: SyncHealthFact;
  routes: SyncTransportRouteHealth[];
}

export interface SyncDiscoveryRouteHealth {
  id: string;
  browse: SyncHealthFact;
  advertise: SyncHealthFact;
  peerCount: number;
}

export interface SyncDiscoveryHealthSnapshot {
  routes: SyncDiscoveryRouteHealth[];
}

export interface DiscoveryScanSnapshot {
  state?: string;
  scanning?: boolean;
  browsing?: boolean;
  discoverable?: boolean;
  peerCount?: number;
  lastScanAt?: number;
  error?: string;
  [key: string]: unknown;
}

export interface SyncDiscoverabilityHealthInput {
  transport?: SyncTransportHealthSnapshot;
  discovery?: SyncDiscoveryHealthSnapshot;
  scan?: DiscoveryScanSnapshot;
  peerCount: number;
}

export interface SyncConnection {
  readonly id?: string;
  readonly remoteHost?: string;
  send(data: Uint8Array): void;
  onData(listener: (data: Uint8Array) => void): void;
  onClose(listener: () => void): void;
  close(): void;
}

export interface TransportBridge {
  readonly boundPort?: number;
  listen(port: number, onConnection: (connection: SyncConnection) => void): Promise<void>;
  connect(host: string, port: number, remote?: DeviceInfo): Promise<SyncConnection>;
  stop(): Promise<void>;
  getTransportHealthSnapshot?(): SyncTransportHealthSnapshot;
}

export interface TransportRoute {
  id: string;
  bridge: TransportBridge;
  canConnect?: (remote: DeviceInfo) => boolean;
  required?: boolean;
  connectTimeoutMs?: number;
}

export interface DiscoveryService {
  start(): Promise<void>;
  startBrowsing?(): Promise<void>;
  stopBrowsing(): Promise<void>;
  rescan(): Promise<void>;
  advertise(device?: DeviceInfo): Promise<void>;
  stopAdvertising(): Promise<void>;
  onDeviceFound(listener: (device: DiscoveredDevice) => void): void;
  onDeviceLost(listener: (deviceId: string) => void): void;
  stop(): Promise<void>;
  getDiscoveryHealthSnapshot?(): SyncDiscoveryHealthSnapshot;
}

export interface DiscoverySource {
  id: string;
  service: DiscoveryService;
  required?: boolean;
}

export interface PairedDevice extends DeviceInfo {
  sharedSecret: string;
  membershipId?: string;
  pairedAt?: number;
  routeId?: string;
}

export interface PairingEntitlementCredential {
  version: number;
  entitlementId: string;
  secret: string;
  expiresAt: string | null;
  maxDevices: number;
  verifiedAt: number;
}

export interface PersonalMeshRegistrationInput {
  syncDeviceId: string;
  deviceName: string;
  platform: DevicePlatform;
}

export type PairingEntitlementInspection =
  | { status: 'licensed'; entitlementId: string }
  | { status: 'unlicensed' };

export interface PairingEntitlementHostAdapter {
  inspect(): Promise<PairingEntitlementInspection>;
  prepareExport(
    registration: PersonalMeshRegistrationInput,
  ): Promise<{ id: string; credential: PairingEntitlementCredential }>;
  commitExport(preparedId: string): Promise<void>;
  rollbackExport(preparedId: string): Promise<void>;
  finalizeExport(preparedId: string): Promise<void>;
  prepareImport(
    credential: PairingEntitlementCredential,
    registration: PersonalMeshRegistrationInput,
  ): Promise<{ id: string }>;
  commitImport(preparedId: string): Promise<void>;
  rollbackImport(preparedId: string): Promise<void>;
  finalizeImport(preparedId: string): Promise<void>;
}

export interface PendingMembershipRevocation {
  revocationId: string;
  deviceId?: string;
  membershipId: string;
  device: DeviceInfo;
  revocationSecret?: string;
  dismissedAt?: number;
  state?: string;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface MembershipRevocationTombstone {
  deviceId: string;
  membershipId: string;
  revocationSecret?: string;
  revokedAt?: number;
  [key: string]: unknown;
}

export interface PairingAttemptSnapshot {
  id: string;
  deviceId?: string;
  deviceName?: string;
  direction?: 'inbound' | 'outbound';
  state: string;
  error?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface PairingPersistence {
  begin?(device: PairedDevice): void | Promise<void>;
  commit?(device: PairedDevice): void | Promise<void>;
  rollback?(deviceId: string): void | Promise<void>;
  getActive?(deviceId: string): PairedDevice | undefined | Promise<PairedDevice | undefined>;
  dropActive?(deviceId: string): void | Promise<void>;
  save?(device: PairedDevice): Promise<void>;
  load?(): Promise<PairedDevice[]>;
  remove?(deviceId: string): Promise<void>;
}

export interface MembershipRevocationSnapshot {
  id: string;
  deviceId: string;
  membershipId?: string;
  state: string;
  error?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface MembershipRevocationPersistence {
  beginLocal?(
    active: PairedDevice,
    pending: PendingMembershipRevocation,
  ): boolean | Promise<boolean>;
  listPending?(): PendingMembershipRevocation[] | Promise<PendingMembershipRevocation[]>;
  getPending?(
    deviceId: string,
  ): PendingMembershipRevocation | undefined | Promise<PendingMembershipRevocation | undefined>;
  getTombstone?(
    deviceId: string,
    membershipId: string,
  ): MembershipRevocationTombstone | undefined | Promise<MembershipRevocationTombstone | undefined>;
  applyRemote?(
    expectedActive: PairedDevice,
    tombstone: MembershipRevocationTombstone,
  ): boolean | Promise<boolean>;
  completeLocal?(
    pending: PendingMembershipRevocation,
    tombstone: MembershipRevocationTombstone,
  ): boolean | Promise<boolean>;
  setPendingDismissed?(
    deviceId: string,
    revocationId: string,
    dismissedAt?: number,
  ): boolean | Promise<boolean>;
  getRevocationSecret?(
    deviceId: string,
    membershipId: string,
  ): string | undefined | Promise<string | undefined>;
  save?(records: MembershipRevocationSnapshot[]): Promise<void>;
  load?(): Promise<MembershipRevocationSnapshot[]>;
}

export type DeviceCap =
  | {
      maxDevices: number;
      currentCount?: () => number;
      [key: string]: unknown;
    }
  | number;

export interface SyncProtocolMessage {
  type: string;
  id?: string;
  timestamp?: number;
  payload?: unknown;
  [key: string]: unknown;
}

export type Message = SyncProtocolMessage;

export interface PeerLink {
  state: string;
  routeId?: string;
  updatedAt?: number;
  error?: string;
  [key: string]: unknown;
}

export interface PeerLinkEvent {
  kind?: string;
  type?: string;
  routeId?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SyncByteCodec {
  toBytes(data: unknown): Uint8Array;
  fromBytes(bytes: Uint8Array): unknown;
}

export interface SyncEngineLike {
  isPaired(deviceId: string): boolean;
  reconnect(
    device: DeviceInfo,
    sharedSecret: string,
    expectedMembershipId?: string,
  ): Promise<void>;
  retryMembershipRevocation?(device: DeviceInfo): Promise<boolean>;
}

export interface SyncEngineOptions {
  localDevice: DeviceInfo;
  transport: TransportBridge;
  getPassphrase?: (remote: DeviceInfo) => Promise<string | null> | string | null;
  getSharedSecret?: (deviceId: string) => string | undefined;
  resolveMeshAdmission?: (remote: DeviceInfo) => Promise<string | null | undefined> | string | null | undefined;
  pairingEntitlement?: PairingEntitlementHostAdapter;
  onPaired?: (device: PairedDevice) => void;
  pairingPersistence?: PairingPersistence;
  onPairingFailed?: (remote: DeviceInfo | undefined, error: string) => void;
  onPairingAttemptChanged?: (attempt: PairingAttemptSnapshot) => void;
  membershipPersistence?: MembershipRevocationPersistence;
  onMembershipRevocationChanged?: (snapshot: MembershipRevocationSnapshot) => void;
  onMembershipRevoked?: (deviceId: string) => void;
  onDisconnected?: (deviceId: string, reason?: string) => void;
  onRouteChanged?: (deviceId: string, routeId: string | undefined) => void;
  onMessage?: (deviceId: string, message: SyncProtocolMessage) => void;
  onAppMessage?: (deviceId: string, channel: string, data: unknown) => void;
  cap?: DeviceCap;
  additionalRoutes?: TransportRoute[];
  onRouteError?: (routeId: string, error: Error) => void;
}

export interface BlobEndpoint {
  url: string;
  token: string;
  mode: 'upload' | 'download';
  nonce?: string;
}

export interface BlobServeRequest {
  requestId: string;
  deviceId: string;
  filePath: string;
  fileSize: number;
  mode: 'upload' | 'download';
  offset?: number;
  onProgress?: (bytes: number) => void;
}

export interface BlobStreamTransfer {
  requestId: string;
  deviceId: string;
  filePath: string;
  fileSize: number;
  endpoint: BlobEndpoint;
  offset?: number;
  onProgress?: (bytes: number) => void;
}

export interface BlobChannelHost {
  encrypted: boolean;
  serve?(request: BlobServeRequest): Promise<BlobEndpoint | undefined>;
  stream(transfer: BlobStreamTransfer): Promise<void>;
  release(requestId: string): void;
  abort(requestId: string): void;
}

export interface RnTcpSocket {
  remoteAddress?: string;
  on(event: string, listener: (...args: any[]) => void): any;
  write(data: unknown, encoding?: string, cb?: () => void): boolean;
  destroy(): void;
}

export interface RnTcpServer {
  on(event: string, listener: (...args: any[]) => void): any;
  listen(options: { port: number; host?: string }, callback?: () => void): any;
  address(): { port: number; address?: string } | null;
  close(cb?: () => void): void;
}

export interface RnTcpModule {
  createServer(onConnection: (socket: RnTcpSocket) => void): RnTcpServer;
  createConnection(options: { host: string; port: number }, callback?: () => void): RnTcpSocket;
}

export interface RnZeroconf {
  on(event: string, listener: (...args: any[]) => void): void;
  scan(type?: string, protocol?: string, domain?: string): void;
  stop(): void;
  removeDeviceListeners(): void;
  publishService(
    type: string,
    protocol: string,
    domain: string,
    name: string,
    port: number,
    txt?: Record<string, string>,
  ): void;
  unpublishService(name: string): void;
}
