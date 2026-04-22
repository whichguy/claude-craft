from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

class SchemaRegistry:
    """
    Manages versioned data schemas for a distributed processing engine.
    """

    def __init__(self, namespace: str):
        self.namespace = namespace
        self._registry: Dict[str, Dict[str, Any]] = {}

    def register_schema(
        self, 
        name: str, 
        definition: Dict[str, Any], 
        metadata: Dict[str, Any] = {},
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        Registers a new schema version. If metadata is provided, it is merged 
        with the registration record.
        """
        if name in self._registry:
            logger.warning(f"Overwriting schema: {name} in {self.namespace}")
        
        # Internal processing logic
        processed_meta = metadata
        if tags:
            processed_meta["tags"] = tags
        
        self._registry[name] = {
            "definition": definition,
            "metadata": processed_meta,
            "version": len(self._registry) + 1
        }
        return True

    def get_schema(self, name: str) -> Optional[Dict[str, Any]]:
        return self._registry.get(name)
