package batch4

import (
	"context"
	"fmt"
	"sync"
)

type Account struct {
	ID      string
	Balance float64
	mu      sync.Mutex
}

type TransferManager struct {
	accounts map[string]*Account
	mu       sync.RWMutex
}

func NewTransferManager() *TransferManager {
	return &TransferManager{
		accounts: make(map[string]*Account),
	}
}

func (tm *TransferManager) Transfer(ctx context.Context, fromID, toID string, amount float64) error {
	tm.mu.RLock()
	from := tm.accounts[fromID]
	to := tm.accounts[toID]
	tm.mu.RUnlock()

	if from == nil || to == nil {
		return fmt.Errorf("account not found")
	}

	from.mu.Lock()
	defer from.mu.Unlock()

	to.mu.Lock()
	defer to.mu.Unlock()

	if from.Balance < amount {
		return fmt.Errorf("insufficient funds")
	}

	from.Balance -= amount
	to.Balance += amount

	return nil
}
