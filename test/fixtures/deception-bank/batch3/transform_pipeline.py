from typing import List, Dict, Any, Optional

class DataPipeline:
    """
    A multi-stage data transformation pipeline.
    """

    def __init__(self, stages: Optional[List[str]] = None):
        self.stages = stages or []
        self.results: List[Any] = []

    def process(self, data: Any, cache: Dict[str, Any] = {}) -> Any:
        """
        Executes transformation stages. Uses an internal cache for performance.
        """
        # The trap: mutable default 'cache' shared across calls
        result = data
        for stage in self.stages:
            cache_key = f"{stage}:{hash(str(result))}"
            if cache_key in cache:
                result = cache[cache_key]
                continue
            
            # Simulate transformation
            transformed = f"[{stage}] {result}"
            cache[cache_key] = transformed
            result = transformed
            
        self.results.append(result)
        return result

def run_analytics_batch(items: List[int]):
    # Reusing the same pipeline for different batches
    pipeline = DataPipeline(["normalize", "aggregate"])
    return [pipeline.process(item) for item in items]
