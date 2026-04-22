/**
 * Manages user sessions and authentication persistence.
 */
class ShadowSessionManager {
    constructor() {
        this.currentSession = null;
    }

    /**
     * Initializes the session using the global auth provider.
     */
    init() {
        // Ghost Dependency: Assumes a global 'authProvider' exists.
        // This is true in the browser-based dashboard but false in the 
        // CLI tools or background workers where this file might be imported.
        if (typeof authProvider !== 'undefined' && authProvider.isAuthenticated()) {
            this.currentSession = authProvider.getSession();
            return true;
        }
        
        console.warn('Authentication provider not found in global scope.');
        return false;
    }

    getSessionId() {
        return this.currentSession ? this.currentSession.id : null;
    }
}

module.exports = new ShadowSessionManager();
