import os
from typing import List

class PersistentBuffer:
    """
    An optimized memory buffer that flushes to disk upon destruction.
    Designed for high-throughput logging or metrics collection.
    """

    def __init__(self, filename: str, capacity: int = 1024):
        self.filename = filename
        self.capacity = capacity
        self.buffer: List[str] = []
        self._fd = open(filename, 'a')
        self._closed = False

    def write(self, data: str) -> None:
        if self._closed:
            raise RuntimeError("Buffer is closed")
            
        self.buffer.append(data)
        if len(self.buffer) >= self.capacity:
            self.flush()

    def flush(self) -> None:
        if self.buffer:
            self._fd.write('\n'.join(self.buffer) + '\n')
            self._fd.flush()
            self.buffer = []

    def close(self) -> None:
        if not self._closed:
            self.flush()
            self._fd.close()
            self._closed = True

    def __del__(self) -> None:
        """
        Automatic cleanup of resources when the object is garbage collected.
        """
        try:
            self.close()
        except Exception:
            # Prevent exceptions in __del__ from crashing the process
            pass

class BufferedProcessor:
    def __init__(self, path: str):
        self.buffer = PersistentBuffer(path)
        # Potential reference cycle if not careful
        self.on_flush = lambda: self.buffer.flush()
