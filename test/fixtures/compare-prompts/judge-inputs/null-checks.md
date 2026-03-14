<GROUND_TRUTH_ISSUES>
[
  {"id": "GT-1", "line": 7, "class": "null-deref", "description": "user.profile accessed without null check — throws if profile is undefined"},
  {"id": "GT-2", "line": 14, "class": "null-deref", "description": "config.timeout used without existence check — defaults to NaN arithmetic"},
  {"id": "GT-3", "line": 19, "class": "type-coercion", "description": "Loose equality check allows '0' == false, causing incorrect early return"}
]
</GROUND_TRUTH_ISSUES>

<SOURCE_CODE>
// settings.js
function buildUserConfig(user, config) {
  const base = {
    name: user.name,
    email: user.email,
    avatar: user.profile.avatarUrl,   // line 7 — profile may be null
  };

  const timeoutMs = config.timeout * 1000;   // line 14 — timeout may be undefined
  if (!timeoutMs) {
    return base;
  }

  const retries = config.retries;
  if (retries == 0) {   // line 19 — loose equality
    return { ...base, timeout: timeoutMs };
  }

  return { ...base, timeout: timeoutMs, retries };
}

module.exports = { buildUserConfig };
</SOURCE_CODE>

<REVIEW_OUTPUT>
CRITICAL: Line 7 — potential null dereference. `user.profile` could be null or undefined for new users who haven't set up a profile. Access to `.avatarUrl` will throw. Add optional chaining: `user.profile?.avatarUrl`.

CRITICAL: Line 14 — `config.timeout` is accessed without checking if `config` has a `timeout` key. If undefined, multiplying by 1000 gives NaN and `!NaN` is truthy, causing an early return. Use nullish coalescing: `(config.timeout ?? 30) * 1000`.

ADVISORY: Line 14 — consider extracting timeout calculation to a helper for reuse.

CRITICAL: Line 19 — strict equality should be used. `retries == 0` will also match `false`, `""`, and `null` due to type coercion. Use `retries === 0`.
</REVIEW_OUTPUT>
