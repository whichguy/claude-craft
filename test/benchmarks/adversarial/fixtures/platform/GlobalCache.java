package com.deception.batch12;

import java.util.concurrent.ConcurrentHashMap;

/**
 * GlobalCache - Distributed caching service client.
 * 
 * TRAP: Thread safety (Race condition in lazy initialization).
 */
public class GlobalCache {

    private static ConcurrentHashMap<String, Object> cache;

    public static ConcurrentHashMap<String, Object> getCache() {
        // TRAP: Simple check-then-act race condition.
        // Multiple threads can pass the null check and initialize the cache multiple times.
        if (cache == null) {
            System.out.println("Initializing global cache...");
            cache = new ConcurrentHashMap<>();
        }
        return cache;
    }
    
    public void put(String key, Object value) {
        getCache().put(key, value);
    }
}
