package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sync"
)

// TRAP 1: Data Race / Concurrency bug.
// The map 'cache' is written to concurrently without a mutex.
var cache = make(map[string]string)

func fetchAndCache(urls []string) {
	var wg sync.WaitGroup

	for _, url := range urls {
		wg.Add(1)
		
		// TRAP 2: Loop variable capture in goroutine (classic Go < 1.22 bug).
		// All goroutines might end up using the last 'url' in the slice.
		go func() {
			defer wg.Done()
			
			resp, err := http.Get(url)
			// TRAP 3: Ignored error handling.
			if err != nil {
				// We log it but proceed to read from a nil response, causing a panic.
				fmt.Println("Failed to fetch")
			}
			
			// TRAP 4: Resource leak. Deferring Close() inside a loop or not at all.
			// Here, we defer, but if err != nil, resp is nil and resp.Body panics.
			defer resp.Body.Close()
			
			body, _ := ioutil.ReadAll(resp.Body)
			
			// Concurrent map write (Panic)
			cache[url] = string(body)
		}()
	}

	wg.Wait()
}

// TRAP 5: Resource leak in a loop.
func writeLogs(entries []string) {
	for _, entry := range entries {
		f, _ := os.OpenFile("/tmp/app.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		// Defer inside a loop means files aren't closed until the surrounding function exits.
		// Can exhaust file descriptors.
		defer f.Close() 
		f.WriteString(entry + "\n")
	}
}
