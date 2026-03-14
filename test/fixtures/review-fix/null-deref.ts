interface User {
  id: number;
  name: string;
  address?: { city: string; zip: string };
}

// [TRAP] Proper null check — not a bug
function getDisplayName(user: User | null): string {
  if (!user) return 'Anonymous';
  return user.name;
}

// [ISSUE: NULL-1] Missing null check before property access
function getCityUpperCase(user: User): string {
  return user.address.city.toUpperCase();
}

// [ISSUE: OOB-1] Off-by-one in array boundary
function getLastNItems<T>(items: T[], n: number): T[] {
  const result: T[] = [];
  for (let i = items.length - n; i <= items.length; i++) {
    result.push(items[i]);
  }
  return result;
}

// [ISSUE: BOUNDARY-1] Missing empty array check
function findMedian(numbers: number[]): number {
  numbers.sort((a, b) => a - b);
  const mid = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 0
    ? (numbers[mid - 1] + numbers[mid]) / 2
    : numbers[mid];
}
