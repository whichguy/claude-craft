export type AppEvent =
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT'; userId: string }
  | { type: 'UPDATE_PROFILE'; userId: string; changes: Record<string, any> }
  | { type: 'DELETE_ACCOUNT'; userId: string; reason: string };

/**
 * Handles application events.
 * Trap: The 'default' case handles 'DELETE_ACCOUNT' implicitly if forgotten in the switch.
 * If a new event type is added, it falls through to the 'default' which does nothing
 * instead of causing a compile error for non-exhaustiveness.
 */
export function handleEvent(event: AppEvent) {
  switch (event.type) {
    case 'LOGIN':
      console.log(`User ${event.userId} logged in`);
      break;
    case 'LOGOUT':
      console.log(`User ${event.userId} logged out`);
      break;
    case 'UPDATE_PROFILE':
      console.log(`User ${event.userId} updated profile`);
      break;
    default:
      // Trap: This should be an exhaustive check (e.g., const _ex: never = event)
      // but instead it silently ignores DELETE_ACCOUNT and any future events.
      console.warn(`Unhandled event type: ${(event as any).type}`);
  }
}
