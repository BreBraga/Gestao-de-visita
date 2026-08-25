/**
 * O "hoje" do vendedor, não o do servidor.
 *
 * `new Date().toISOString()` devolve a data em UTC: das 21h à meia-noite no
 * Brasil isso já é o dia seguinte, e a agenda abriria vazia no fim da tarde,
 * justamente quando o vendedor está fechando o dia.
 */
export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/**
 * 'YYYY-MM-DD' para 'DD/MM/AAAA', sem passar por `Date`.
 *
 * `new Date('2026-08-25')` é meia-noite UTC; formatado em UTC-3 vira 24/08.
 * Como a data já é só uma data, o recorte de string é a conversão correta.
 */
export function formatarDia(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}
