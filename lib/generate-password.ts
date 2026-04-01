export function generatePassword(length = 20): string {
  const lowercase = "abcdefghijkmnopqrstuvwxyz"
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const digits = "23456789"
  // Alphanumeric only — no symbols that could break connection URIs,
  // shell contexts, or cause quoting headaches in config files.
  const all = lowercase + uppercase + digits
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  // Ensure at least one of each type
  const required = [
    lowercase[array[0] % lowercase.length],
    uppercase[array[1] % uppercase.length],
    digits[array[2] % digits.length],
  ]
  const rest = Array.from(array.slice(3), (b) => all[b % all.length])
  const chars = [...required, ...rest]
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i % array.length] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}
