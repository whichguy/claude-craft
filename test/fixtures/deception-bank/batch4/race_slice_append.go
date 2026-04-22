package batch4

import (
	"context"
	"sync"
	"time"
)

type Metric struct {
	Timestamp time.Time
	Value     float64
}

type MetricsCollector struct {
	data []Metric
	// Collector has no mutex for data, assuming callers handle it or
	// that single-threaded collection is enough.
}

func (mc *MetricsCollector) Collect(ctx context.Context, m Metric) {
	mc.data = append(mc.data, m)
}

type Aggregator struct {
	collectors []*MetricsCollector
}

func (a *Aggregator) Start(ctx context.Context) {
	var wg sync.WaitGroup
	// Shared collector across multiple concurrent workers
	shared := &MetricsCollector{}

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			ticker := time.NewTicker(time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case t := <-ticker.C:
					shared.Collect(ctx, Metric{Timestamp: t, Value: float64(id)})
				}
			}
		}(i)
	}
	wg.Wait()
}
