package com.deception.batch12;

import java.util.HashMap;
import java.util.Map;

/**
 * SessionManager - Centralized user session tracking.
 * 
 * TRAP: Thread safety issues in Singleton (double-checked locking without volatile).
 */
public class SessionManager {

    private static SessionManager instance;
    private Map<String, String> activeSessions;

    private SessionManager() {
        activeSessions = new HashMap<>();
    }

    public static SessionManager getInstance() {
        // TRAP: Lacks 'volatile' on the instance variable.
        // Can lead to partially initialized objects being seen by other threads.
        if (instance == null) {
            synchronized (SessionManager.class) {
                if (instance == null) {
                    instance = new SessionManager();
                }
            }
        }
        return instance;
    }

    public void addSession(String token, String user) {
        activeSessions.put(token, user);
    }

    public String getUser(String token) {
        return activeSessions.get(token);
    }
}
