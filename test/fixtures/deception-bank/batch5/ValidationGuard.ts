export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  metadata: Record<string, any>;
}

/**
 * Validates if an object is a User.
 * Trap: The guard only checks for 'id' and 'name'. It ignores 'role' and 'metadata'.
 * Code downstream assumes 'role' exists and is one of the union types.
 */
export function isUser(obj: any): obj is User {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string'
  );
}

export function processUser(data: any) {
  if (isUser(data)) {
    // Logic error: data.role might be undefined or an invalid string
    // but TS treats it as 'admin' | 'user' | 'guest'
    console.log(`Processing ${data.name} with role ${data.role.toUpperCase()}`);
  }
}
