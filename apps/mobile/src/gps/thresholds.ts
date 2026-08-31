/** Provisório, a calibrar em campo (fase 20): 25 m preserva fixes urbanos úteis e rejeita leituras grosseiras como 60 m. */
export const maxAccuracyMeters = 25;

/** Provisório, a calibrar em campo (fase 20): 15 m/s fica acima de uma corrida humana normal e abaixo de deslocamentos motorizados. */
export const maxPlausibleSpeedMetersPerSecond = 15;

/** Provisório, a calibrar em campo (fase 20): 250 m identifica saltos de antena sem eliminar deslocamentos consecutivos plausíveis. */
export const maxPositionJumpMeters = 250;

/** Provisório, a calibrar em campo (fase 20): 30 s separa a coleta contínua de uma lacuna real de sinal. */
export const maxSampleIntervalSeconds = 30;

/** Provisório, a calibrar em campo (fase 20): 1 s evita duplicatas temporais e ruído de atualizações rápidas demais. */
export const minSampleIntervalSeconds = 1;
