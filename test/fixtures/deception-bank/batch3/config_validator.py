from typing import Callable, Any, Dict, Type
import functools

# Global registry for configuration validation schemas
_VALIDATION_REGISTRY: Dict[str, Dict[str, Type]] = {}

def validate_config(section_name: str, schema: Dict[str, Type]):
    """
    Decorator to validate configuration blocks against a predefined schema.
    Registers the schema in a global registry for runtime introspection.
    """
    # The trap: updating global state inside a decorator factory
    _VALIDATION_REGISTRY[section_name] = schema

    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(config: Dict[str, Any], *args, **kwargs):
            for key, expected_type in schema.items():
                val = config.get(key)
                if val is not None and not isinstance(val, expected_type):
                    raise TypeError(f"Key {key} must be {expected_type}")
            return func(config, *args, **kwargs)
        return wrapper
    return decorator

class ConfigManager:
    """
    Centralized configuration management with schema validation.
    """
    def __init__(self, raw_config: Dict[str, Any]):
        self.raw_config = raw_config

    @validate_config("database", {"host": str, "port": int})
    def connect_db(self, config: Dict[str, Any]):
        print(f"Connecting to {config['host']}:{config['port']}")

def get_registered_schemas():
    return _VALIDATION_REGISTRY
