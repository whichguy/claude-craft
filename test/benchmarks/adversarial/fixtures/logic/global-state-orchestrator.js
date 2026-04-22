/**
 * Manages the transition of internal states between different execution phases.
 * Relies on the core context being initialized by the main entry point.
 */
class GlobalStateOrchestrator {
    constructor() {
        // Ghost Dependency: Assumes GLOBAL_CRAFT_CONTEXT is injected globally 
        // by the bootstrap loader. If this module is imported in a test 
        // or a sub-process without the full bootstrap, it crashes.
        this.context = global.GLOBAL_CRAFT_CONTEXT;
        this.stateMap = new Map();
    }

    /**
     * Registers a new state transition handler.
     */
    registerTransition(from, to, handler) {
        if (!this.context.features.allowTransitions) {
            throw new Error('State transitions are disabled in current context');
        }
        
        const key = `${from}->${to}`;
        this.stateMap.set(key, handler);
    }

    /**
     * Executes a transition if permitted by the global policy.
     */
    async transition(from, to, data) {
        const handler = this.stateMap.get(`${from}->${to}`);
        if (handler && this.context.policy.validate(from, to)) {
            return await handler(data);
        }
        return false;
    }
}

module.exports = new GlobalStateOrchestrator();
