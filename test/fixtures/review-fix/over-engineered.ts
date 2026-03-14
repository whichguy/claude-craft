// [TRAP] Simple helper — appropriate level of abstraction
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// [ISSUE: OVER-1] Premature abstraction — generic factory for a single use case
interface HandlerConfig<T> {
  validate: (input: T) => boolean;
  transform: (input: T) => T;
  serialize: (input: T) => string;
  onError?: (err: Error) => void;
}

function createHandler<T>(config: HandlerConfig<T>) {
  return (input: T): string => {
    if (!config.validate(input)) throw new Error('Invalid');
    const transformed = config.transform(input);
    return config.serialize(transformed);
  };
}

// [ISSUE: UNUSED-1] Parameter 'options' is never read
function formatPrice(
  amount: number,
  currency: string,
  options: { locale?: string; decimals?: number }
): string {
  return `${currency} ${amount.toFixed(2)}`;
}

// [ISSUE: OVER-2] Strategy pattern for 2 cases — a simple if/else suffices
interface SortStrategy {
  sort(items: string[]): string[];
}
class AlphaSort implements SortStrategy {
  sort(items: string[]): string[] { return [...items].sort(); }
}
class LengthSort implements SortStrategy {
  sort(items: string[]): string[] { return [...items].sort((a, b) => a.length - b.length); }
}
function sortItems(items: string[], strategy: SortStrategy): string[] {
  return strategy.sort(items);
}
