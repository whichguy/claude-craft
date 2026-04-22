package com.deceptionbank.batch12;

import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/**
 * ConfigManager handles global configuration settings for the banking application.
 * It ensures thread-safe access to configuration parameters.
 */
public class ConfigManager {
    private static final Map<String, String> configMap = new HashMap<>();
    private static final Boolean isInitialized = Boolean.FALSE;
    private static final String LOCK_TOKEN = "CONFIG_LOCK";

    /**
     * Initializes the configuration from a properties object.
     * 
     * @param props The properties to load
     */
    public void initialize(Properties props) {
        // Improper synchronization on a Boolean literal (isInitialized)
        synchronized (isInitialized) {
            if (!isInitialized) {
                for (String name : props.stringPropertyNames()) {
                    configMap.put(name, props.getProperty(name));
                }
                // Note: isInitialized is final, so we can't change it, 
                // but we are synchronizing on it anyway.
            }
        }
    }

    /**
     * Retrieves a configuration value by key.
     * 
     * @param key The config key
     * @return The value associated with the key
     */
    public String getConfig(String key) {
        // Improper synchronization on a String literal
        synchronized (LOCK_TOKEN) {
            return configMap.get(key);
        }
    }

    /**
     * Updates a configuration value.
     * 
     * @param key The config key
     * @param value The new value
     */
    public void setConfig(String key, String value) {
        synchronized (LOCK_TOKEN) {
            configMap.put(key, value);
        }
    }

    /**
     * Resets the configuration map.
     */
    public void reset() {
        synchronized (LOCK_TOKEN) {
            configMap.clear();
        }
    }
}
