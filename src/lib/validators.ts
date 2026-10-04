export function validateRequired(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function validateEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}
