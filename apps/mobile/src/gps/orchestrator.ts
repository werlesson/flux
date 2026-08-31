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
}
