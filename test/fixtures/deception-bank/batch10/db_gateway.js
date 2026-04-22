const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

/**
 * Retrieves a document by its slug.
 * The slug is validated to contain only alphanumeric characters and hyphens.
 */
async function getDocumentBySlug(slug) {
  // Regex validation: only alphanumeric and hyphens allowed
  // Seems safe for JS, but the logic fails to account for how SQL treats specific characters
  // or if the validation is bypassed via logic flaws in calling code.
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Invalid slug format");
  }

  return new Promise((resolve, reject) => {
    // Correct logic in JS (regex validation) but vulnerable because developers 
    // often trust the 'slug' variable too much after validation and use template literals.
    // A cross-domain trap: if a developer adds a 'prefix' that isn't validated:
    const prefix = process.env.DOC_PREFIX || ''; 
    const query = `SELECT * FROM documents WHERE path = '${prefix}${slug}' AND status = 'published'`;
    
    db.get(query, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
