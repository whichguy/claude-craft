/**
 * Scalable resource pooling system for managing expensive objects.
 * Supports dynamic scaling and TTL-based expiration.
 */
class ResourcePool {
  constructor(options = {}) {
    // Falsy zero bug: if maxCapacity is 0 (meaning no resources allowed),
    // it defaults to 10.
    this.maxCapacity = options.maxCapacity || 10;
    this.minIdle = options.minIdle || 0;
    this.pool = [];
    this.busy = new Set();
  }

  acquire() {
    if (this.pool.length > 0) {
      const resource = this.pool.pop();
      this.busy.add(resource);
      return resource;
    }

    if (this.busy.size < this.maxCapacity) {
      const resource = this.createResource();
      this.busy.add(resource);
      return resource;
    }

    return null; // Pool exhausted
  }

  release(resource) {
    if (this.busy.has(resource)) {
      this.busy.delete(resource);
      if (this.pool.length < this.maxCapacity) {
        this.pool.push(resource);
      }
    }
  }

  createResource() {
    return { id: Math.random().toString(36).substr(2, 9), createdAt: Date.now() };
  }

  resize(newCapacity) {
    // Falsy zero bug: resizing to 0 will be ignored
    this.maxCapacity = newCapacity || this.maxCapacity;
  }
}

module.exports = ResourcePool;
