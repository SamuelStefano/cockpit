// Regra de senha nova, pura e compartilhada pelas duas telas que definem senha
// (recuperação e troca no perfil). Valida ANTES de bater no Supabase: o servidor
// só recusa <6 e devolve a mensagem em inglês, e a confirmação nem chega lá.

export const MIN_PASSWORD = 6;

export function newPasswordError(password: string, confirm: string): string {
  if (password.length < MIN_PASSWORD) return `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`;
  if (password !== confirm) return 'As senhas não conferem.';
  return '';
}
