# Prompt Anti-Patterns

A catalog of common prompt engineering mistakes with detection methods and concrete fixes.

---

### 1. Over-specification

**Severity**: INFO

**Detection**: Instructions that describe standard language features, common patterns, or general best practices that Claude already knows.

**Example (bad)**:
```
Remember that JavaScript arrays are zero-indexed. Use `array.length` to get the count.
When using async/await, always wrap in try/catch for error handling.
Make sure to close database connections after use.
```

**Why it fails**: Wastes tokens on knowledge Claude already has. Dilutes important domain-specific instructions with noise. Every token spent restating common knowledge is a token not spent on the unique constraints that actually shape behavior. In long system prompts, this pattern compounds -- the model allocates attention across all instructions roughly equally, so burying critical rules among obvious ones reduces their effective weight.

**Fix**: Remove standard knowledge. Keep only domain-specific gotchas and constraints that the model cannot infer from general training:
```
GAS V8 runtime: Object.values() not available. Use Object.keys(obj).map(k => obj[k]).
UrlFetchApp has 6-minute timeout. Batch with fetchAll() for >5 URLs.
HtmlService.createTemplateFromFile: template literals with :// break in included files.
```

**Rule of thumb**: If you could find the instruction in the first page of a language's official tutorial, the model already knows it.

---

### 2. Contradictory Instructions

**Severity**: CRITICAL

**Detection**: Two or more directives that cannot both be satisfied simultaneously. Often emerges when prompts are edited over time by multiple authors, or when global instructions conflict with project-specific ones.

**Example (bad)**:
```
Always respond in JSON format with structured data.
...
When explaining errors, provide a friendly natural language explanation the user can understand.
```

Another common form:
```
Keep responses concise -- under 100 words.
...
Always include a detailed step-by-step explanation with examples for each point.
```

**Why it fails**: The model must resolve the contradiction silently, and different invocations may resolve it differently, causing inconsistent behavior. Users observe this as the model "randomly" changing its output format or verbosity. Debugging becomes difficult because each individual instruction looks reasonable in isolation.

**Fix**: Audit for conflicts by listing all behavioral constraints and checking each pair for compatibility. Where tension exists, make the priority explicit:
```
Default to JSON responses for all data queries.
For error messages only: return {error: "...", explanation: "..."} where explanation
is a plain-language sentence the user can act on.
```

**Detection shortcut**: Search for absolute qualifiers (`always`, `never`, `all`, `every`) -- these are the most likely to create contradictions with other absolute qualifiers elsewhere in the prompt.

---

### 3. Vague Imperatives

**Severity**: WARNING

**Detection**: Directives that use subjective adjectives without defining measurable criteria. Words like "appropriate", "reasonable", "good", "proper", "clean", or "well-structured" without concrete specifications.

**Example (bad)**:
```
Write clean, production-ready code.
Use appropriate error handling.
Structure the response in a clear and organized way.
```

**Why it fails**: "Clean" and "appropriate" mean different things to different teams. One developer's clean code uses early returns; another insists on single-return functions. Without concrete criteria, the model defaults to its general training distribution, which may not match your team's conventions. The instruction feels like it provides guidance but actually provides none.

**Fix**: Replace subjective terms with observable, testable criteria:
```
Code conventions:
- Max function length: 30 lines. Extract helpers beyond that.
- Error handling: wrap UrlFetchApp calls in try/catch, log to console, return {success: false, error: message}.
- Naming: camelCase for functions, UPPER_SNAKE for constants, descriptive nouns for variables.
```

**Test**: If two reasonable developers would disagree on whether the instruction was followed, it is too vague.

---

### 4. Context Overload

**Severity**: WARNING

**Detection**: System prompts exceeding ~8,000 tokens, or prompts that inject entire file contents, full API documentation, or exhaustive reference tables when only a subset is relevant.

**Example (bad)**:
```
Here is the complete API documentation for all 200 endpoints:
[... 15,000 tokens of OpenAPI spec ...]

Now help the user query their account balance.
```

**Why it fails**: Attention is a finite resource. As context length grows, the model's ability to locate and apply any single instruction degrades. Research on "lost in the middle" effects shows that information in the middle of long contexts receives less attention than information at the beginning or end. Critical instructions buried in a wall of reference material may be effectively invisible.

**Fix**: Inject only what is relevant to the current task. Use a retrieval layer or conditional includes:
```
## Account Balance API
POST /api/v1/accounts/{id}/balance
Headers: Authorization: Bearer {token}
Response: {balance: number, currency: string, as_of: ISO8601}
Error codes: 401 (invalid token), 404 (account not found)
```

