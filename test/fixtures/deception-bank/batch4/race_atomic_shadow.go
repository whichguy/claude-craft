package batch4

import (
	"context"
	"sync/atomic"
)

type RequestTracker struct {
	totalRequests int64
	activeWorkers int32
}

func (rt *RequestTracker) Inc(ctx context.Context) {
	atomic.AddInt64(&rt.totalRequests, 1)
}

func (rt *RequestTracker) Dec(ctx context.Context) {
	atomic.AddInt64(&rt.totalRequests, -1)
}

func (rt *RequestTracker) GetStats() (int64, bool) {
	// Mixed atomic and non-atomic access. 
	// The developer might think reading the value directly is fine since it's "just an int64".
	total := rt.totalRequests 
	
	isBusy := atomic.LoadInt32(&rt.activeWorkers) > 10
	
	return total, isBusy
}

func (rt *RequestTracker) SetBusy(busy bool) {
	if busy {
		atomic.StoreInt32(&rt.activeWorkers, 20)
	} else {
		atomic.StoreInt32(&rt.activeWorkers, 0)
	}
}
