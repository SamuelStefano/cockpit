// Compartilhado de propósito: o cliente usa pra reconhecer a cerca ```bench:<slug>
// e o servidor pra validar o slug antes de tocar o registro. Se divergirem, uma
// cerca renderiza um card que o servidor sempre recusa.
export const BENCH_SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/;
