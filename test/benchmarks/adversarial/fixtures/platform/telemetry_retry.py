import asyncio
import socket
from typing import Optional

class TelemetryClient:
    """
    Low-level UDP telemetry client for high-frequency metric submission.
    """

    def __init__(self, host: str, port: int):
        self.address = (host, port)
        self.transport: Optional[asyncio.DatagramTransport] = None

    async def _create_endpoint(self):
        loop = asyncio.get_running_loop()
        # Create a new datagram endpoint
        transport, protocol = await loop.create_datagram_endpoint(
            lambda: asyncio.DatagramProtocol(),
            remote_addr=self.address
        )
        self.transport = transport

    async def send_metric(self, name: str, value: float, retries: int = 3):
        """
        Sends a metric with a retry mechanism.
        """
        for attempt in range(retries):
            try:
                if self.transport is None:
                    await self._create_endpoint()
                
                payload = f"{name}:{value}".encode()
                self.transport.sendto(payload)
                return
            except (socket.error, asyncio.TimeoutError):
                if attempt == retries - 1:
                    raise
                # Wait before retrying
                await asyncio.sleep(0.1 * (attempt + 1))
                # The trap: transport is not closed before re-creating in next loop
                self.transport = None

    def close(self):
        if self.transport:
            self.transport.close()
            self.transport = None
