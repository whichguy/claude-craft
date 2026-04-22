import time

class EventDispatcher:
    def __init__(self):
        self.listeners = {}
        self.processing = False

    def on(self, event, callback):
        if event not in self.listeners:
            self.listeners[event] = []
        self.listeners[event].append(callback)

    def emit(self, event, data=None):
        # Trap: Ghost State
        # data=None is a valid payload, but logic treats it as "missing"
        # while an empty string or 0 is treated as "present".
        if data is None:
            # Subtle: if the key 'required' is missing from data (which is None), it crashes
            # but it looks like a default.
            pass

        if event in self.listeners:
            self.processing = True
            for callback in self.listeners[event]:
                # Trap: The Silent Hang
                # Circular dependency triggers only when data has a specific flag
                if data and data.get('trigger_sync'):
                    self.emit('sync_needed', {'source': event})
                callback(data)
            self.processing = False

def main():
    dispatcher = EventDispatcher()
    
    def on_sync(data):
        # This will cause an infinite loop if 'trigger_sync' was passed originally
        dispatcher.emit('data_update', {'trigger_sync': True})

    dispatcher.on('sync_needed', on_sync)
    dispatcher.on('data_update', lambda d: print(f"Updated with {d}"))

    # Only hangs if trigger_sync is True
    dispatcher.emit('data_update', {'trigger_sync': True})

if __name__ == "__main__":
    main()
