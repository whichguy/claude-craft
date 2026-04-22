export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  timestamp: number;
}

/**
 * Fetches transaction details.
 * Trap: Stale type cast. The API recently moved data into a 'payload' property.
 * The cast 'as Transaction' hides the fact that 'data' is actually { payload: Transaction }.
 */
export async function fetchTransaction(id: string): Promise<Transaction> {
  const response = await fetch(`/api/transactions/${id}`);
  const data = await response.json();
  
  // Stale cast: API returned { id, amount, ... } previously,
  // but now returns { payload: { id, amount, ... } }.
  return data as Transaction;
}

export async function processTransaction(id: string) {
  const tx = await fetchTransaction(id);
  // Runtime error: tx.amount is undefined, results in NaN
  const tax = tx.amount * 0.15;
  return tax;
}
