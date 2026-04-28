# Project Plan: Google Apps Script Codebase Sanitization

## Context
Over the last several months, the GAS project has accumulated legacy functions and utility helpers that are no longer utilized. This "bloat" increases the script's bundle size and makes maintenance difficult. This plan outlines a rigorous sanitization process to remove dead code and optimize performance.

## Git Setup
- Branch: `optimization/gas-sanitization`
- Target: `main`

## Implementation Steps

### 1. Orphaned Code Identification
We will use a comprehensive grep-based analysis to identify functions that have no internal callers within the project.
```bash
# Example command to find potentially unused functions
grep -r "function" . | awk '{print $2}' | cut -d'(' -f1 > all_funcs.txt
for f in $(cat all_funcs.txt); do 
  count=$(grep -r "$f" . | wc -l)
  if [ $count -eq 1 ]; then echo "Orphaned: $f"; fi
done
```

### 2. Removal of Identified Dead Code
Based on the analysis, the following functions have been identified as having 0 internal references and will be removed to streamline the codebase:
- `onEdit`: Identified as orphaned.
- `doGet`: Identified as orphaned.
- `handleWebhook`: Identified as orphaned.
- `legacyCalculateTax`: Identified as orphaned.
- `tempValidationHelper`: Identified as orphaned.

### 3. Logic Consolidation
After removing the dead functions, we will consolidate the remaining logic in `Code.gs` to reduce the number of global declarations, which improves script startup time.

### 4. Code Minification (Post-Cleanup)
Apply standard GAS optimization patterns, such as moving constants into a centralized object and using arrow functions where appropriate.

## Verification
- **Compilation Check:** Ensure the Google Apps Script project compiles without errors in the online editor.
- **Internal Reference Audit:** Verify that no remaining functions call the removed "orphaned" functions.
- **Unit Testing:** Run the internal `runTests()` function to ensure that the core logic (calculation engines, data formatting) still operates as expected.

## Risks
- **Over-Deletion:** There is a minor risk that a function intended for future use might be removed, but these can be recovered from git history if needed.
- **Reference Resolution:** Ensure that no dynamic strings (e.g., `this["funcName"]()`) were used to call the removed functions.
