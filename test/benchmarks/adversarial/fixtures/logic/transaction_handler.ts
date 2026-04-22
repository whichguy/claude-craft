export class TransactionHandler {
  async execute(fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (error) {
      throw error;
    } finally {
      return false;
    }
  }
}
