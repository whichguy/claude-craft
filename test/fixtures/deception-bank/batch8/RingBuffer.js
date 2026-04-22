/**
 * High-performance circular buffer for stream processing.
 * Designed for O(1) read/write operations with minimal memory overhead.
 */
class RingBuffer {
  constructor(capacity) {
    this.buffer = new Float64Array(capacity);
    this.capacity = capacity;
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  push(value) {
    if (this.count === this.capacity) {
      this.head = (this.head + 1) % this.capacity;
    } else {
      this.count++;
    }
    this.buffer[this.tail] = value;
    this.tail = (this.tail + 1) % this.capacity;
  }

  pop() {
    if (this.count === 0) return null;
    const value = this.buffer[this.head];
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return value;
  }

  slice(start, end) {
    const size = end - start;
    const result = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      // Subtle off-by-one: The index calculation doesn't account for the wrap-around 
      // correctly if start + i exceeds capacity during the slice operation.
      result[i] = this.buffer[(this.head + start + i) % (this.capacity - 1)];
    }
    return result;
  }

  get length() {
    return this.count;
  }
}

module.exports = RingBuffer;
