/**
 * user-processor.ts — Processes user records through validation,
 * filtering, and profile enrichment steps.
 *
 * Two-round forcing fixture: ROUND1 bugs must be fixed before ROUND2
 * bug becomes visible in review. Fixing `any` type (ROUND1-1) exposes
 * that profile may be undefined; fixing the off-by-one (ROUND1-2) is
 * a prerequisite to safe iteration; after both fixes the deep access
 * bug (ROUND2-1) becomes the next mandatory fix.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  settings: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
  };
  bio?: string;
  avatarUrl?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
  active: boolean;
  profile?: UserProfile;
  createdAt: string;
}

interface ProcessingStats {
  total: number;
  active: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatUserLabel(user: User): string {
  // [TRAP] Proper null check on user.name — NOT a missing null check
  const displayName = user.name ? user.name.trim() : `user-${user.id}`;
  return `[${user.role.toUpperCase()}] ${displayName} <${user.email}>`;
}

// ---------------------------------------------------------------------------
// [ISSUE: ROUND1-1] 'any' type on data parameter hides that profile can be
// undefined — callers can pass records without the profile field and
// TypeScript will not catch the downstream access (ROUND2-1)
// ---------------------------------------------------------------------------

// [ISSUE: ROUND1-2] Off-by-one: filter returns 0-based array, but loop starts
// at index 1 — the first active user is always skipped
function processUsers(data: any): ProcessingStats {
  const stats: ProcessingStats = { total: 0, active: 0, skipped: 0, errors: 0 };

  const users: User[] = Array.isArray(data) ? data : [data];
  stats.total = users.length;

  const activeUsers = users.filter(u => u.active && isValidEmail(u.email));

  for (let index = 1; index < activeUsers.length; index++) {
    const user = activeUsers[index];

    try {
      const label = formatUserLabel(user);
      console.log('Processing:', label);

      // [ISSUE: ROUND2-1] Deep access without null guard — user.profile is optional
      // This bug is only fully visible once ROUND1-1 is fixed (proper typing reveals
      // profile can be undefined) and ROUND1-2 is fixed (all users are processed)
      const theme = user.profile.settings.theme;
      applyTheme(user.id, theme);

      stats.active++;
    } catch (err) {
      console.error(`Error processing user ${user.id}:`, err);
      stats.errors++;
    }
  }

  stats.skipped = stats.total - stats.active - stats.errors;
  return stats;
}

// Stub: apply UI theme preference for a user session
function applyTheme(userId: string, theme: string): void {
  console.log(`Applied theme '${theme}' for user ${userId}`);
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

function runBatch(
  records: User[],
  batchSize: number,
): ProcessingStats[] {
  const results: ProcessingStats[] = [];

  for (let start = 0; start < records.length; start += batchSize) {
    const chunk = records.slice(start, start + batchSize);
    const stats = processUsers(chunk);
    results.push(stats);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Summary aggregation
// ---------------------------------------------------------------------------

function aggregateStats(statsList: ProcessingStats[]): ProcessingStats {
  return statsList.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      active: acc.active + s.active,
      skipped: acc.skipped + s.skipped,
      errors: acc.errors + s.errors,
    }),
    { total: 0, active: 0, skipped: 0, errors: 0 }
  );
}

// ---------------------------------------------------------------------------
// Report formatter
// ---------------------------------------------------------------------------

function formatReport(stats: ProcessingStats): string {
  const successRate =
    stats.total > 0
      ? ((stats.active / stats.total) * 100).toFixed(1)
      : '0.0';

  return [
    `Total users:    ${stats.total}`,
    `Active:         ${stats.active} (${successRate}%)`,
    `Skipped:        ${stats.skipped}`,
    `Errors:         ${stats.errors}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { processUsers, runBatch, aggregateStats, formatReport };
export type { User, UserProfile, ProcessingStats };
