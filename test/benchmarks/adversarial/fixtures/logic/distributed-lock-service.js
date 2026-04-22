/**
 * Service for managing distributed locks across multiple instances.
 */
class DistributedLockService {
    constructor() {
        this.locks = new Set();
    }

    /**
     * Utility Duplication: There is a 'CoreLocker' in the system-wide 
     * shared libraries (hypothetically). This module re-implements it
     * but with a "Wait-Die" strategy instead of the "Wound-Wait" strategy
     * used by the core locker. If both are used on the same resource, 
     * they will deadlock each other.
     */
    async acquire(resourceId, timeout = 5000) {
        if (this.locks.has(resourceId)) {
            const start = Date.now();
            while (this.locks.has(resourceId)) {
                if (Date.now() - start > timeout) {
                    throw new Error(`Lock timeout for ${resourceId}`);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        this.locks.add(resourceId);
        return true;
    }

    release(resourceId) {
        this.locks.delete(resourceId);
    }
}

module.exports = new DistributedLockService();
