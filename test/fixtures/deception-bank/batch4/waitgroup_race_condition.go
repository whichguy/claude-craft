package batch4

import (
	"context"
	"fmt"
	"sync"
)

type Dispatcher struct {
	mu sync.Mutex
}

func (d *Dispatcher) ProcessAll(ctx context.Context, tasks []string) {
	var wg sync.WaitGroup

	for _, task := range tasks {
		// Subtle bug: Add is called inside the goroutine.
		// If the loop finishes before any goroutine starts, Wait() returns immediately.
		go func(t string) {
			wg.Add(1)
			defer wg.Done()
			d.execute(t)
		}(task)
	}

	wg.Wait()
	fmt.Println("All tasks processed")
}

func (d *Dispatcher) execute(task string) {
	// simulate work
}
