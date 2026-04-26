# Circular Dependency in Microservice Request Flow
## Context
Implementing a complex checkout flow between `UserService` and `OrderService`. The `OrderService` needs user verification, and the `UserService` needs to check for active orders to determine "loyalty" status.

## Git Setup
- Repository: `monorepo-services`
- Branch: `arch/service-interaction`

## Implementation Steps
1. Add an endpoint `/orders/create` in `OrderService` that calls `UserService` to validate the user.
2. Add a flag `isLoyal` in `UserService` response, which is calculated by calling `OrderService` to see the total number of past orders.

```javascript
// OrderService.js
app.post('/orders/create', async (req, res) => {
    const user = await axios.get(`http://user-service/users/${req.body.userId}`);
    if (user.data.isValid) {
        // Create order...
        res.status(201).send({ success: true });
    }
});

// UserService.js
app.get('/users/:id', async (req, res) => {
    const orders = await axios.get(`http://order-service/users/${req.params.id}/orders`);
    const isLoyal = orders.data.length > 5;
    res.send({ id: req.params.id, isValid: true, isLoyal });
});
```

## Verification
- Test creating an order for a new user.
- Test fetching user details for a user with existing orders.

## Risks
- If `OrderService.create` calls `UserService.get`, and `UserService.get` calls `OrderService.getOrders`, this creates a distributed circular dependency. While this specific flow might not loop infinitely, it creates tight coupling and makes the services highly brittle—if one is down, the other becomes partially dysfunctional for basic lookups.
