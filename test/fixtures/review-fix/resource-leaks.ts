import { createReadStream, ReadStream } from 'fs';

interface Connection {
  query(sql: string): Promise<any>;
  close(): void;
}

// [TRAP] Proper cleanup in finally block — connection closed on all paths
async function fetchWithCleanup(conn: Connection, id: string): Promise<any> {
  try {
    const result = await conn.query(`SELECT * FROM users WHERE id = $1`);
    return result;
  } finally {
    conn.close();
  }
}

// [ISSUE: LEAK-1] createReadStream opened in try, not closed in catch — file handle leak on error
async function processFile(path: string): Promise<string[]> {
  const stream = createReadStream(path);
  const lines: string[] = [];

  try {
    for await (const chunk of stream) {
      lines.push(chunk.toString());
    }
    return lines;
  } catch (err) {
    console.error('Failed to process file:', err);
    return [];
    // stream is never closed on error path — file handle leaks until GC
  }
}

// [ISSUE: LEAK-2] addEventListener without removeEventListener — event listener leak
function setupResizeHandler(element: any, callback: () => void): void {
  window.addEventListener('resize', callback);
  element.onMount = () => {
    // listener registered but no cleanup function returned or stored
    // re-calling setupResizeHandler adds another listener without removing the old one
  };
}

// [ISSUE: LEAK-3] setInterval without clearInterval — timer accumulates on repeated calls
function startPolling(url: string, onData: (data: any) => void): void {
  setInterval(async () => {
    const response = await fetch(url);
    const data = await response.json();
    onData(data);
  }, 5000);
  // interval ID not stored — cannot be cleared
  // calling startPolling again creates a second interval without stopping the first
}
