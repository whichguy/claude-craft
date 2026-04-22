package batch4

import (
	"context"
	"fmt"
	"sync"
)

type BackendClient struct {
	ready chan struct{}
	mu    sync.Mutex
	data  map[string]string
}

func NewBackendClient(ctx context.Context) *BackendClient {
	bc := &BackendClient{
		ready: make(chan struct{}),
		data:  make(map[string]string),
	}

	go bc.initialize(ctx)

	return bc
}

func (bc *BackendClient) initialize(ctx context.Context) {
	// Simulate expensive initialization
	select {
	case <-ctx.Done():
		// If context is cancelled here, we return.
		// But what if Get() is already waiting on bc.ready?
		return
	case <-bc.simulateNetwork():
		bc.mu.Lock()
		bc.data["status"] = "online"
		bc.mu.Unlock()
		close(bc.ready)
	}
}

func (bc *BackendClient) simulateNetwork() <-chan struct{} {
	ch := make(chan struct{})
	go func() {
		// some work
		ch <- struct{}{}
	}()
	return ch
}

func (bc *BackendClient) Get(ctx context.Context, key string) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-bc.ready: // If initialize() returns on ctx.Done() without closing bc.ready, this blocks forever
		bc.mu.Lock()
		defer bc.mu.Unlock()
		return bc.data[key], nil
	}
}
