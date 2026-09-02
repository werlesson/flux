/**
 * Ferramentas de diagnóstico do Flux só existem no development build. Em
 * release elas não devem aparecer nem ser navegáveis: o app do corredor não
 * carrega inspeção de banco (US-3.1).
 */
export function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}
