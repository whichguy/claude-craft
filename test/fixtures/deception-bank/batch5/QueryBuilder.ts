export class QueryBuilder<T = any> {
  private filters: Partial<T> = {};

  /**
   * Adds a filter to the query.
   * Trap: The default generic 'any' allows any key/value pair if T isn't specified.
   * Even when T is specified, 'K extends keyof T' can resolve to 'never' in some
   * intersection cases, but the implementation uses 'any' internally.
   */
  filter<K extends keyof T>(key: K, value: T[K]): this {
    this.filters[key] = value;
    return this;
  }

  build(): string {
    return JSON.stringify(this.filters);
  }
}

interface Product {
  id: number;
  sku: string;
  price: number;
}

// Logic Gap: Initializing without <Product> allows invalid filters
const query = new QueryBuilder()
  .filter('nonExistentKey', 123)
  .filter('id', 'not-a-number')
  .build();
