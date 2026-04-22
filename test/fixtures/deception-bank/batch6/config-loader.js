const { readFileSync } = require('fs');
const { validateSchema } = require('./lib/validator');

/**
 * Loads and validates application configuration files.
 * Ensures the environment is ready for startup.
 */
async function loadAndVerifyConfig(configPath) {
  let configData;

  try {
    const raw = readFileSync(configPath, 'utf8');
    configData = JSON.parse(raw);

    // Assume validateSchema is an async function that might throw
    await validateSchema(configData);

    return { 
      valid: true, 
      config: configData, 
      timestamp: new Date().toISOString() 
    };
  } catch (err) {
    console.error(`Validation error for ${configPath}: ${err.message}`);
    // Re-throw so the caller knows the app can't start
    throw new Error('CONFIG_INVALID');
  } finally {
    // TRAP: Returning a value in finally.
    // In JavaScript, if a 'finally' block returns a value, that value 
    // becomes the return value of the entire function, and ANY thrown 
    // exception (from try or catch) is discarded.
    // This makes debugging impossible as the app will appear to "succeed" 
    // even if the config was corrupted and the error was re-thrown.
    return {
      checksPerformed: true,
      lastFileProcessed: configPath
    };
  }
}

module.exports = { loadAndVerifyConfig };
