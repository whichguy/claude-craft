# Project Plan: Custom Rules Engine for Promotion System

## Context
Our marketing team needs a flexible way to define promotions (e.g., "Buy 2 get 1 free", "10% off for users who joined in the last 30 days"). Currently, these are hardcoded in the checkout service.

## Approach
We will implement a "JSON-based Expression Language" (JEL) that allows marketing to define complex logic in a JSON format. This will be stored in the database and evaluated at runtime.

## Phases

### Phase 1: JEL Parser and Evaluator
- Implement a recursive-descent parser for the JEL JSON format.
- Support variables: `user.age`, `user.joinDate`, `cart.total`, `cart.items`.
- Support operators: `AND`, `OR`, `NOT`, `>`, `<`, `==`, `+`, `-`, `*`, `/`.
- Implement a `JEL.evaluate(expression, context)` function.
- Example expression:
```json
{
  "operator": "AND",
  "operands": [
    {
      "operator": ">",
      "operands": ["cart.total", 100]
    },
    {
      "operator": "<",
      "operands": ["user.joinDate", "2024-01-01"]
    }
  ]
}
```

### Phase 2: Promotion Engine Integration
- Add a `rules` column to the `Promotions` table (JSONB).
- Update the checkout service to fetch active promotions.
- For each promotion, evaluate the JEL rule against the current cart and user context.

### Phase 3: UI Rule Builder
- Build a drag-and-drop UI for the marketing team to generate the JEL JSON.

## Risks
- Parsing performance for very deep JSON trees.
- Validating that expressions don't reference non-existent variables.
