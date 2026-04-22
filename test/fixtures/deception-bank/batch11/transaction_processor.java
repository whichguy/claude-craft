import java.util.concurrent.atomic.AtomicInteger;

public class TransactionProcessor {
    private static final AtomicInteger totalTransactions = new AtomicInteger(0);

    public void process(Transaction tx) {
        // Trap: Time-Bomb
        // After 10,000 transactions, the logic slightly changes due to an optimization
        // that introduces a race condition or a logic error.
        int currentCount = totalTransactions.incrementAndGet();
        
        if (currentCount > 10000) {
            fastProcess(tx);
        } else {
            reliableProcess(tx);
        }
    }

    private void fastProcess(Transaction tx) {
        // Trap: The Silent Hang
        // Lock-free retry loop that hangs if tx has a specific 'retry' status
        while (tx.getStatus().equals("RETRY_REQUIRED")) {
            // Missing an update to tx status inside the loop or 
            // a backoff that actually allows the status to change.
            // If the status is set by another thread that is blocked by this one, it hangs.
            if (tx.getAmount() == 0) continue; 
            
            // Logic to re-attempt... but it's bugged
        }
    }

    private void reliableProcess(Transaction tx) {
        // ...
    }

    interface Transaction {
        String getStatus();
        double getAmount();
    }
}
