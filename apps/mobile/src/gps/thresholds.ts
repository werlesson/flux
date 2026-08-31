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

/** ProvisÃ³rio, a calibrar em campo (fase 20): abaixo de 0,8 m/s o intervalo nÃ£o conta como movimento. */
export const movingSpeedThresholdMetersPerSecond = 0.8;

/** ProvisÃ³rio, a calibrar em campo (fase 20): deslocamentos menores que 2 m sÃ£o tratados como ruÃ­do parado. */
export const movingMinimumDisplacementMeters = 2.0;

/** DecisÃ£o provisÃ³ria: pontos sÃ£o persistidos em lotes de 10 amostras. */
export const activityPointBatchSize = 10.0;

/** Decisão provisória: mesmo sem atingir o tamanho do lote, pontos pendentes são gravados a cada 5 segundos de coleta. */
export const activityPointBatchFlushIntervalSeconds = 5.0;

/** DecisÃ£o provisÃ³ria: checkpoint das mÃ©tricas a cada 15 segundos. */
export const activityStatePersistenceIntervalSeconds = 15.0;

/** Janela provisÃ³ria de 30 segundos para pace atual. */
export const currentPaceWindowSeconds = 30.0;

/** Base mÃ­nima para evitar pace instÃ¡vel nos primeiros segundos. */
export const currentPaceMinimumDurationSeconds = 10.0;
