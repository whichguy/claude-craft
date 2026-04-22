package main

type HashDistributor struct {
	Buckets int
}

func (d *HashDistributor) GetBucket(hashCode int) int {
	return hashCode % d.Buckets
}
