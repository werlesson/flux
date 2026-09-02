/** Provisório, a calibrar em campo (fase 21): 25 m preserva fixes urbanos úteis e rejeita leituras grosseiras como 60 m. */
export const maxAccuracyMeters = 25;

/** Provisório, a calibrar em campo (fase 21): 15 m/s fica acima de uma corrida humana normal e abaixo de deslocamentos motorizados. */
export const maxPlausibleSpeedMetersPerSecond = 15;

/** Provisório, a calibrar em campo (fase 21): 250 m identifica saltos de antena sem eliminar deslocamentos consecutivos plausíveis. */
export const maxPositionJumpMeters = 250;

/** Provisório, a calibrar em campo (fase 21): 30 s separa a coleta contínua de uma lacuna real de sinal. */
export const maxSampleIntervalSeconds = 30;

/** Provisório, a calibrar em campo (fase 21): 1 s evita duplicatas temporais e ruído de atualizações rápidas demais. */
export const minSampleIntervalSeconds = 1;

/** Provisório, a calibrar em campo (fase 21): abaixo de 0,8 m/s o intervalo não conta como movimento. */
export const movingSpeedThresholdMetersPerSecond = 0.8;

/** Provisório, a calibrar em campo (fase 21): deslocamentos menores que 2 m são tratados como ruído parado. */
export const movingMinimumDisplacementMeters = 2.0;

/** Decisão provisória: pontos são persistidos em lotes de 10 amostras. */
export const activityPointBatchSize = 10.0;

/** Decisão provisória: mesmo sem atingir o tamanho do lote, pontos pendentes são gravados a cada 5 segundos de coleta. */
export const activityPointBatchFlushIntervalSeconds = 5.0;

/** Decisão provisória: checkpoint das métricas a cada 15 segundos. */
export const activityStatePersistenceIntervalSeconds = 15.0;

/** Janela provisória de 30 segundos para pace atual. */
export const currentPaceWindowSeconds = 30.0;

/** Base mínima para evitar pace instável nos primeiros segundos. */
export const currentPaceMinimumDurationSeconds = 10.0;
