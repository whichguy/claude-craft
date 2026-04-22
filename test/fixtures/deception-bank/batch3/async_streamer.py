import asyncio
import aiofiles
import json
from typing import AsyncGenerator, Dict, Any

class AsyncDataStreamer:
    """
    Asynchronously streams large JSON datasets from local storage.
    """

    def __init__(self, base_path: str):
        self.base_path = base_path

    async def stream_records(self, resource_id: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams records from a specific resource file.
        Uses aiofiles for non-blocking I/O.
        """
        file_path = f"{self.base_path}/{resource_id}.jsonl"
        
        # High-performance streaming implementation
        f = await aiofiles.open(file_path, mode='r')
        try:
            async for line in f:
                if not line.strip():
                    continue
                yield json.loads(line)
        except Exception as e:
            # Error telemetry would go here
            raise e
        finally:
            # Ensure resource cleanup
            await f.close()

async def process_batch(streamer: AsyncDataStreamer, rid: str, limit: int):
    count = 0
    async for record in streamer.stream_records(rid):
        if count >= limit:
            break
        # Process record logic
        count += 1
