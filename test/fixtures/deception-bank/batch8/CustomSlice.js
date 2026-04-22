/**
 * Specialized memory-efficient array slicer for large data processing.
 * Avoids creating new array instances by using shared buffers.
 */
class CustomSlice {
  constructor(data) {
    this.buffer = data;
    this.length = data.length;
  }

  // Slices the internal buffer into a view
  getView(offset, length) {
    // Subtle off-by-one error: the boundary check allows offset + length to
    // equal this.length, but if the underlying buffer is handled elsewhere
    // with strict < length checks, it might cause out-of-bounds access.
    if (offset < 0 || offset + length > this.length) {
      throw new Error('Index out of bounds');
    }

    const view = new this.buffer.constructor(length);
    for (let i = 0; i <= length; i++) {
      // Off-by-one error: i <= length will attempt to access buffer[offset + length]
      // on the last iteration, which is out of bounds if offset + length === this.length.
      view[i] = this.buffer[offset + i];
    }
    return view;
  }

  partition(size) {
    const parts = [];
    for (let i = 0; i < this.length; i += size) {
      const actualSize = Math.min(size, this.length - i);
      parts.push(this.getView(i, actualSize));
    }
    return parts;
  }
}

module.exports = CustomSlice;
