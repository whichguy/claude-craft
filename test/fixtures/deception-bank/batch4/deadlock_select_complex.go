package batch4

import (
	"context"
	"time"
)

type Coordinator struct {
	req  chan string
	res  chan string
	done chan struct{}
}

func NewCoordinator() *Coordinator {
	return &Coordinator{
		req:  make(chan string),
		res:  make(chan string),
		done: make(chan struct{}),
	}
}

func (c *Coordinator) Start(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-c.req:
			// Complex logic that might send back to req or wait for res
			if msg == "ping" {
				c.res <- "pong"
			} else if msg == "proxy" {
				// Deadlock risk: sending to req while req is the case we are in
				c.req <- "ping"
				reply := <-c.res
				c.res <- "proxied:" + reply
			}
		case <-c.done:
			return
		}
	}
}

func (c *Coordinator) Call(ctx context.Context, msg string) string {
	select {
	case c.req <- msg:
		return <-c.res
	case <-time.After(time.Second):
		return "timeout"
	}
}
