export class TimingEngine {
  private anchorTime = 0;
  private pausedAt: number | null = null;
  private inputOffsetSeconds = 0;
  private started = false;

  start(audioAnchorTime: number, inputOffsetMs = 0): void {
    this.anchorTime = audioAnchorTime;
    this.inputOffsetSeconds = inputOffsetMs / 1000;
    this.pausedAt = null;
    this.started = true;
  }

  setInputOffset(inputOffsetMs: number): void {
    this.inputOffsetSeconds = inputOffsetMs / 1000;
  }

  getPlayhead(audioTime: number): number {
    if (!this.started) return 0;
    const sourceTime = this.pausedAt ?? audioTime;
    return sourceTime - this.anchorTime;
  }

  getInputPlayhead(audioTime: number): number {
    return this.getPlayhead(audioTime) + this.inputOffsetSeconds;
  }

  pause(audioTime: number): void {
    if (this.started && this.pausedAt === null) this.pausedAt = audioTime;
  }

  resume(audioTime: number): void {
    if (this.pausedAt === null) return;
    this.anchorTime += audioTime - this.pausedAt;
    this.pausedAt = null;
  }

  reset(): void {
    this.started = false;
    this.pausedAt = null;
    this.anchorTime = 0;
  }
}