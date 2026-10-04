/**
 * A value read again only when older than `ttlMs`; concurrent readers of an expired value
 * share one load. For what many requests ask and rarely changes (the watchers' connections,
 * the landing page statistics, the maintenance flag, the active announcement).
 *
 * ponytail: per process, like every cache here; several backend copies would each keep
 * their own (staler by at most `ttlMs`).
 */
export class CachedValue<T> {
  private value: { at: number; data: T } | null = null;
  private loading: Promise<T> | null = null;
  /** Bumped by clear(): a load that started before it is not kept. */
  private generation = 0;

  constructor(private readonly ttlMs: number) {}

  async get(load: () => Promise<T>): Promise<T> {
    if (this.value && Date.now() - this.value.at <= this.ttlMs) return this.value.data;
    if (!this.loading) {
      const generation = this.generation;
      const loading = load().then((data) => {
        if (generation === this.generation) this.value = { at: Date.now(), data };
        return data;
      });
      this.loading = loading;
      const done = () => {
        if (this.loading === loading) this.loading = null;
      };
      loading.then(done, done);
    }
    return this.loading;
  }

  /** The next read loads it again (after a change made here). */
  clear() {
    this.generation++;
    this.value = null;
    this.loading = null;
  }
}
