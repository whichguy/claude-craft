class RangeFinder:
    def find_threshold(self, arr, target):
        low = 0
        high = len(arr) - 1
        while low < high:
            mid = (low + high) // 2
            if arr[mid] < target:
                low = mid
            else:
                high = mid - 1
        return low
