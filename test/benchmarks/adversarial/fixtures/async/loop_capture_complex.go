package batch4

import (
	"context"
	"fmt"
	"sync"
)

type Job struct {
	ID      int
	Payload string
}

type WorkerPool struct {
	results chan string
}

func (wp *WorkerPool) RunJobs(ctx context.Context, jobs []Job) []string {
	var wg sync.WaitGroup
	wp.results = make(chan string, len(jobs))

	for _, j := range jobs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// In older Go versions or specific contexts, 'j' is shared.
			// Even in Go 1.22+, complex pointer manipulations can re-introduce this.
			res := wp.process(ctx, &j)
			wp.results <- res
		}()
	}

	wg.Wait()
	close(wp.results)

	var out []string
	for r := range wp.results {
		out = append(out, r)
	}
	return out
}

func (wp *WorkerPool) process(ctx context.Context, job *Job) string {
	return fmt.Sprintf("Job %d: %s", job.ID, job.Payload)
}
