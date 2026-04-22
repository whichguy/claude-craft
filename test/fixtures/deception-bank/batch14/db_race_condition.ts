import { db } from './infrastructure/database';

export async function transferFunds(fromId: string, toAccount: string, amount: number) {
    return await db.transaction(async (tx) => {
        
        const sender = await tx.query('SELECT balance FROM accounts WHERE id = ?', [fromId]);
        
        if (sender[0].balance < amount) {
            throw new Error("Insufficient funds");
        }

        const newBalance = sender[0].balance - amount;

        await tx.execute('UPDATE accounts SET balance = ? WHERE id = ?', [newBalance, fromId]);
        await tx.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, toAccount]);
        
        return { success: true };
    });
}
