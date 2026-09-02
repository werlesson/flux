/**
 * Política de expurgo dos pontos rejeitados — decisão da fase 20 para a Open
 * Question homônima de `database-schema.md`.
 *
 * DECISÃO: os `activity_points` com `is_valid = 0` são **mantidos por padrão**.
 * Não existe expurgo automático em lugar nenhum do app — nem por idade, nem por
 * volume, nem ao encerrar a atividade, nem em migração. O único caminho de
 * remoção é manual, disparado na ferramenta de inspeção do development build e
 * confirmado explicitamente, uma atividade por vez.
 *
 * Por que manter: os rejeitados são a matéria-prima da calibração (fase 21) e
 * continuam sendo a única evidência de que o filtro descartou algo — sem eles
 * não há como reavaliar um limiar depois. O custo é volume, e o volume já está
 * coberto pelos índices `(activity_id, is_valid)` e `(activity_id, recorded_at)`.
 *
 * O que o expurgo NÃO é: não é a exclusão da US-8.4. Apagar a atividade inteira
 * continua sendo o caminho de privacidade, remove pontos válidos e inválidos em
 * cascata e independe desta política.
 */

/**
 * Trava de calibração. Enquanto for `false`, `expurgoLiberado()` recusa qualquer
 * remoção: os rejeitados são o insumo da fase 21 e apagá-los antes destruiria a
 * medição. Só a fase 21, com os dados de campo transcritos, vira esta chave —
 * e ela é deliberadamente uma constante no código, não uma preferência de
 * usuário, para que a mudança apareça em revisão de diff.
 */
export const calibracaoDeCampoConcluida = false;

/** Confirmação exigida para expurgar. Digitada por extenso: não há botão que apague sozinho. */
export const CONFIRMACAO_DE_EXPURGO = 'EXPURGAR';

export type MotivoDeBloqueio = 'calibracao_pendente' | 'confirmacao_ausente';

export interface ExpurgoBloqueado { permitido: false; motivo: MotivoDeBloqueio }
export interface ExpurgoPermitido { permitido: true }
export type AvaliacaoDeExpurgo = ExpurgoBloqueado | ExpurgoPermitido;

export const mensagensDeBloqueio: Record<MotivoDeBloqueio, string> = {
  calibracao_pendente: 'Os pontos rejeitados são a matéria-prima da calibração de campo (fase 21) e não podem ser expurgados antes dela.',
  confirmacao_ausente: `Digite ${CONFIRMACAO_DE_EXPURGO} para confirmar a remoção definitiva dos pontos rejeitados.`,
};

/**
 * Decide se um expurgo pode acontecer. As duas condições são independentes e a
 * ordem importa na mensagem: a trava de calibração é o bloqueio mais forte e é
 * reportada antes da confirmação que falta.
 */
export function expurgoLiberado(confirmacao: string, calibracaoConcluida = calibracaoDeCampoConcluida): AvaliacaoDeExpurgo {
  if (!calibracaoConcluida) return { permitido: false, motivo: 'calibracao_pendente' };
  if (confirmacao.trim().toUpperCase() !== CONFIRMACAO_DE_EXPURGO) return { permitido: false, motivo: 'confirmacao_ausente' };
  return { permitido: true };
}

export class ExpurgoRecusadoError extends Error {
  constructor(readonly motivo: MotivoDeBloqueio) {
    super(mensagensDeBloqueio[motivo]);
    this.name = 'ExpurgoRecusadoError';
  }
}