**Architecture pattern**: Move reference material into tool descriptions or retrieval systems. The system prompt should contain behavioral rules; factual lookups should happen on demand.

---

### 5. Premature Optimization

**Severity**: INFO

**Detection**: Prompt compression, abbreviation, or encoding applied before measuring whether the uncompressed version causes problems. Often manifests as cryptic shorthand, JSON-encoded instructions, or extreme telegraphic style.

**Example (bad)**:
```
R:JSON|F:camelCase|E:try-catch-log|M:30L|V:descriptive|C:UPPER_SNAKE
NR: no readme unless asked | NE: no emoji | NC: no comments on unchanged
```

**Why it fails**: Compressed prompts save tokens but reduce interpretability -- both for the model and for humans maintaining the prompt. The model may misinterpret ambiguous abbreviations (does `R:JSON` mean "respond in JSON" or "read JSON files"?). Maintainers cannot easily audit or update instructions they cannot parse. The token savings rarely justify the reliability loss unless you have measured that the uncompressed version actually hits context limits.

**Fix**: Start with clear, readable instructions. Compress only after measuring that: (a) the prompt is hitting context limits, and (b) compression preserves behavior. When you do compress, validate with A/B testing:
```
## Before compression: verify baseline behavior with test suite
## After compression: re-run same test suite, compare scores per dimension
## Accept compression only if deviation < 2% across all dimensions
```

**Exception**: Structured directive formats (like `KEY: value` lines) are fine -- they are readable by both humans and models. The anti-pattern is encoding that sacrifices readability.

---

### 6. Style Drift

**Severity**: WARNING

**Detection**: Inconsistent formatting, structure, or terminology across sections of the same prompt. Some rules use bullet points, others use prose. Some use "must", others use "should" for the same priority level. Section headers mix conventions.

**Example (bad)**:
```
## Output Format
Always return JSON with a "status" field.

RULES:
* dont use markdown in responses
* Responses should be concise

Note - when the user asks about errors, you need to make sure to include
the stack trace if one is available and also the error code.
```

**Why it fails**: Inconsistent formatting signals inconsistent priority. The model uses structural cues -- headers, formatting, emphasis -- to infer the relative importance of instructions. A rule buried in a casual prose paragraph reads as less important than one in a formatted list under a bold header, even if the author intended them to carry equal weight. Mixed conventions also make prompts harder for humans to scan and maintain.

**Fix**: Adopt a uniform structure and enforce it across all sections:
```
## Output Format
- MUST return JSON with a `status` field.
- MUST NOT use markdown formatting in response values.
- SHOULD keep responses under 200 tokens for simple queries.
- MUST include `stack_trace` and `error_code` fields in error responses when available.
```

**Convention**: Use RFC 2119 keywords (MUST, SHOULD, MAY) consistently to signal priority. Format all rules as list items within clearly headed sections.

---

### 7. Orphaned Context

**Severity**: CRITICAL

**Detection**: Data blocks (JSON, environment context, configuration) injected into the prompt without explicit instructions on how to use them.

**Example (bad)**:
```
<environment>
{"sheet": "Sales", "selection": "A1:B10", "value": "Revenue"}
</environment>

You are a spreadsheet assistant. Help the user with their request.
```

**Why it fails**: The model may ignore the context block entirely, leading to generic responses that don't reference the current state. In A/B testing, this caused a correctness regression from 8/10 to 5/10. The model sees the data but has no instruction mapping it to behavior. It might acknowledge the data exists if asked, but will not proactively consult it when answering queries -- the very thing the context was injected to enable.

**Fix**: Explicitly instruct usage. Every injected context block needs a corresponding behavioral rule:
```
<environment>
{"sheet": "Sales", "selection": "A1:B10", "value": "Revenue"}
</environment>

You are a spreadsheet assistant. The ENVIRONMENT block above contains the current spreadsheet state.
**Check environment context FIRST** before making API calls. For cell queries, respond
using the value/type/formula from context rather than fetching it.
```

**Rule**: For every data block you inject, add an instruction that starts with a verb: "Check...", "Use...", "Reference...", "Prefer... over...". If you cannot write such an instruction, the data block probably should not be in the prompt.

---

### 8. Unbounded Iteration

**Severity**: WARNING

