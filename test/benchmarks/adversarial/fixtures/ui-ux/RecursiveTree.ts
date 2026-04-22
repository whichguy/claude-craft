export type RecursiveConfig<T> = {
  [K in keyof T]: T[K] | RecursiveConfig<T[K]>;
};

export interface SystemConfig {
  network: {
    host: string;
    port: number;
    retry: {
      attempts: number;
      delay: number;
    };
  };
}

/**
 * Trap: The recursive type definition is too loose, allowing keys that don't match T
 * if they are nested within a 'RecursiveConfig' structure.
 */
export const config: RecursiveConfig<SystemConfig> = {
  network: {
    host: 'localhost',
    port: 8080,
    retry: {
      attempts: 3,
      delay: 1000,
      // Logic Gap: 'unknownKey' is allowed because of how recursion interacts with union
      unknownKey: 'oops'
    } as any // Forced, but even without any, complex recursions often leak
  }
};

export function getRetryDelay(cfg: RecursiveConfig<SystemConfig>): number {
  // Logic error: accessing nested properties on a potentially recursive structure
  // might fail if the structure doesn't match the expected depth.
  const network = cfg.network as SystemConfig['network'];
  return network.retry.delay;
}
