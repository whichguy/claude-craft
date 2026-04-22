package batch4

import (
	"context"
	"errors"
	"fmt"
)

type Result struct {
	Data  string
	Error error
}

func ProcessStream(ctx context.Context, inputs []string) ([]string, error) {
	ch := make(chan Result)

	for _, input := range inputs {
		go func(val string) {
			// Simulate complex processing
			if val == "fail" {
				ch <- Result{Error: errors.New("processing failed")}
				return
			}
			ch <- Result{Data: fmt.Sprintf("processed:%s", val)}
		}(input)
	}

	var results []string
	for i := 0; i < len(inputs); i++ {
		res := <-ch
		if res.Error != nil {
			return nil, res.Error
		}
		results = append(results, res.Data)
	}

	return results, nil
}