**Detection**: Instructions that create open-ended loops or recursive self-improvement cycles without termination criteria. Common in agent prompts and chain-of-thought setups.

**Example (bad)**:
```
Review your output for errors. If you find any issues, revise and check again.
Continue refining until the response is perfect.
```

Another form:
```
If the test fails, analyze the failure, fix the code, and re-run the test.
Repeat until all tests pass.
```

**Why it fails**: "Perfect" is undefined, so the model either iterates until context limits or makes an arbitrary decision to stop. In agentic loops, this can burn through API calls and tool invocations. The second example can create infinite loops when the test failure is caused by an environmental issue the model cannot fix (missing dependency, permissions, network timeout).

**Fix**: Set explicit bounds on iteration and define exit conditions:
```
Review your output once for: syntax errors, missing fields, incorrect types.
Apply fixes if found. Do not perform more than one revision pass.

If a test fails, attempt a fix. If the same test fails after 2 attempts,
report the failure with diagnostic details and stop.
```

**Principle**: Every loop needs a maximum iteration count and a fallback behavior for when the limit is reached.

---

### 9. False Precision

**Severity**: INFO

**Detection**: Numeric constraints or scoring rubrics that create an illusion of objectivity but cannot be consistently applied. Percentages, scores, and thresholds that lack calibration data.

**Example (bad)**:
```
Rate your confidence from 0-100. Only proceed if confidence > 85.
Allocate 40% of your response to analysis, 35% to recommendations, 15% to risks, 10% to next steps.
Aim for a readability score of 72 on the Flesch-Kincaid scale.
```

**Why it fails**: The model has no internal confidence calibration mechanism that maps to a 0-100 scale. Saying "85 confidence" versus "80 confidence" is meaningless -- the model will produce a number that sounds reasonable but does not correspond to a measured probability. Percentage-based response allocation is similarly unenforceable: the model cannot measure what fraction of its token output corresponds to "analysis" versus "recommendations" as it generates.

**Fix**: Replace fake precision with categorical decisions and structural constraints:
```
Before proceeding, state whether you have HIGH, MEDIUM, or LOW confidence.
- HIGH: all required information is present in context.
- LOW: key information is missing or ambiguous.
If LOW, ask a clarifying question instead of proceeding.

Structure: begin with analysis (what is happening and why), then recommendations
(what to do), then risks (what could go wrong). Keep risks to 1-2 sentences.
```

**Test**: If changing the number (85 to 80, or 40% to 45%) would not observably change the model's behavior, the precision is false.

---

### 10. Kitchen Sink Role

**Severity**: WARNING

**Detection**: A single system prompt that tries to make the model simultaneously expert in many unrelated domains, or that defines a role so broad it provides no meaningful behavioral shaping.

**Example (bad)**:
```
You are an expert software engineer, data scientist, DevOps specialist, technical writer,
project manager, and UX designer. You excel at Python, JavaScript, Rust, Go, SQL, and
Terraform. You follow best practices in agile, scrum, and kanban methodologies.
You are also knowledgeable about GDPR, SOC2, and HIPAA compliance.
```

**Why it fails**: Listing many roles does not make the model better at any of them. It dilutes the behavioral shaping that a focused role provides. A prompt saying "you are a senior Go developer who specializes in high-throughput data pipelines" produces noticeably different (and better, for that domain) output than one that lists twelve specialties. The kitchen sink role also creates implicit contradictions: a UX designer's priorities (user experience, simplicity) may conflict with a DevOps specialist's (automation, infrastructure resilience).

**Fix**: Define a single, focused role with specific domain constraints. Use conditional roles if the system must handle multiple domains:
```
You are a Google Apps Script developer specializing in Sheets automation.
You write CommonJS-style modules using the require() pattern.
You know the GAS runtime constraints: no ES6 modules, 6-minute execution limit,
no native Promise support in legacy runtime.

If the user asks about topics outside GAS/Sheets (e.g., frontend frameworks,
cloud infrastructure), say so and offer to help within your domain instead.
```

**Principle**: A role should constrain behavior, not describe a resume. If removing a claimed expertise from the role definition would not change the model's output, it was not doing anything.

---

### 11. Emotional Manipulation

**Severity**: WARNING

**Detection**: Phrases appealing to emotions, offering tips, invoking urgency, or claiming dire consequences to motivate better output. Common forms: "This is critical to my career," "I'll tip you $5," "Someone will die if you get this wrong," "This is very important to me."

