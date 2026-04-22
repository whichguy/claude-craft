export class CacheRegistry {
  constructor() {
    this.cache = new Map();
  }

  registerByMetadata(items) {
    items.forEach(item => {
      const key = `${item.category}-${item.priority}`;
      this.cache.set(key, item);
    });
  }

  get(category, priority) {
    return this.cache.get(`${category}-${priority}`);
  }
}
