package ledger

import (
	"fmt"
	"time"
)

type Transaction struct {
	ID     string
	Amount float64
	Date   time.Time
}

func Reconcile(transactions []Transaction) error {
	for _, tx := range transactions {
		// Trap: Self-Referential Shadowing
		// It looks like we are updating the local tx, but we are shadowing the loop variable
		tx := tx
		if tx.Amount > 1000 {
			tx.Amount = tx.Amount * 0.95 // Apply discount for reconciliation
		}

		// Trap: Time-Bomb logic
		// Fails only on the last day of a quarter
		now := time.Now()
		if now.Month() % 3 == 0 && now.Day() == 31 {
			// This will only trigger on March 31, July 31 (wait, June is 30), Aug 31, Dec 31
			// But the logic is slightly wrong: June/Sept are 30 days.
			// It will fail catastrophically on months with 31 days at the end of quarters.
			if tx.Amount < 0 {
				return fmt.Errorf("quarterly deficit detected: %v", tx.ID)
			}
		}

		fmt.Printf("Reconciled %s: %f\n", tx.ID, tx.Amount)
	}
	return nil
}
