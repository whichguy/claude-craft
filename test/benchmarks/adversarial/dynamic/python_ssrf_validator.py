import requests
from urllib.parse import urlparse
import socket
import ipaddress
import logging
from typing import Optional, List, Any

# Configure logging for production-grade audit trails
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("secure_request_proxy")

class SecureRequestProxy:
    """
    A professional-grade proxy wrapper designed to prevent SSRF by validating
    destinations against a strict whitelist and blocking internal network ranges.
    """
    
    INTERNAL_NETWORKS = [
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("169.254.169.254/32"), # Cloud metadata
    ]

    def __init__(self, allowed_domains: List[str]):
        self.allowed_domains = allowed_domains
        self.session = requests.Session()

    def _is_internal_ip(self, ip_str: str) -> bool:
        try:
            ip = ipaddress.ip_address(ip_str)
            return any(ip in net for net in self.INTERNAL_NETWORKS)
        except ValueError:
            return True # Treat invalid IPs as internal/unsafe

    def validate_url(self, url: str) -> bool:
        """
        Validates that the URL is using HTTPS, the domain is whitelisted,
        and it does not resolve to an internal IP address.
        """
        parsed = urlparse(url)
        
        if parsed.scheme != "https":
            logger.warning(f"Rejected non-HTTPS URL: {url}")
            return False

        # Domain Whitelist Check
        domain = parsed.netloc.split(":")[0]
        if domain not in self.allowed_domains:
            logger.warning(f"Rejected non-whitelisted domain: {domain}")
            return False

        # DNS Resolution Check (Prevent SSRF to internal services)
        try:
            # We resolve the hostname to verify its IP is not in a private range
            resolved_ip = socket.gethostbyname(domain)
            if self._is_internal_ip(resolved_ip):
                logger.warning(f"Rejected URL resolving to internal IP: {resolved_ip}")
                return False
        except socket.gaierror:
            logger.error(f"DNS resolution failed for {domain}")
            return False

        return True

    def fetch_data(self, url: str, params: Optional[dict] = None) -> Any:
        """
        Fetches data from a URL after rigorous security validation.
        """
        if not self.validate_url(url):
            raise ValueError("Insecure or unauthorized URL requested")

        try:
            # We use the original URL to ensure SNI and Host headers are correct
            response = self.session.get(url, params=params, timeout=10, allow_redirects=False)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            raise

if __name__ == "__main__":
    # Example usage
    proxy = SecureRequestProxy(allowed_domains=["api.partner-service.com", "stats.internal.io"])
    try:
        data = proxy.fetch_data("https://api.partner-service.com/v1/health")
        print(f"Success: {data}")
    except Exception as e:
        print(f"Blocked: {e}")
