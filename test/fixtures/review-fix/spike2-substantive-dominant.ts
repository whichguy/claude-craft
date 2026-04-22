/**
 * auth-session.ts — Session validation, token refresh, and audit logging.
 * Substantive-dominant fixture (~80% substantive, ~20% trivial noise).
 *
 * The substantive bugs require context (async ordering, null chains,
 * race conditions, unvalidated input) that a freeform pass is unlikely to
 * catch. Q1-Q37 must still flag each substantive issue after pre-pass runs;
 * this is the pre-pass regression check.
 */

import { createHash } from 'crypto';

interface Session {
  token: string;
  userId: string;
  expiresAt: number;
  scopes?: string[];
}

interface AuditEntry {
  sessionId: string;
  action: string;
  at: number;
}

// In-memory cache; production would use a distributed store.
const sessionCache: Map<string, Session> = new Map();
let auditLog: AuditEntry[] = [];

// [TRIV-1] var used for never-reassigned binding.
var HASH_ALGO = 'sha256';

// [SUBST-1] Unvalidated input: rawToken flows directly into the cache lookup
// key without length or charset checks. Caller input from request headers.
function getSession(rawToken: string): Session | undefined {
  const key = createHash(HASH_ALGO).update(rawToken).digest('hex');
  return sessionCache.get(key);
}

// [SUBST-2] Null-deref chain: session may be undefined (expired eviction),
// but session.scopes is accessed before any guard.
function sessionHasScope(rawToken: string, scope: string): boolean {
  const session = getSession(rawToken);
  return session.scopes.includes(scope);
}

// [SUBST-3] Async error handling gap: refreshSession awaits the HTTP call
// but does NOT catch rejections. An upstream 5xx surfaces as an unhandled
// promise rejection; the audit log entry for the failure is never written.
async function refreshSession(session: Session): Promise<Session> {
  const resp = await fetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ token: session.token }),
  });
  const fresh = await resp.json() as Session;
  auditLog.push({ sessionId: session.userId, action: 'refresh', at: Date.now() });
  sessionCache.set(session.token, fresh);
  return fresh;
}

// [SUBST-4] Race condition: two concurrent callers can both read an expired
// session, both call refreshSession, and both write competing entries into
// sessionCache. There is no per-token lock or in-flight-promise dedup.
async function ensureValidSession(rawToken: string): Promise<Session> {
  const session = getSession(rawToken);
  if (!session) throw new Error('no session');

  if (session.expiresAt < Date.now()) {
    return await refreshSession(session);
  }
  return session;
}

// [SUBST-5] Logic bug: the condition accepts expired sessions because the
// comparison is inverted — expiresAt < now means expired, but the function
// returns "valid" for that branch.
function isSessionValid(session: Session): boolean {
  const now = Date.now();
  if (session.expiresAt < now) return true;   // should be false
  return true;
}

// [TRIV-2] console.log in production-reachable path.
function logAuditEntry(entry: AuditEntry): void {
  auditLog.push(entry);
  console.log('audit:', entry);
}

export {
  getSession,
  sessionHasScope,
  refreshSession,
  ensureValidSession,
  isSessionValid,
  logAuditEntry,
};
export type { Session, AuditEntry };
