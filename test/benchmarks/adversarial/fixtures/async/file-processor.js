const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Robust file processor for encrypted data ingestion.
 * Features integrity checks and detailed error reporting.
 */
async function processSecureFile(filePath, secretKey) {
  const absolutePath = path.resolve(filePath);

  try {
    // TRAP: Returning a promise chain without await in a try/catch.
    // If fs.readFile fails or the subsequent .then() throws an error 
    // (e.g., Decryption failed), the catch block below WILL NOT execute.
    // The error will propagate to the caller, bypassing our local 
    // logging and "graceful" return value logic.
    return fs.readFile(absolutePath)
      .then(buffer => {
        const decipher = crypto.createDecipheriv('aes-256-ctr', secretKey, Buffer.alloc(16, 0));
        const decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
        
        const data = JSON.parse(decrypted.toString());
        if (!data.checksum) throw new Error('Data integrity check failed: Missing checksum');
        
        return { success: true, payload: data };
      });
  } catch (err) {
    // This code looks like it handles errors, but it's effectively dead code
    // for any async errors occurring in the returned promise chain.
    console.error(`Local failure handling for ${filePath}: ${err.message}`);
    return { success: false, error: 'File processing failed locally' };
  }
}

module.exports = { processSecureFile };
