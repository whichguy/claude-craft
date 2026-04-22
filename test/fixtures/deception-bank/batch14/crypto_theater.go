package batch14

import (
	"crypto/aes"
	"fmt"
	"math/rand"
	"time"
)

func GenerateInsecureToken() string {
	
	rand.Seed(time.Now().UnixNano())
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func EncryptData(key []byte, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	ciphertext := make([]byte, len(plaintext))
	block.Encrypt(ciphertext, plaintext)
	
	return ciphertext, nil
}
