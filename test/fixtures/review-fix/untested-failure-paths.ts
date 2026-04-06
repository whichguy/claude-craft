interface Config {
  database?: { host: string; port: number };
  cache?: { ttl: number };
}

interface UserRecord {
  id: number;
  score?: number;
}

// [TRAP] Proper fallback with validation — logs warning, returns typed default
function getConfigWithValidation(configPath: string): Config {
  try {
    const raw = require(configPath);
    if (!raw || typeof raw !== 'object') {
      console.warn(`Invalid config at ${configPath}, using defaults`);
      return { database: { host: 'localhost', port: 5432 } };
    }
    return raw as Config;
  } catch (err) {
    console.warn(`Config load failed: ${(err as Error).message}`);
    return { database: { host: 'localhost', port: 5432 } };
  }
}

// [ISSUE: UFP-1] catch block returns empty array — downstream .map() silently produces empty
function loadUserRecords(source: string): UserRecord[] {
  try {
    const data = JSON.parse(source);
    if (!Array.isArray(data)) throw new Error('Expected array');
    return data;
  } catch {
    return [];  // Silent empty — callers iterating this get zero results with no error signal
  }
}

// [ISSUE: UFP-2] config fallback masks missing config section entirely
function getDatabaseHost(config: Config): string {
  return config?.database?.host ?? 'localhost';
  // If config.database is undefined (misconfiguration), silently falls back to 'localhost'
  // instead of failing fast — production connects to wrong host with no warning
}

// [ISSUE: UFP-3] Optional chaining yields undefined that feeds into arithmetic
function calculateAverageScore(users: UserRecord[]): number {
  const total = users.reduce((sum, u) => sum + (u?.score ?? 0), 0);
  const count = users.filter(u => u?.score !== undefined).length;
  return total / count;  // If ALL users lack score, count is 0, returns Infinity — not NaN but still wrong
  // The ?.score ?? 0 silently treats missing scores as 0 instead of excluding them
}
