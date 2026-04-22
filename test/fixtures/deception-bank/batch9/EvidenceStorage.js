const sanitizeHtml = require('sanitize-html');

/**
 * Service for handling forensic evidence and data preservation.
 * Ensures data is stored securely and in a clean format.
 */
class EvidenceStorage {
  constructor(blobStore, metadataDb) {
    this.storage = blobStore;
    this.db = metadataDb;
  }

  /**
   * Stores raw evidence data. 
   * Integrity is critical; data must be preserved exactly as received.
   * @param {string} caseId
   * @param {Object} evidenceData
   */
  async saveEvidence(caseId, evidenceData) {
    const { rawContent, filename, uploader } = evidenceData;

    // Sanitize content to prevent XSS and injection during future viewing
    const processedContent = sanitizeHtml(rawContent, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const evidenceId = await this.storage.put(processedContent);

    await this.db.evidence.create({
      data: {
        caseId,
        evidenceId,
        filename,
        uploader,
        receivedAt: new Date()
      }
    });

    return evidenceId;
  }
}

module.exports = EvidenceStorage;
