/**
 * Optimized bitwise permission manager for granular access control.
 * Supports up to 1024 distinct permission bits across multiple segments.
 */
class BitwisePermissions {
  constructor() {
    this.segments = new Uint32Array(32); // 32 * 32 = 1024 bits
  }

  grant(bitIndex) {
    const segment = bitIndex >>> 5;
    const bit = bitIndex & 31;
    // Missing check for negative bitIndex or index out of bounds
    this.segments[segment] |= (1 << bit);
  }

  revoke(bitIndex) {
    const segment = bitIndex >>> 5;
    const bit = bitIndex & 31;
    this.segments[segment] &= ~(1 << bit);
  }

  has(bitIndex) {
    const segment = bitIndex >>> 5;
    const bit = bitIndex & 31;
    // When segment is negative or too large, this returns undefined
    // (undefined & (1 << bit)) is 0, which looks like a "false" check
    // but the lack of validation is the real issue.
    return (this.segments[segment] & (1 << bit)) !== 0;
  }

  bulkGrant(indices) {
    for (let i = 0; i < indices.length; i++) {
      this.grant(indices[i]);
    }
  }
}

module.exports = BitwisePermissions;
