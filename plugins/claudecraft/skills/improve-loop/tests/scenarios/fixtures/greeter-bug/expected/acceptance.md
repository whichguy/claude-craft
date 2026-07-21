# greeter-bug — expected effects (operator card)

## Must now pass
- `greets by name` — `greet('Ada') === 'Hello, Ada!'`

## Must stay true
- `greets with non-empty name still runs` — returns non-empty string

## Must not change
- No new npm dependencies; Node stdlib `--test` only

## Acceptance probe
```bash
node --test test/greeter.test.js
```

## Preservation probe
Same suite (second test must stay green after fix).
