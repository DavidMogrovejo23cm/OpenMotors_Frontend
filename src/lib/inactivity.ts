/* ─────────────────────────────────────────────
   OpenMotors — Control de expiración por inactividad (RF-02 / HU-03)
   ───────────────────────────────────────────── */

export const ACTIVITY_KEY = 'gm_last_activity';
export const EXPIRED_REASON_KEY = 'gm_session_expired';
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos sin interacción

export interface ActivityStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function recordActivity(storage: ActivityStorageLike, nowMs = Date.now()): number {
  storage.setItem(ACTIVITY_KEY, String(nowMs));
  return nowMs;
}

export function getLastActivity(storage: ActivityStorageLike): number | null {
  const raw = storage.getItem(ACTIVITY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isInactiveExpired(
  lastActivityMs: number | null,
  nowMs = Date.now(),
  timeoutMs = INACTIVITY_TIMEOUT_MS,
): boolean {
  if (lastActivityMs === null) return false;
  return nowMs - lastActivityMs >= timeoutMs;
}
