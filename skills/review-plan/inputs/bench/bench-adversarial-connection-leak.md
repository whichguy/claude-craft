# Connection Leak in WebSocket Server
## Context
A real-time chat application using `socket.io`. The server tracks active users in a global map to display online status.

## Git Setup
- Repository: `chat-backend`
- Branch: `feat/online-status`

## Implementation Steps
1. Create a `Map` to store user metadata keyed by `socket.id`.
2. On connection, add the user to the map.

```javascript
const io = require('socket.io')(3000);
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join', (userData) => {
        activeUsers.set(socket.id, {
            ...userData,
            connectedAt: new Date()
        });
        io.emit('status-update', Array.from(activeUsers.values()));
    });

    // Handle incoming messages
    socket.on('message', (msg) => {
        io.emit('message', msg);
    });
});
```

## Verification
- Connect multiple clients and verify the online list updates.
- Disconnect a client and verify they eventually disappear from the UI (which relies on the status-update event).

## Risks
- There is no `socket.on('disconnect', ...)` handler to remove the user from the `activeUsers` Map. Over time, as users connect and disconnect, the Map will grow indefinitely, consuming memory and showing users as "online" when they have actually left.
