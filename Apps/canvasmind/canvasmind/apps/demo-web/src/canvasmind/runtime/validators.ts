export function validateTextureBudget(sizeMB: number, cap = 128): boolean {
  return sizeMB <= cap;
}

export function validateTrisCount(count: number, cap = 1_000_000): boolean {
  return count <= cap;
}
