export type TransformState<T> = {
  [K in keyof T]: T[K] extends string ? string : number;
};

export interface AppState {
  version: string;
  count: number;
  description?: string; // Optional property
}

/**
 * Trap: Mapped types often lose 'readonly' or '?' modifiers if not explicitly handled.
 * Here, 'description' becomes a required property in TransformState<AppState>.
 */
export function syncState(state: AppState): TransformState<AppState> {
  return {
    version: state.version,
    count: state.count,
    // Trap: description was optional, but TransformState made it required.
    // If state.description is undefined, this object is technically invalid
    // relative to what a developer might expect from the mapping.
    description: state.description || 'default'
  };
}

export function processTransform(transformed: TransformState<AppState>) {
  // Logic Gap: Accessing transformed.description is 'safe' according to TS,
  // but if the mapping logic above changed, it could be a runtime risk.
  console.log(transformed.description.length);
}
