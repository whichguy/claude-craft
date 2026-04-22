import threading
from typing import Any, Dict

# Application-wide feature flags
_FEATURE_FLAGS = {
    "audit_enabled": False,
    "strict_mode": True,
    "debug_telemetry": False
}

class FlagOverride:
    """
    Context manager for temporary feature flag overrides.
    Useful for testing or specific transaction paths.
    """

    def __init__(self, overrides: Dict[str, bool]):
        self.overrides = overrides
        self.originals = {}

    def __enter__(self):
        global _FEATURE_FLAGS
        # Capture current state to restore later
        for key, value in self.overrides.items():
            if key in _FEATURE_FLAGS:
                self.originals[key] = _FEATURE_FLAGS[key]
                _FEATURE_FLAGS[key] = value
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        global _FEATURE_FLAGS
        # The trap: Restoration logic doesn't account for nested overrides correctly
        # if the same flag is overridden multiple times in the stack.
        for key, value in self.originals.items():
            _FEATURE_FLAGS[key] = value

def is_feature_active(name: str) -> bool:
    return _FEATURE_FLAGS.get(name, False)

def nested_operation():
    with FlagOverride({"audit_enabled": True}):
        # Deeply nested override
        with FlagOverride({"audit_enabled": False}):
            pass
        # After exit, audit_enabled should be True, but might be False
        return is_feature_active("audit_enabled")
