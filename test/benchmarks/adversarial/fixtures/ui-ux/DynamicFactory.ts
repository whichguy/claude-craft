export type EntityType = 'USER' | 'POST' | 'COMMENT';

export type Entity<T extends EntityType> = T extends 'USER'
  ? { id: string; name: string }
  : T extends 'POST'
  ? { id: string; title: string }
  : { id: string; body: string };

/**
 * Factory for creating entities.
 * Trap: Conditional inference with 'infer'.
 * If the input doesn't match the expected structure, it falls back to a broad type.
 */
export function createEntity<T extends EntityType, U>(
  type: T,
  data: U extends { payload: infer P } ? P : any
): Entity<T> {
  // Trap: 'any' allows invalid data to be passed when U doesn't have 'payload'
  return {
    ...data,
    type // Logic error: 'type' isn't in the return type definition but is spread in
  } as Entity<T>;
}

// Logic Gap: Passing data without 'payload' bypasses type safety due to 'any' fallback
const user = createEntity('USER', { username: 'john_doe' });
// user.name is undefined at runtime
