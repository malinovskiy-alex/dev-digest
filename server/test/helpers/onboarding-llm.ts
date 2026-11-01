/**
 * Test-only LLM providers for the onboarding tour: one whose answer waits for
 * `release()` (or never comes), one that always rejects. Both record calls the
 * way `MockLLMProvider` does.
 */
import type { LLMProvider, StructuredRequest, StructuredResult } from '@devdigest/shared';
import { MockLLMProvider } from '../../src/adapters/mocks.js';

export class GatedLLM implements LLMProvider {
  readonly id = 'openai' as const;
  calls: { method: string; req: unknown }[] = [];
  private inner: MockLLMProvider;
  private open!: () => void;
  private gate = new Promise<void>((r) => {
    this.open = r;
  });
  constructor(fixture: unknown) {
    this.inner = new MockLLMProvider('openai', { structured: fixture });
  }
  release(): void {
    this.open();
  }
  reset(): void {
    this.calls = [];
    this.gate = new Promise<void>((r) => {
      this.open = r;
    });
  }
  async listModels() {
    return [];
  }
  async complete(): Promise<never> {
    throw new Error('not used');
  }
  async embed(): Promise<number[][]> {
    return [];
  }
  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push({ method: 'completeStructured', req });
    await this.gate;
    return this.inner.completeStructured(req);
  }
}

export class FailingLLM extends MockLLMProvider {
  constructor(private err: unknown) {
    super('openai');
  }
  override async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push({ method: 'completeStructured', req });
    throw this.err;
  }
}
