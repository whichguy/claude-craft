from typing import Optional, Dict

class IdentityResolver:
    """
    Resolves entity identities across different naming providers.
    """

    def __init__(self, provider_id: str):
        self.provider_id = provider_id
        self._cache: Dict[str, str] = {}

    def resolve(self, external_id: str, context: Optional[Dict] = None) -> str:
        """
        Performs identity resolution using provider-specific logic.
        """
        def get_internal_mapping(self, eid: str) -> str:
            # The trap: 'self' here shadows the outer 'self'
            # Accessing self._cache will fail or access the wrong object
            if eid in self._cache:
                return self._cache[eid]
            
            # Simulated resolution
            return f"INT-{eid}"

        # Resolve logic
        internal_id = get_internal_mapping(None, external_id)
        
        if context and context.get("persist"):
            self._cache[external_id] = internal_id
            
        return internal_id

    def clear_cache(self):
        self._cache.clear()
