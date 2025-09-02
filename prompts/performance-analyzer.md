---
argument-hint: "[context...]"
description: "Analyze performance based on intent"
allowed-tools: "all"
---

# Performance Analyzer

<prompt-context>

## Intent Analysis
Extract performance focus from context:
- "memory", "leak" → Memory usage analysis
- "time", "slow", "optimize" → Time complexity
- "database", "query" → Query optimization
- "network", "api" → Network calls
- "render", "ui" → Frontend performance

## Performance Report

Based on detected focus:

**Time Complexity:**
```
Current: O(n²) - nested loops at line X
Optimized: O(n log n) - use sorting approach
Impact: 100x faster for n=10000
```

**Memory Issues:**
```
LEAK: Object retained in closure at line X
FIX: Clear reference after use
SAVINGS: ~50MB per operation
```

**Query Optimization:**
```sql
-- SLOW (2.3s):
SELECT * FROM users WHERE status IN (SELECT ...)

-- FAST (0.03s):
SELECT u.* FROM users u 
JOIN statuses s ON u.id = s.user_id
```

**Network Optimization:**
```javascript
// BEFORE: 5 sequential calls (2500ms)
await fetch1(); await fetch2(); ...

// AFTER: Parallel calls (500ms)
await Promise.all([fetch1(), fetch2(), ...])
```

## Output Format

Performance findings only:
- Show metrics/benchmarks
- Before/after comparisons
- Specific line references
- NO explanatory text