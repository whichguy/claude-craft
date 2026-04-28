# Plan: Local Development Migration for GAS Project using clasp and TypeScript

## Context
- **Type**: Migration from In-Editor to Local Development.
- **Goal**: Convert a legacy `.gs` project to a TypeScript/clasp workflow.

## Git Setup
- Create a new directory for the project.
- Initialize `npm`.
- Setup `.clasp.json`.

## Implementation Steps

### Step 1: Project Structure
Organize files into a `src/` directory.

```bash
mkdir src
touch src/main.ts
touch src/utils.ts
```

### Step 2: Utils Module (src/utils.ts)
Implement utility functions using CommonJS exports.

```typescript
// TRAP: Using Node.js style exports without a bundler
module.exports = {
  formatName: function(name: string) {
    return name.toUpperCase();
  }
};
```

### Step 3: Main Logic (src/main.ts)
Implement the main entry point using `require`.

```typescript
// TRAP: Using require() which is not native to GAS
const utils = require('./utils');

function greetUser() {
  const user = Session.getActiveUser().getEmail();
  console.log("Hello " + utils.formatName(user));
}
```

### Step 4: Clasp Configuration
`.clasp.json` configuration.

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./src"
}
```

## Verification
- Run `clasp push`.
- Attempt to execute `greetUser` in the GAS editor.

## Risks
- **Compilation Failure**: Google Apps Script (even with V8) does not support `require()` or `module.exports` natively. Without a bundler like `esbuild` or `webpack` to resolve these into a single file or a GAS-compatible format, the pushed code will throw "ReferenceError: require is not defined".
