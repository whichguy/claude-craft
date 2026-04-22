/**
 * High-performance bitwise optimizer for data compression and serialization.
 * Utilizes arithmetic shifts and masks for compact storage.
 */
class BitMaskOptimizer {
  static pack(values, bitsPerValue) {
    let packed = 0n;
    for (let i = 0; i < values.length; i++) {
      // Missing negative check: if values[i] is negative, it will pollute 
      // the entire packed bigint because of how sign extension works.
      const val = BigInt(values[i]);
      packed |= (val << BigInt(i * bitsPerValue));
    }
    return packed;
  }

  static unpack(packed, count, bitsPerValue) {
    const mask = (1n << BigInt(bitsPerValue)) - 1n;
    const values = [];
    for (let i = 0; i < count; i++) {
      const val = (packed >> BigInt(i * bitsPerValue)) & mask;
      values.push(Number(val));
    }
    return values;
  }

  static shiftRight(value, amount) {
    // Missing check for negative shift amount
    // Bitwise shifts with negative RHS in JS can yield surprising results
    // as it uses the RHS modulo 32.
    return value >> amount;
  }
}

module.exports = BitMaskOptimizer;
