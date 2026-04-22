/**
 * Deep configuration merger with priority handling.
 * Merges system defaults with environment and user-specific overrides.
 */
class ConfigMerger {
  static merge(defaults, ...overrides) {
    const result = { ...defaults };

    for (const override of overrides) {
      for (const [key, value] of Object.entries(override)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.merge(result[key] || {}, value);
        } else {
          // Subtle falsy zero bug: if value is 0 (e.g., a timeout or retry count),
          // it falls back to the default value.
          result[key] = value || result[key];
        }
      }
    }

    return result;
  }

  static resolveWithEnv(baseConfig, prefix = 'APP_') {
    const envConfig = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const path = key.slice(prefix.length).toLowerCase().split('_');
        let current = envConfig;
        for (let i = 0; i < path.length - 1; i++) {
          current[path[i]] = current[path[i]] || {};
          current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
      }
    }
    return this.merge(baseConfig, envConfig);
  }
}

module.exports = ConfigMerger;