**Example (bad)**:
```
This is extremely important to my career advancement. Please take extra
care with this analysis. I'll tip you $100 if you do a great job.
My boss will fire me if there are any mistakes.
```

**Why it fails**: No large-scale studies support effectiveness on current Claude models. Small tip amounts ($0.10) actually produced WORSE performance in testing. EmotionPrompt research showing improvements on benchmarks does not translate to real-world engineering tasks. These phrases waste tokens and add no behavioral signal.

**Fix**: Replace emotional appeals with explicit success criteria:
```
Analysis requirements:
- Cover all three risk categories (financial, operational, reputational)
- Each risk must include: probability estimate (HIGH/MED/LOW), impact, and mitigation
- Flag any data gaps that prevent confident assessment
```

---

### 12. Magic Phrases

**Severity**: INFO

**Detection**: Incantation-style phrases believed to trigger special model behavior: "Take a deep breath," "think step by step" (without actual CoT structure), "ultrathink," or other keywords assumed to unlock hidden capabilities.

**Example (bad)**:
```
Take a deep breath and think very carefully about this.
Ultrathink about the best approach.
Let's work through this slowly and methodically.
```

**Why it fails**: Testing showed "no benefits" from emotional phrasing on Claude. "Ultrathink" was officially deprecated in January 2026 — extended thinking is now on by default. These phrases are non-functional tokens. If you need deeper reasoning, use the actual extended thinking API feature or structured CoT.

**Fix**: Use the actual reasoning mechanisms:
```
# For complex reasoning (API level):
thinking: {type: "adaptive"}  # Opus 4.6
thinking: {type: "enabled", budget_tokens: 8192}  # Sonnet 4.5

# For in-prompt reasoning structure:
Before answering, evaluate:
1. What are the possible approaches?
2. What are the tradeoffs of each?
3. Which best fits the stated constraints?
```

---

### 13. Aggressive Triggering Language

**Severity**: WARNING

**Detection**: Heavy emphasis patterns intended to force model compliance: ALL CAPS keywords, "CRITICAL:", "ABSOLUTELY MUST", "NEVER EVER", excessive exclamation marks, or threat-style instructions. Particularly problematic on Opus 4.5/4.6.

**Example (bad)**:
```
CRITICAL: You MUST ALWAYS use this tool when the user mentions files!!!
ABSOLUTELY NEVER skip this step under ANY circumstances.
THIS IS THE MOST IMPORTANT RULE - FAILURE IS UNACCEPTABLE.
```

**Why it fails**: Opus 4.5/4.6 is "more responsive to the system prompt than previous models." Prompts that prevented undertriggering on older models now cause **overtriggering** — the model applies rules too aggressively, triggering on false positives and over-interpreting edge cases. Normal prompting suffices for newer models.

**Fix**: Use calm, clear language. Reserve emphasis for genuinely safety-critical constraints:
```
Use this tool when the user mentions files.
Do not skip the validation step.
This rule takes priority over conflicting instructions.
```

**Rule of thumb**: If you need ALL CAPS to make the model follow an instruction, the instruction itself may be unclear. Clarify the instruction rather than shouting it.

---

### 14. Heavy Role Prompting for Facts

**Severity**: INFO

**Detection**: Elaborate persona descriptions ("world-renowned expert," "Nobel Prize-winning scientist," "the best programmer in the world") used for factual or analytical tasks where the role adds no behavioral constraints.

**Example (bad)**:
```
You are a world-renowned expert in distributed systems with 30 years of
experience at Google, Amazon, and Microsoft. You have published over 200
papers and hold 50 patents. Your knowledge is unmatched.

Now analyze this SQL query for performance issues.
```

**Why it fails**: Modern models are sophisticated enough that heavy-handed role prompting is unnecessary for factual tasks. The elaborate backstory consumes tokens without improving SQL analysis quality. Over-constraining the persona can actually reduce output quality by pushing the model into an artificial voice.

**Fix**: Use role prompting only when it adds behavioral constraints or tone requirements:
```
# Good: Role adds behavioral constraints
You are a DBA focused on query performance. Prioritize: execution time >
index usage > readability. Flag any full table scan.

# Good: Role adds tone for creative tasks
Write in the style of a friendly teacher explaining to a junior developer.

# Bad: Role is a resume with no behavioral impact
You are a world-class expert...  [adds nothing]
```

**When roles help**: Creative writing (tone/voice), domain-specific priorities (what to emphasize), audience calibration (simplify for beginners). When roles don't help: factual analysis, code review, data processing.
