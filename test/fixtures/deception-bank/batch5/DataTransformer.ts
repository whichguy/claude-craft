export interface Base {
  id: string;
  tags: string[];
}

export interface Extension {
  id: number; // Conflict: string vs number
  metadata: Record<string, string>;
}

/**
 * Merges base and extension data.
 * Trap: Intersecting conflicting types results in 'never' for the conflicting property.
 * However, accessing it might be masked by casts or helper functions.
 */
export type Merged = Base & Extension;

export function mergeData(base: Base, ext: Extension): Merged {
  const result = {
    ...base,
    ...ext,
  };
  
  // Trap: result.id is now a number (from ext), but Merged.id is 'string & number' (never)
  return result as unknown as Merged;
}

export function auditId(data: Merged) {
  // Logic Gap: This check looks safe but data.id is a number at runtime,
  // while the type system thinks it's a 'string & number'.
  if (data.id.toString().length > 0) {
    console.log(`Valid ID: ${data.id}`);
  }
}
