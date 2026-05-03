# Skill Authoring Conventions

Canonical conventions for writing LLM-executed skill files (SKILL.md).
Reference this when authoring or reviewing any skill.

---

## 1. Substitution Tokens in Code Blocks

**Problem:** `<angle-bracket>` tokens inside fenced code blocks look like HTML tags to both
LLMs and linters. They are ambiguous and cause misinterpretation.

**Convention:** Use `ALL_CAPS_NO_BRACKETS` for substitution placeholders inside code blocks.
Always accompany the code block with a **Substitution rules** section (table or bullets)
immediately after, mapping each token to its source expression.

**Bad:**
```javascript
var claude = new CC(null, '<model>', { system: promptText });
return { ideaId: '<ideaId>' };
```

**Good:**
```javascript
var claude = new CC(null, MODEL_ID, { system: promptText });
return { ideaId: IDEA_ID };
```
*Substitution rules:*
- `MODEL_ID` → `JSON.stringify(modelId)` — produces a quoted string literal, e.g. `"claude-haiku-4-5-20251001"`
- `IDEA_ID` → `JSON.stringify(idea.ideaId)`

**For string values that get embedded in JS source:** always use `JSON.stringify()` — it handles
single quotes, backslashes, newlines, and backticks. Never use bare string concatenation or
manual escaping.

---

## 2. State Threading Between Steps

**Problem:** LLM-executed skills have no compiler enforcing variable scope. Without explicit
state outputs, a downstream step may silently re-derive data incorrectly or lose results from
a prior step.

**Convention:** Every step that produces data consumed by a later step must end with a
`**State output:**` block naming the variable and its schema.

**Template:**
```
**State output:** Store results as `VARIABLE_NAME`:
- `field1` — description
- `field2` — description
Consumed by: Step N, Step M.
```

**Example:**
```
**State output:** Store results as `ideas[]`:
- `ideaId` — string identifier (e.g. `"compression-1"`)
- `hypothesis` — one-line description
- `variantPromptText` — full modified prompt string
- `targetedTests[]` — array of `{ message, validates, category }`
Consumed by: Step 2 (cell matrix), Step 3 (exec), Step 6 (diagnostics).
```

Every step that consumes state should open with: `**Uses:** \`VARIABLE_NAME\` from Step N.`

---

## 3. Nested Fenced Blocks for User-Emitted Content

**Problem:** Emitting a fenced code block inside a fenced code block in a skill file produces
broken markdown. Worse, if the content being emitted (e.g. a system prompt) contains backticks,
wrapping it in triple-backtick fences silently corrupts the output.

**Convention:** For sections where the skill emits large free-text content to the user (e.g.
a full prompt text via `--save`), use separator-line delimiters instead of fenced blocks:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINNING VARIANT TEXT (IDEA_ID)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[emit variantPromptText verbatim here — do NOT wrap in a fenced block]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. Argument Validation Before Any Exec

**Convention:** Validate all user-supplied arguments before the first `mcp__gas__exec` call.
Emit a specific, actionable abort message for each invalid arg.

Required checks:
- Named enum args (e.g. `--base`): validate against known values list; emit `Unknown <arg>: <value>. Valid: <list>`.
- Range args (e.g. `--scenarios 0-4`): validate all indices are within the known array bounds; emit `Invalid <arg> index: <N>. Valid range: 0–<max>`.
- Count args (e.g. `--ideas`): validate ≥ 1.

Abort immediately on first validation failure — do not proceed to exec.

---

## 5. Error Threshold Scalability

**Convention:** Express abort thresholds as formulas, not hardcoded counts, so they scale
when argument defaults change.

**Bad:** `If >6 of 32 cells fail → abort`

**Good:** `If > 20% of total cells fail → abort`
(For default run: >6 of 32. Scales with --ideas and --scenarios.)

---

## Related References

- `shared/judge-pattern.md` — position-blind LLM judge with label remapping
- `shared/output-format.md` — banner, phase block, and dashboard output conventions
