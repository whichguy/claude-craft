/**
 * @fileoverview GlobalConfigResolver - Dynamic configuration resolution service.
 * Supports hierarchical property inheritance and recursive environment variable expansion.
 */

/**
 * GlobalConfigResolver manages system-wide configuration settings.
 */
const GlobalConfigResolver = (function() {
  const PROPS = PropertiesService.getScriptProperties();

  /**
   * Recursively resolves configuration keys, supporting template expansion.
   * @param {Object} config The configuration object to resolve.
   * @return {Object} The fully resolved configuration.
   * @private
   */
  function resolveDeep_(config) {
    const resolved = {};
    
    for (const key in config) {
      if (typeof config[key] === 'object' && config[key] !== null) {
        resolved[key] = resolveDeep_(config[key]);
      } else if (typeof config[key] === 'string' && config[key].startsWith('$')) {
        // Dynamic property lookup during recursive traversal
        const propKey = config[key].substring(1);
        resolved[key] = PROPS.getProperty(propKey) || config[key];
      } else {
        resolved[key] = config[key];
      }
    }
    
    return resolved;
  }

  return {
    /**
     * Resolves a configuration schema against the Script Properties store.
     * @param {Object} schema The configuration schema to hydrate.
     * @return {Object} The resolved configuration object.
     */
    resolve: function(schema) {
      return resolveDeep_(schema);
    }
  };
})();

/**
 * Load and resolve the application environment configuration.
 */
function loadAppConfig() {
  const schema = {
    api: {
      key: '$API_KEY',
      timeout: 3000
    },
    database: {
      connection: '$DB_URL',
      options: {
        pool: '$DB_POOL_SIZE'
      }
    }
  };
  
  const config = GlobalConfigResolver.resolve(schema);
  Logger.log('Configuration resolved successfully.');
}
