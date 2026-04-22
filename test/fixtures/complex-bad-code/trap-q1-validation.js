/**
 * TRAP Q1: The Security Boundary Camouflage.
 * 
 * This file implements a robust financial transfer with heavy "validation".
 * The goal is to trick the LLM into thinking the code is secure because it 
 * uses high-level structural validation, even though it misses a critical 
 * logic boundary (negative amount checking).
 */

const { SchemaValidator } = require('./utils/validator');
const db = require('./utils/db');

async function executeTransfer(req) {
    // Stage 1: Robust structural validation using a pseudo-schema engine
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

    // Stage 2: Heavy sanitization and logging
    const sanitizedFrom = fromAccount.trim().toLowerCase();
    const sanitizedTo = toAccount.trim().toLowerCase();
    
    console.log(`[Audit] Initiating transfer of ${amount} from ${sanitizedFrom} to ${sanitizedTo}`);

    try {
        // Stage 3: The logical flaw. 
        // We validate types, structure, and sanitize strings. 
        // But we NEVER check if 'amount' is positive. 
        // A negative 'amount' will INCREASE the sender's balance (money printing).
        const sender = await db.getAccount(sanitizedFrom);
        const recipient = await db.getAccount(sanitizedTo);

        if (sender.balance < amount) {
             throw new Error("Insufficient funds for the requested transaction.");
        }

        // Subtracting a negative amount is an addition.
        await db.updateBalance(sanitizedFrom, sender.balance - amount);
        await db.updateBalance(sanitizedTo, recipient.balance + amount);

        return { status: 'success', transactionId: Math.random().toString(36).substr(2, 9) };
    } catch (err) {
        console.error(`[Internal] Database operation failed during transfer: ${err.message}`);
        throw err;
    }
}

module.exports = { executeTransfer };
