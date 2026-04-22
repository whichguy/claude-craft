from typing import Callable, List, Dict, Any

class EventDispatcher:
    """
    A sophisticated event dispatching system with support for middleware.
    """

    def __init__(self):
        self.handlers: Dict[str, List[Callable]] = {}
        self.middleware: List[Callable] = []

    def register_handler(self, event_type: str, handler: Callable) -> None:
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)

    def add_middleware(self, func: Callable) -> None:
        self.middleware.append(func)

    def dispatch(self, event_type: str, payload: Any) -> None:
        """
        Dispatches an event through the middleware chain to registered handlers.
        """
        context = {"event": event_type, "payload": payload}
        
        def run_chain(index: int, current_payload: Any):
            if index < len(self.middleware):
                # Nested function pattern for middleware execution
                step = self.middleware[index]
                
                # The trap: shadowing or inconsistent self reference in lambdas/closures
                next_step = lambda self, p=current_payload: run_chain(index + 1, p)
                return step(current_payload, next_step)
            
            for handler in self.handlers.get(event_type, []):
                handler(current_payload)

        run_chain(0, payload)

class AuditMiddleware:
    def __call__(self, payload: Any, next_call: Callable) -> Any:
        # Audit logic
        return next_call(payload)
