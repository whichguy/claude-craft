import { readFile } from 'fs/promises';

interface Config {
  port: number;
  host: string;
}

// [TRAP] Proper error handling — correct pattern
async function loadConfigSafe(path: string): Promise<Config | null> {
  try {
    const data = await readFile(path, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// [ISSUE: ASYNC-1] Unhandled promise — no await, no .catch()
function initializeApp(): void {
  loadConfigSafe('/etc/app/config.json');
  console.log('App initialized');
}

// [ISSUE: ASYNC-2] Error context lost — original error discarded
async function fetchUserData(userId: string): Promise<object> {
  try {
    const response = await fetch(`/api/users/${userId}`);
    return await response.json();
  } catch (err) {
    throw new Error('Failed to fetch user data');
  }
}

// [ISSUE: ASYNC-3] Promise.all without error isolation — one failure kills all
async function loadAllConfigs(paths: string[]): Promise<Config[]> {
  const promises = paths.map(p => loadConfigSafe(p));
  return Promise.all(promises) as Promise<Config[]>;
}
