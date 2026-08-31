import {
  createGpsFilterState,
  filterGpsSample,
  type GpsFilterResult,
  type GpsFilterState,
  type GpsSample,
} from './filter';

export type GpsFilterResultConsumer = (sample: GpsSample, result: GpsFilterResult) => void | Promise<void>;

/** Owns the serializable filter state shared by foreground and background acquisition. */
export class GpsFilterOrchestrator {
  constructor(
    private state: GpsFilterState = createGpsFilterState(),
    private readonly consumeResult: GpsFilterResultConsumer = () => undefined,
  ) {}

  async processSample(sample: GpsSample): Promise<GpsFilterResult> {
    const result = filterGpsSample(sample, this.state);
    this.state = result.estado;
    await this.consumeResult(sample, result);
    return result;
  }

  getState(): GpsFilterState {
    return this.state;
  }

  /**
   * Reidrata o estado a partir do que foi persistido, para que uma atividade
   * recuperada volte com o último ponto aceito como referência. Sem isso as
   * regras de salto e velocidade não teriam contra o que comparar e a primeira
   * amostra após a recuperação passaria sem validação (US-6.3, US-3.1).
   */
  restoreState(state: GpsFilterState): void {
    this.state = state;
  }
}
