/** Contato opcional do cliente. Armazena DDD + número, não exige WhatsApp nem serviço externo. */
export function normalizePdvContactPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) {
    if (raw.trim()) throw new Error("Informe telefone com DDD ou deixe o campo vazio.");
    return "";
  }
  if (/[a-z]/i.test(raw)) throw new Error("O telefone deve conter apenas dígitos e pontuação.");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11)
    throw new Error("Informe telefone com DDD (10 ou 11 dígitos) ou deixe vazio.");
  return digits;
}
