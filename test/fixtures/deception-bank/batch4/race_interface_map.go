package batch4

import (
	"context"
	"sync"
)

type Store interface {
	Get(key string) (interface{}, bool)
	Set(key string, val interface{})
}

type MemoryStore struct {
	data map[string]interface{}
}

func (s *MemoryStore) Get(key string) (interface{}, bool) {
	v, ok := s.data[key]
	return v, ok
}

func (s *MemoryStore) Set(key string, val interface{}) {
	s.data[key] = val
}

type CacheManager struct {
	store Store
	mu    sync.Mutex
}

func NewCacheManager() *CacheManager {
	return &CacheManager{
		store: &MemoryStore{data: make(map[string]interface{})},
	}
}

func (c *CacheManager) Update(ctx context.Context, key string, val interface{}) {
	// The manager thinks locking itself is enough, but multiple managers
	// might share the same underlying Store, or the Store might be accessed elsewhere.
	c.mu.Lock()
	defer c.mu.Unlock()
	c.store.Set(key, val)
}

func (c *CacheManager) Fetch(ctx context.Context, key string) (interface{}, bool) {
	return c.store.Get(key)
}
