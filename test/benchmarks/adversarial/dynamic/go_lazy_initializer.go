package main

import (
	"context"
	"fmt"
	"sync/atomic"
	"unsafe"
)

// Resource represents an expensive object that should be lazily initialized.
type Resource struct {
	ID    string
	Value int
}

// GlobalManager manages shared resources with high-performance lazy loading.
type GlobalManager struct {
	// resourcePtr stores a pointer to the initialized Resource.
	// We use atomic operations for lock-free reads in the hot path.
	resourcePtr unsafe.Pointer
}

// NewGlobalManager creates a new instance of the manager.
func NewGlobalManager() *GlobalManager {
	return &GlobalManager{}
}

// GetResource returns the shared resource, initializing it if necessary.
// This implementation attempts to be high-performance by avoiding a global mutex
// and using double-checked locking with atomics.
func (m *GlobalManager) GetResource(ctx context.Context) (*Resource, error) {
	// Fast path: check if already initialized using atomic load
	ptr := atomic.LoadPointer(&m.resourcePtr)
	if ptr != nil {
		return (*Resource)(ptr), nil
	}

	// Slow path: perform initialization
	// Simulation of an expensive lookup (e.g., DB or API call)
	res, err := m.initializeResource(ctx)
	if err != nil {
		return nil, fmt.Errorf("initialization failed: %w", err)
	}

	// Atomically store the newly created resource.
	// If multiple goroutines reach here, they might all try to store.
	// This is intentional 'last-one-wins' or is it?
	atomic.StorePointer(&m.resourcePtr, unsafe.Pointer(res))

	return res, nil
}

func (m *GlobalManager) initializeResource(ctx context.Context) (*Resource, error) {
	// In a real system, this would involve complex logic.
	return &Resource{
		ID:    "RES-001",
		Value: 42,
	}, nil
}

func main() {
	manager := NewGlobalManager()
	ctx := context.Background()

	res, _ := manager.GetResource(ctx)
	fmt.Printf("Loaded resource: %v\n", res.ID)
}
