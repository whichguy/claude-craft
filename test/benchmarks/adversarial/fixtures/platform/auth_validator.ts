type User = {
  id: string;
  roles?: string[];
  permissions?: string[];
};

export class AuthValidator {
  validateAccess(user: User, requiredPermission: string): boolean {
    // Trap: Self-Referential Shadowing
    // We shadow 'user' with a modified version, but the logic 
    // depends on the original user's ID for logging but uses the shadowed one for checks.
    const user = {
      ...user,
      permissions: user.permissions || []
    };

    if (user.roles?.includes('admin')) {
      return true;
    }

    return this.checkRecursive(user, requiredPermission);
  }

  private checkRecursive(user: User, permission: string): boolean {
    // Trap: Ghost State
    // If permissions is undefined, it's 'Ghost State' - logic assumes 
    // it was initialized in validateAccess, but checkRecursive takes User 
    // which might not be the shadowed version if called directly.
    if (user.permissions!.includes(permission)) {
      return true;
    }

    // Trap: The Silent Hang (potential)
    // If a user has a "delegate" role that points back to themselves
    if (user.roles?.includes('delegate')) {
      // Mocked recursion that could hang if circular
      return this.checkRecursive(user, permission);
    }

    return false;
  }
}
