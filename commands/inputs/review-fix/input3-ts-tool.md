# Context: MCP tool handler with multiple action dispatch

File: `src/tools/pushTool.ts`

```typescript
import { GASFileOperations } from '../api/gasFileOperations.js';
import { push } from '../sync/rsync.js';
import path from 'node:path';

interface PushToolParams {
  scriptId: string;
  localDir: string;
  dryRun?: boolean;
  prune?: boolean;
  skipValidation?: boolean;
}

interface PushToolResult {
  success: boolean;
  filesPushed: string[];
  error?: string;
  hints?: Record<string, string>;
}

export async function handlePushTool(
  params: PushToolParams,
  fileOps: GASFileOperations
): Promise<PushToolResult> {
  const resolvedDir = path.resolve(params.localDir);

  try {
    const result = await push(
      params.scriptId,
      resolvedDir,
      fileOps,
      {
        dryRun: params.dryRun,
        prune: params.prune,
        skipValidation: params.skipValidation
      }
    );

    if (!result.success) {
      return {
        success: false,
        filesPushed: [],
        error: result.error || 'Push failed'
      };
    }

    const hints: Record<string, string> = {};

    if (result.mergeSkipped) {
      hints.mergeSkipped = 'Remote fetch failed — pushed local files only. Some remote files may have been lost.';
    }

    if (result.gitArchived && result.archivedFiles && result.archivedFiles.length > 0) {
      hints.gitArchive = result.archivedFiles.length + ' remote-only file(s) archived in git. Use git log --diff-filter=A -- <filename> to find archived files.';
    }

    return {
      success: true,
      filesPushed: result.filesPushed,
      hints: Object.keys(hints).length > 0 ? hints : undefined
    };
  } catch (error) {
    return {
      success: false,
      filesPushed: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

Plan summary: Push tool handler that wraps the core push() function and formats results for MCP consumption.
