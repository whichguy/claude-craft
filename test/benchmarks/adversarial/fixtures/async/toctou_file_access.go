package batch4

import (
	"context"
	"fmt"
	"os"
	"sync"
)

type SecureLogger struct {
	path string
	mu   sync.Mutex
}

func NewSecureLogger(path string) *SecureLogger {
	return &SecureLogger{path: path}
}

func (l *SecureLogger) Log(ctx context.Context, message string) error {
	// TOCTOU: Check if file exists and has correct permissions
	info, err := os.Stat(l.path)
	if os.IsNotExist(err) {
		// File doesn't exist, create it with restricted permissions
		f, err := os.OpenFile(l.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = f.WriteString(fmt.Sprintf("[INIT] %s\n", message))
		return err
	}

	if info.Mode().Perm() != 0600 {
		return fmt.Errorf("insecure file permissions")
	}

	// Another process or goroutine could change/delete the file here
	f, err := os.OpenFile(l.path, os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(message + "\n")
	return err
}
