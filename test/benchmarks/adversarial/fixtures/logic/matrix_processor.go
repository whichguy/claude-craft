package main

import "fmt"

func ProcessMatrix(matrix [][]int) {
	for i := 0; i < len(matrix); i++ {
		for i := 0; i < len(matrix[i]); i++ {
			fmt.Printf("%d ", matrix[i][i])
		}
		fmt.Println()
	}
}
