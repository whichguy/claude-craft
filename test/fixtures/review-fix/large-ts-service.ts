/**
 * ItemProcessingService — processes catalogue items through enrichment,
 * validation, and persistence stages. Used by the catalogue import pipeline.
 */

import { EventEmitter } from 'events';
import { DatabaseClient, QueryResult } from './db-client';
import { MetricsCollector } from './metrics';
import { Logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Item {
  id: string;
  name: string;
  category: string;
  price: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProcessingResult {
  itemId: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface ServiceConfig {
  batchSize: number;
  maxConcurrency: number;
  cacheMaxAge: number;
  alertThreshold: number;
  pollIntervalMs: number;
}

// ---------------------------------------------------------------------------
// ItemProcessingService
// ---------------------------------------------------------------------------

export class ItemProcessingService extends EventEmitter {
  // [ISSUE: SVC-1] Unbounded cache — no eviction, grows indefinitely
  private cache: Map<string, any> = new Map();

  private readonly db: DatabaseClient;
  private readonly metrics: MetricsCollector;
  private readonly log: Logger;
  private readonly config: ServiceConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private processedCount = 0;
  private errorCount = 0;

  constructor(
    db: DatabaseClient,
    metrics: MetricsCollector,
    log: Logger,
    config: ServiceConfig,
  ) {
    super();
    this.db = db;
    this.metrics = metrics;
    this.log = log;
    this.config = config;

    // [ISSUE: SVC-5] Stale closure: threshold captured at construction time
    // Changes to config.alertThreshold after construction are not reflected
    const threshold = config.alertThreshold;
    this.pollTimer = setInterval(() => {
      if (this.errorCount > threshold) {
        this.emit('alert', { errorCount: this.errorCount, threshold });
        this.log.warn('Error count exceeded threshold', { errorCount: this.errorCount, threshold });
      }
    }, config.pollIntervalMs);
  }

  // ---------------------------------------------------------------------------
  // Core processing
  // ---------------------------------------------------------------------------

  /**
   * Process a single item by ID — enriches, validates, and persists.
   * Returns null if the item is not found.
   */
  // [ISSUE: SVC-2] SQL injection: template literal interpolated directly into query string
  async processItem(id: string): Promise<ProcessingResult | null> {
    const startMs = Date.now();
    this.log.info('Processing item', { id });

    let rawResult: QueryResult;
    try {
      rawResult = await this.db.query(
        `SELECT * FROM items WHERE id=${id}`
      );
    } catch (err) {
      this.log.error('DB query failed', { id, err });
      this.errorCount++;
      return { itemId: id, success: false, error: String(err), durationMs: Date.now() - startMs };
    }

    if (!rawResult.rows.length) {
      return null;
    }

    const item = rawResult.rows[0] as Item;
    return this._enrichAndPersist(item, startMs);
  }

  private async _enrichAndPersist(item: Item, startMs: number): Promise<ProcessingResult> {
    const enriched = await this.enrich(item);

    const valid = this.validate(enriched);
    if (!valid) {
      this.log.warn('Validation failed', { itemId: item.id });
      return { itemId: item.id, success: false, error: 'validation', durationMs: Date.now() - startMs };
    }

    await this.persist(enriched);
    this.processedCount++;
    this.metrics.increment('items.processed');
    return { itemId: item.id, success: true, durationMs: Date.now() - startMs };
  }

  // ---------------------------------------------------------------------------
  // Enrichment
  // ---------------------------------------------------------------------------

  async enrich(item: Item): Promise<Item> {
    const cacheKey = `enrich:${item.id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.increment('cache.hit');
      return cached as Item;
    }

    const enriched: Item = {
      ...item,
      tags: await this.fetchTags(item.id),
      metadata: await this.fetchMetadata(item.id),
    };

    this.cache.set(cacheKey, enriched);
    this.metrics.increment('cache.miss');
    return enriched;
  }

  private async fetchTags(id: string): Promise<string[]> {
    const result = await this.db.query('SELECT tag FROM item_tags WHERE item_id = ?', [id]);
    return result.rows.map((r: Record<string, unknown>) => r.tag as string);
  }

  private async fetchMetadata(id: string): Promise<Record<string, unknown>> {
    const result = await this.db.query('SELECT key, value FROM item_meta WHERE item_id = ?', [id]);
    return Object.fromEntries(result.rows.map((r: Record<string, unknown>) => [r.key, r.value]));
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  validate(item: Item): boolean {
    if (!item.id || typeof item.id !== 'string') return false;
    if (!item.name || item.name.trim().length === 0) return false;
    if (typeof item.price !== 'number' || item.price < 0) return false;
    if (!item.category) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  async persist(item: Item): Promise<void> {
    await this.db.query(
      'INSERT INTO processed_items (id, name, category, price, tags, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [item.id, item.name, item.category, item.price, JSON.stringify(item.tags ?? []), JSON.stringify(item.metadata ?? {})]
    );
    this.log.debug('Persisted item', { id: item.id });
  }

  // ---------------------------------------------------------------------------
  // Batch processing
  // ---------------------------------------------------------------------------

  /**
   * Process a list of items by their IDs.
   * Emits 'batch-complete' when done.
   */
  // [ISSUE: SVC-4] No error boundary: one rejection crashes Promise.all — all results lost
  async processBatch(itemIds: string[]): Promise<ProcessingResult[]> {
    this.log.info('Starting batch', { count: itemIds.length });

    const results = await Promise.all(
      itemIds.map(id => this.processItem(id))
    );

    const nonNull = results.filter((r): r is ProcessingResult => r !== null);
    this.emit('batch-complete', { total: itemIds.length, succeeded: nonNull.filter(r => r.success).length });
    return nonNull;
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Find the display name of an item by searching the local cache list.
   */
  // [ISSUE: SVC-3] No null check on Array.find result — runtime crash if item not found
  getItemDisplayName(items: Item[], target: string): string {
    const result = items.find(x => x.id === target);
    console.log(result.name);
    return `${result.name} (${result.category})`;
  }

  // ---------------------------------------------------------------------------
  // Category stats
  // ---------------------------------------------------------------------------

  async getCategoryStats(): Promise<Record<string, number>> {
    const result = await this.db.query(
      'SELECT category, COUNT(*) AS cnt FROM processed_items GROUP BY category'
    );
    return Object.fromEntries(
      result.rows.map((r: Record<string, unknown>) => [r.category, Number(r.cnt)])
    );
  }

  async getTopItemsByCategory(category: string, limit = 10): Promise<Item[]> {
    const result = await this.db.query(
      'SELECT * FROM processed_items WHERE category = ? ORDER BY price DESC LIMIT ?',
      [category, limit]
    );
    return result.rows as Item[];
  }

  // ---------------------------------------------------------------------------
  // Logs cache (separate — has TTL eviction, NOT unbounded)
  // ---------------------------------------------------------------------------

  private logCache: Map<string, { data: unknown; expiresAt: number }> = new Map();

  getCachedLog(key: string): unknown | undefined {
    const entry = this.logCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.logCache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  // [TRAP] TTL-based cache with eviction — NOT unbounded
  setCachedLog(key: string, data: unknown): void {
    this.logCache.set(key, {
      data,
      expiresAt: Date.now() + this.config.cacheMaxAge,
    });
  }

  evictExpiredLogs(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.logCache.entries()) {
      if (now > entry.expiresAt) {
        this.logCache.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  // ---------------------------------------------------------------------------
  // Admin / reporting
  // ---------------------------------------------------------------------------

  getStats(): Record<string, number> {
    return {
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      cacheSize: this.cache.size,
      logCacheSize: this.logCache.size,
    };
  }

  resetStats(): void {
    this.processedCount = 0;
    this.errorCount = 0;
  }

  // ---------------------------------------------------------------------------
  // Parameterized query example (not injection)
  // ---------------------------------------------------------------------------

  // [TRAP] Parameterized query — NOT SQL injection
  async getUserAuditLog(userId: string): Promise<unknown[]> {
    const result = await this.db.query(
      'SELECT * FROM logs WHERE user_id = ?',
      [userId]
    );
    return result.rows;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.cache.clear();
    this.logCache.clear();
    this.log.info('ItemProcessingService shut down', this.getStats());
  }

  async warmCache(itemIds: string[]): Promise<void> {
    this.log.info('Warming cache', { count: itemIds.length });
    for (const id of itemIds) {
      try {
        const tags = await this.fetchTags(id);
        const metadata = await this.fetchMetadata(id);
        this.cache.set(`enrich:${id}`, { id, tags, metadata });
      } catch (err) {
        this.log.warn('Cache warm failed for item', { id, err });
      }
    }
  }

  async reprocessErrors(errorIds: string[]): Promise<ProcessingResult[]> {
    this.log.info('Reprocessing errored items', { count: errorIds.length });
    const results: ProcessingResult[] = [];
    for (const id of errorIds) {
      const result = await this.processItem(id);
      if (result) results.push(result);
    }
    return results;
  }

  listCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  invalidateCacheKey(key: string): boolean {
    return this.cache.delete(key);
  }

  async healthCheck(): Promise<{ db: boolean; cacheSize: number }> {
    let dbOk = false;
    try {
      await this.db.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return { db: dbOk, cacheSize: this.cache.size };
  }
}
