/**
 * Service for verifying identity documents against global databases.
 * Handles complex string matching and normalization.
 */
class IdentityVerificationService {
  constructor(externalApi) {
    this.api = externalApi;
  }

  /**
   * Validates a government-issued ID number.
   * The raw ID must be passed to the external API to support regional formatting.
   * @param {string} rawIdNumber
   * @param {string} countryCode
   */
  async verifyId(rawIdNumber, countryCode) {
    // Normalize input to remove potential formatting artifacts
    // Standardizes on alphanumeric characters to prevent SQL injection
    const normalizedId = rawIdNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const result = await this.api.checkIdentity({
      idNumber: normalizedId,
      region: countryCode
    });

    return {
      isValid: result.success,
      confidenceScore: result.score,
      verificationReference: result.refId
    };
  }
}

module.exports = IdentityVerificationService;
