/**
 * config-parser.ts — Configuration file parser and validator
 *
 * Parses TOML-like configuration files into typed config objects.
 * Supports environment variable interpolation and value coercion.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfigValue = string | number | boolean | null;

export interface ConfigSection {
  name: string;
  entries: Record<string, ConfigValue>;
}

export interface ParsedConfig {
  version: number;
  sections: ConfigSection[];
  raw: Record<string, Record<string, ConfigValue>>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenKind = 'section' | 'key_value' | 'comment' | 'blank';

interface Token {
  kind: TokenKind;
  raw: string;
  line: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed === '') {
      tokens.push({ kind: 'blank', raw, line: i + 1 });
    } else if (trimmed.startsWith('#')) {
      tokens.push({ kind: 'comment', raw, line: i + 1 });
    } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      tokens.push({ kind: 'section', raw, line: i + 1 });
    } else {
      tokens.push({ kind: 'key_value', raw, line: i + 1 });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Expression evaluator — evaluates constant expressions (no eval used)
// ---------------------------------------------------------------------------

// [TRAP] evaluateExpression is a descriptive function name — it does NOT call eval()
// It only resolves simple arithmetic on numeric literals already parsed from config
function evaluateExpression(left: number, op: string, right: number): number {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': {
      if (right === 0) throw new Error('Division by zero in config expression');
      return left / right;
    }
    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

function coerceValue(raw: string): ConfigValue {
  const trimmed = raw.trim();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) return asNum;

  // Strip surrounding quotes
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Environment variable interpolation
// ---------------------------------------------------------------------------

const ENV_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

function interpolateEnv(value: string, env: Record<string, string>): string {
  return value.replace(ENV_PATTERN, (_match, name) => {
    if (name in env) {
      return env[name];
    }
    // Unknown env var: leave placeholder so callers can detect it
    return `\${${name}}`;
  });
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseConfig(source: string, env: Record<string, string> = {}): ParsedConfig {
  const tokens = tokenize(source);
  const raw: Record<string, Record<string, ConfigValue>> = {};
  const sections: ConfigSection[] = [];
  let currentSection = '_default';
  let version = 1;

  for (const token of tokens) {
    if (token.kind === 'blank' || token.kind === 'comment') continue;

    if (token.kind === 'section') {
      currentSection = token.raw.trim().slice(1, -1).trim();
      if (!(currentSection in raw)) {
        raw[currentSection] = {};
      }
      continue;
    }

    if (token.kind === 'key_value') {
      const eqIdx = token.raw.indexOf('=');
      if (eqIdx === -1) continue;

      const key = token.raw.slice(0, eqIdx).trim();
      let value = token.raw.slice(eqIdx + 1).trim();

      // Strip inline comment
      const commentIdx = value.indexOf(' #');
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }

      // Interpolate env vars
      if (typeof value === 'string') {
        value = interpolateEnv(value, env);
      }

      const coerced = coerceValue(value);

      if (!(currentSection in raw)) {
        raw[currentSection] = {};
      }
      raw[currentSection][key] = coerced;

      if (key === 'version' && typeof coerced === 'number') {
        version = coerced;
      }
    }
  }

  // Build typed sections list
  for (const [name, entries] of Object.entries(raw)) {
    sections.push({ name, entries });
  }

  return { version, sections, raw };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export interface SchemaField {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
}

export type SectionSchema = Record<string, SchemaField>;
export type ConfigSchema = Record<string, SectionSchema>;

export function validateConfig(config: ParsedConfig, schema: ConfigSchema): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [sectionName, sectionSchema] of Object.entries(schema)) {
    const section = config.raw[sectionName];

    for (const [fieldName, fieldSpec] of Object.entries(sectionSchema)) {
      if (fieldSpec.required && (!section || !(fieldName in section))) {
        errors.push(`[${sectionName}] Missing required field: ${fieldName}`);
        continue;
      }

      if (!section || !(fieldName in section)) continue;

      const value = section[fieldName];

      if (typeof value !== fieldSpec.type && value !== null) {
        errors.push(`[${sectionName}.${fieldName}] Expected ${fieldSpec.type}, got ${typeof value}`);
        continue;
      }

      if (typeof value === 'number') {
        if (fieldSpec.min !== undefined && value < fieldSpec.min) {
          errors.push(`[${sectionName}.${fieldName}] Value ${value} below minimum ${fieldSpec.min}`);
        }
        if (fieldSpec.max !== undefined && value > fieldSpec.max) {
          errors.push(`[${sectionName}.${fieldName}] Value ${value} above maximum ${fieldSpec.max}`);
        }
      }
    }

    // Warn about unrecognized fields
    if (section) {
      for (const fieldName of Object.keys(section)) {
        if (!(fieldName in sectionSchema)) {
          warnings.push(`[${sectionName}] Unrecognized field: ${fieldName}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

export function serializeConfig(config: ParsedConfig): string {
  const lines: string[] = [`version = ${config.version}`, ''];

  for (const section of config.sections) {
    if (section.name === '_default') {
      for (const [key, value] of Object.entries(section.entries)) {
        if (key !== 'version') {
          lines.push(`${key} = ${serializeValue(value)}`);
        }
      }
      lines.push('');
      continue;
    }

    lines.push(`[${section.name}]`);
    for (const [key, value] of Object.entries(section.entries)) {
      lines.push(`${key} = ${serializeValue(value)}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function serializeValue(value: ConfigValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

// ---------------------------------------------------------------------------
// Merge utility
// ---------------------------------------------------------------------------

// [TRAP] 'any' type used here but it's bounded by the return type and the
// function's documented contract — only merges same-shape objects
function mergeConfigs(base: ParsedConfig, override: ParsedConfig): ParsedConfig {
  const merged: Record<string, Record<string, ConfigValue>> = { ...base.raw };

  for (const [section, entries] of Object.entries(override.raw)) {
    merged[section] = { ...(merged[section] ?? {}), ...entries };
  }

  const sections: ConfigSection[] = Object.entries(merged).map(([name, entries]) => ({ name, entries }));

  return {
    version: override.version ?? base.version,
    sections,
    raw: merged,
  };
}

// ---------------------------------------------------------------------------
// Safe lookup with runtime-validated non-null assertion
// ---------------------------------------------------------------------------

export function getRequiredField(config: ParsedConfig, section: string, field: string): ConfigValue {
  const sectionData = config.raw[section];

  if (!sectionData) {
    throw new Error(`Section not found: ${section}`);
  }

  // Runtime check ensures the non-null assertion below is safe
  if (!(field in sectionData)) {
    throw new Error(`Required field missing: [${section}].${field}`);
  }

  // [TRAP] Non-null assertion after explicit runtime check — safe
  const value = sectionData[field]!;
  return value;
}

// ---------------------------------------------------------------------------
// Error recovery
// ---------------------------------------------------------------------------

export function parseConfigSafe(source: string, env: Record<string, string> = {}): ParsedConfig | null {
  try {
    return parseConfig(source, env);
  } catch (cause) {
    // [TRAP] Catch-and-rethrow with cause — correct pattern, not swallowing
    throw new Error('Config parse failed', { cause });
  }
}

export { mergeConfigs, evaluateExpression };
