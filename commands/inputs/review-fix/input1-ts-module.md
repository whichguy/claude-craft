# Context: TypeScript module with async operations

File: `src/tools/deployTool.ts`

```typescript
import { GASDeployOperations } from '../api/gasDeployOperations.js';
import { readDeployConfig, writeDeployConfig } from '../config/deployConfig.js';

export interface DeployToolParams {
  scriptId: string;
  localDir: string;
  description?: string;
  action?: 'deploy' | 'rollback' | 'promote' | 'list-versions';
  to?: string;
}

export async function handleDeployTool(params: DeployToolParams) {
  const config = readDeployConfig(params.localDir);
  const deployOps = new GASDeployOperations();

  if (params.action == 'deploy') {
    const version = await deployOps.createVersion(params.scriptId, params.description);
    const deploymentId = config.stagingDeploymentId;

    if (deploymentId == null) {
      const result = await deployOps.createDeployment(params.scriptId, version.versionNumber);
      config.stagingDeploymentId = result.deploymentId;
    } else {
      await deployOps.updateDeployment(params.scriptId, deploymentId, version.versionNumber);
    }

    writeDeployConfig(params.localDir, config);
    return { success: true, versionNumber: version.versionNumber };
  }

  if (params.action == 'rollback') {
    const target = params.to || 'staging';
    const slotIndex = target == 'staging' ? config.stagingActiveSlotIndex : config.prodActiveSlotIndex;
    const prevIndex = slotIndex - 1;

    if (prevIndex < 0) {
      return { success: false, error: 'No previous version' };
    }

    const versionNumber = target == 'staging'
      ? config.stagingSlotVersions[prevIndex]
      : config.prodSlotVersions[prevIndex];

    await deployOps.updateDeployment(params.scriptId, config.stagingDeploymentId, versionNumber);
    config.stagingActiveSlotIndex = prevIndex;
    writeDeployConfig(params.localDir, config);
    return { success: true };
  }

  return { success: false, error: 'Unknown action' };
}
```

Plan summary: This is the deploy tool implementation. It handles deploy and rollback actions for GAS projects.
