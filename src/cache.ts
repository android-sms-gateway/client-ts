/**
 * Internal SDK helper: a generic cache that stores values for a fixed
 * time-to-live (TTL), computed at read time. Expired entries are treated as
 * misses but are not eagerly removed.
 */
export class TtlCache<T> {
    private readonly entries = new Map<string, { value: T; fetchedAt: number }>();

    /**
     * @param ttlMs The time-to-live in milliseconds for stored values
     */
    constructor(private readonly ttlMs: number) {}

    /**
     * Returns the stored value for the key if it was set less than the TTL
     * ago, otherwise returns undefined.
     */
    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry || Date.now() - entry.fetchedAt >= this.ttlMs) {
            return undefined;
        }
        return entry.value;
    }

    /**
     * Stores the value for the key, resetting its TTL timestamp.
     */
    set(key: string, value: T): void {
        this.entries.set(key, { value, fetchedAt: Date.now() });
    }

    /**
     * Removes the entry for the key.
     */
    delete(key: string): void {
        this.entries.delete(key);
    }
}
