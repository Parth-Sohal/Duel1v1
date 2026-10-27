// Constants and shared types used by apps/web and apps/server.
// Nothing here may import from either app.

export const APP_NAME = 'Coding Arena';

export const MATCH_DURATION_MS = 10 * 60 * 1000; // 10 minutes, server-owned
export const FORFEIT_GRACE_MS = 30 * 1000; // disconnect grace period
export const MAX_CODE_LENGTH = 50_000; // characters per submission

/** Base paths of the two apps, resolved through their env/config. */
export const DEFAULT_WEB_PORT = 3000;
export const DEFAULT_SERVER_PORT = 4000;
