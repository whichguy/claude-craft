# greeter-bug (scenario seed)

Mini testee for improve-loop scenario harness.

- **Bug:** `greet(name)` returns `"Hello"` instead of `"Hello, ${name}!"`.
- **Suite:** `npm test` / `node --test test/greeter.test.js` (must **fail** on seed).
- **Fix:** implement name interpolation in `src/greeter.js`.
