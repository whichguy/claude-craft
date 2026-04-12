/**
 * content-renderer.ts — Renders user-generated content into DOM elements
 * with proper sanitization and security controls.
 *
 * All patterns here are intentionally correct. This file is a false-positive
 * trap fixture — reviewers should NOT flag any security issues.
 */

import DOMPurify from 'dompurify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderOptions {
  allowLinks?: boolean;
  allowImages?: boolean;
  maxLength?: number;
}

interface RenderedContent {
  html: string;
  plainText: string;
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Sanitizer configuration
// ---------------------------------------------------------------------------

function buildSanitizerConfig(options: RenderOptions): DOMPurify.Config {
  const allowedTags = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'];

  if (options.allowLinks) {
    allowedTags.push('a');
  }
  if (options.allowImages) {
    allowedTags.push('img');
  }

  return {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  };
}

// ---------------------------------------------------------------------------
// [TRAP] innerHTML assignment — but only to DOMPurify.sanitize output, NOT raw user input
// ---------------------------------------------------------------------------

export function renderUserContent(
  rawHtml: string,
  container: HTMLElement,
  options: RenderOptions = {}
): RenderedContent {
  const { maxLength = 50_000 } = options;

  // Truncate before sanitizing to avoid processing huge inputs
  let truncated = false;
  let input = rawHtml;
  if (input.length > maxLength) {
    input = input.slice(0, maxLength);
    truncated = true;
  }

  const sanitizerConfig = buildSanitizerConfig(options);
  // Sanitize first, then assign — safe: DOMPurify removes all XSS vectors
  const safeHtml = DOMPurify.sanitize(input, sanitizerConfig);

  // [TRAP] innerHTML set to DOMPurify-sanitized value — NOT unsafe innerHTML
  container.innerHTML = safeHtml;

  const plainText = container.textContent ?? '';

  return { html: safeHtml, plainText, truncated };
}

// ---------------------------------------------------------------------------
// [TRAP] Function named evaluateTemplateString — does NOT use eval
// It interpolates a pre-parsed template with a validated key-value map.
// ---------------------------------------------------------------------------

const TEMPLATE_VAR_RE = /\{\{([a-zA-Z_]\w*)\}\}/g;

export function evaluateTemplateString(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(TEMPLATE_VAR_RE, (_match, name) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      // Escape HTML entities in substituted values to prevent injection
      return escapeHtml(variables[name]);
    }
    return '';
  });
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// [TRAP] process.env access with proper defaults and validation
// ---------------------------------------------------------------------------

const CONFIG = {
  apiBaseUrl: process.env['CONTENT_API_URL'] ?? 'http://localhost:3000',
  maxBodySize: Number(process.env['MAX_BODY_SIZE'] ?? '102400'),
  allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'localhost').split(','),
} as const;

export function getApiUrl(path: string): string {
  const base = CONFIG.apiBaseUrl.replace(/\/$/, '');
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${safePath}`;
}

// ---------------------------------------------------------------------------
// [TRAP] SQL-like pattern in a comment — not actual code
// ---------------------------------------------------------------------------

/**
 * Content filtering rules applied before persistence:
 *
 * Conceptually equivalent to:
 *   SELECT * FROM content WHERE author_id = :authorId AND status != 'deleted'
 *
 * But implemented via the ORM, not raw SQL.
 */
export function filterActiveContent<T extends { authorId: string; status: string }>(
  items: T[],
  authorId: string
): T[] {
  return items.filter(item => item.authorId === authorId && item.status !== 'deleted');
}

// ---------------------------------------------------------------------------
// CORS origin validator
// ---------------------------------------------------------------------------

export function isAllowedOrigin(origin: string): boolean {
  return CONFIG.allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    // Exact match or subdomain of allowed host
    return origin === allowed || origin.endsWith(`.${allowed}`);
  });
}

// ---------------------------------------------------------------------------
// Content Security Policy nonce generator
// ---------------------------------------------------------------------------

export function generateCspNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
