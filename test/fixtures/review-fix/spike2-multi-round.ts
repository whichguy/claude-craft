/**
 * config-loader.ts — Loads application config from env, validates shape,
 * and produces a typed config object.
 *
 * Spike 2 fixture (multi-round): designed to require 2 Q1-Q37 rounds
 * without the pre-pass — the ROUND1 trivial layer (var/console.log/dead
 * imports) visually obscures the ROUND2 substantive bugs (missing env
 * validation, unchecked parseInt, stale cache) from the structured
 * reviewer in a single pass.
 *
 * With the pre-pass: trivial layer is cleared first; Q1-Q37 converges
 * in 1 round on the substantive bugs.
 */

// [TRIV-1] Unused import.
import { resolve as pathResolve } from 'path';

// [TRIV-2] Dead commented-out block (>2 lines).
// function oldLoadConfig() {
//   const raw = process.env.CONFIG;
//   return JSON.parse(raw);
// }

interface AppConfig {
  port: number;
  maxConnections: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  featureFlags: Record<string, boolean>;
}

// [TRIV-3] var used for never-reassigned default.
var DEFAULT_PORT = 3000;

// [TRIV-4] Single-letter variable outside loop context.
const n = 100;  // default max connections

let cachedConfig: AppConfig | null = null;

function loadConfig(): AppConfig {
  // [TRIV-5] console.log in hot path (called on every loadConfig).
  console.log('loading config...');

  // [SUBST-1] Unchecked parseInt: PORT may be missing, non-numeric, or negative.
  // parseInt returns NaN for invalid input; NaN flows into the port field and
  // downstream server.listen(NaN) silently picks a random port in some runtimes.
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

  // [SUBST-2] Missing required-env validation: LOG_LEVEL has no allowlist check,
  // so arbitrary strings (e.g. "DEBUG", "verbose", "") flow into the typed
  // union field, bypassing TypeScript's compile-time guarantee.
  const logLevel = (process.env.LOG_LEVEL || 'info') as AppConfig['logLevel'];

  // [SUBST-3] Stale cache bug: cachedConfig is returned on subsequent calls
  // WITHOUT any invalidation when env changes (e.g. after a reload signal).
  // The cache is populated once and never refreshed.
  if (cachedConfig) return cachedConfig;

  const config: AppConfig = {
    port,
    maxConnections: n,
    logLevel,
    featureFlags: parseFeatureFlags(process.env.FEATURE_FLAGS),
  };

  cachedConfig = config;
  return config;
}

function parseFeatureFlags(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {};
  // [SUBST-4] JSON.parse without try/catch: malformed FEATURE_FLAGS env var
  // crashes the entire config load, taking down the process at startup.
  return JSON.parse(raw);
}

export { loadConfig, parseFeatureFlags };
export type { AppConfig };
