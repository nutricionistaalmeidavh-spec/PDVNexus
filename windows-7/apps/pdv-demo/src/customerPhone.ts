/** Campo opcional do cliente, armazenado como telefone brasileiro com DDD (somente dígitos). */
export function normalizePdvCustomerPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if ((digits.length !== 10 && digits.length !== 11) || digits[0] === "0" || digits[1] === "0") {
    throw new Error("Informe um telefone/WhatsApp brasileiro com DDD válido (10 ou 11 dígitos).");
  }
  return digits;
}

/** Preserva os campos e metadados existentes, sem criar uma fonte paralela de clientes. */
export function updatePdvCustomerContact<T extends object>(previous: T, rawPhone: string): T & { phone: string } {
  return { ...previous, phone: normalizePdvCustomerPhone(rawPhone) };
}
