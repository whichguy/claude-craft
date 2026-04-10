# Context: TypeScript sync utility with file operations

File: `src/sync/rsync.ts` (partial)

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { GASFileOperations } from '../api/gasFileOperations.js';

export interface PushResult {
  success: boolean;
  filesPushed: string[];
  error?: string;
  mergeSkipped?: boolean;
}

async function readLocalFiles(localDir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const entries = await fs.readdir(localDir);

  for (const entry of entries) {
    if (!entry.endsWith('.gs') && !entry.endsWith('.html')) continue;
    const content = await fs.readFile(path.join(localDir, entry), 'utf-8');
    files.set(entry.replace(/\.(gs|html)$/, ''), content);
  }

  return files;
}

export async function push(
  scriptId: string,
  localDir: string,
  fileOps: GASFileOperations
): Promise<PushResult> {
  let localFiles;
  try {
    localFiles = await readLocalFiles(localDir);
  } catch(e) {
    return { success: false, filesPushed: [], error: e.message };
  }

  if (localFiles.size == 0) {
    return { success: false, filesPushed: [], error: 'No files found' };
  }

  let remoteFiles = [];
  let mergeSkipped = false;
  try {
    remoteFiles = await fileOps.getProjectFiles(scriptId);
  } catch {
    mergeSkipped = true;
  }

  // Merge remote-only files
  const localNames = new Set(localFiles.keys());
  for (const rf of remoteFiles) {
    if (!localNames.has(rf.name)) {
      localFiles.set(rf.name, rf.source);
    }
  }

  const gasFiles = Array.from(localFiles.entries()).map(([name, source]) => ({
    name, source, type: 'SERVER_JS' as const
  }));

  await fileOps.updateProjectFiles(scriptId, gasFiles);
  return { success: true, filesPushed: Array.from(localFiles.keys()), mergeSkipped };
}
```

Plan summary: Simplified push implementation for GAS file sync.
