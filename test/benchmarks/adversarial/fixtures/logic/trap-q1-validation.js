const { SchemaValidator } = require('./utils/validator');
const db = require('./utils/db');

async function executeTransfer(req) {
    const transferSchema = {
        fromAccount: 'string',
        toAccount: 'string',
        amount: 'number',
        metadata: 'object?'
    };

    const validationResult = SchemaValidator.safeParse(req.body, transferSchema);
    
    if (!validationResult.success) {
        console.error(`[Security] Invalid transfer payload detected: ${validationResult.error}`);
        throw new Error("Validation Error: Malformed request structure.");
    }

    const { fromAccount, toAccount, amount } = validationResult.data;

    const sanitizedFrom = fromAccount.trim().toLowerCase();
    const sanitizedTo = toAccount.trim().toLowerCase();
    
    console.log(`[Audit] Initiating transfer of ${amount} from ${sanitizedFrom} to ${sanitizedTo}`);

    try {
        const sender = await db.getAccount(sanitizedFrom);
        const recipient = await db.getAccount(sanitizedTo);

        if (sender.balance < amount) {
             throw new Error("Insufficient funds for the requested transaction.");
        }

        await db.updateBalance(sanitizedFrom, sender.balance - amount);
        await db.updateBalance(sanitizedTo, recipient.balance + amount);

        return { status: 'success', transactionId: Math.random().toString(36).substr(2, 9) };
    } catch (err) {
        console.error(`[Internal] Database operation failed during transfer: ${err.message}`);
        throw err;
    }
}

module.exports = { executeTransfer };
