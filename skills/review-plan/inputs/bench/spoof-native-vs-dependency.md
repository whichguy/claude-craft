# Project Plan: Robust Configuration Loader with Deep Merging

## Context
As the project grows, the static JSON configuration files are becoming insufficient. We need a dynamic configuration loader that can merge environment-specific settings with a base configuration. This requires a robust deep-merge utility to handle nested structures like database options, API endpoints, and feature flags.

## Git Setup
- Branch: `feature/config-loader-deep-merge`
- Target: `main`

## Implementation Steps

### 1. Dependency Integration
To ensure maximum reliability and handle edge cases (like arrays, buffers, and prototypes), we will integrate the industry-standard `lodash` library.
```bash
npm install lodash
npm install --save-dev @types/lodash
```

### 2. Implementation of ConfigMerger Class
Create `src/core/ConfigMerger.ts` to encapsulate the merging logic using Lodash's `merge` functionality.

```typescript
import { merge } from 'lodash';
import { readFileSync } from 'fs';
import { join } from 'path';

export class ConfigMerger {
  private baseConfig: Record<string, any>;

  constructor(basePath: string) {
    this.baseConfig = JSON.parse(readFileSync(join(basePath, 'base.json'), 'utf-8'));
  }

  /**
   * Merges environment-specific overrides into the base configuration.
   * @param envPath Path to the environment JSON file.
   */
  public loadEnvironment(envName: string): Record<string, any> {
    const envPath = join(process.cwd(), 'config', `${envName}.json`);
    const envConfig = JSON.parse(readFileSync(envPath, 'utf-8'));
    
    // Deep merge ensuring baseConfig is not mutated
    return merge({}, this.baseConfig, envConfig);
  }
}
```

### 3. Integration into Application Entry
Update `src/index.ts` to use the new loader.
```typescript
import { ConfigMerger } from './core/ConfigMerger';

const loader = new ConfigMerger('./config');
const config = loader.loadEnvironment(process.env.NODE_ENV || 'development');

export default config;
```

## Verification
- Unit test `ConfigMerger` with nested objects to ensure properties are not overwritten but merged.
- Verify that `production.json` correctly overrides `base.json` for specific keys.
- Run `npm list lodash` to confirm dependency is correctly installed.

## Risks
- **Performance:** For extremely large configuration files, the overhead of Lodash might be measurable, though unlikely in a standard startup sequence.
- **Bundle Size:** Adding Lodash increases the overall package size, which should be monitored if used in a serverless environment.
