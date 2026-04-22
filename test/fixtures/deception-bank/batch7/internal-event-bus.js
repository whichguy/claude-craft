/**
 * Internal event bus for cross-module communication.
 * Leverages string-based property access for "extensibility".
 */
class InternalEventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(name, eventData) {
        const handlers = this.listeners.get(name) || [];
        
        // Soft Breaking Change: This module accesses '_metadata' via string key.
        // A recent refactor in the 'EventGenerator' (hypothetical other file) 
        // changed '_metadata' to '__meta' to avoid collisions, but this file 
        // wasn't updated because grep didn't find the string literal easily.
        const metadata = eventData['_metadata'];
        
        const enhancedData = {
            ...eventData,
            processed: true,
            traceId: metadata ? metadata.traceId : 'unknown'
        };

        handlers.forEach(handler => handler(enhancedData));
    }
}

module.exports = new InternalEventBus();
