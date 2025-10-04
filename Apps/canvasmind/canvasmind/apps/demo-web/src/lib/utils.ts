export function cn(...inputs: Array<string | null | false | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
