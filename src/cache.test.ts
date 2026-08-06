import { describe, expect, it } from "bun:test";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
    it("returns undefined for a missing key", () => {
        const cache = new TtlCache<string>(60_000);

        expect(cache.get("missing")).toBeUndefined();
    });

    it("returns the stored value within the TTL", () => {
        const cache = new TtlCache<string>(60_000);
        cache.set("key", "value");

        expect(cache.get("key")).toBe("value");
    });

    it("returns undefined for an expired entry", async () => {
        const cache = new TtlCache<string>(10);
        cache.set("key", "value");

        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(cache.get("key")).toBeUndefined();
    });

    it("keeps entries independent per key", () => {
        const cache = new TtlCache<string>(60_000);
        cache.set("a", "1");
        cache.set("b", "2");

        expect(cache.get("a")).toBe("1");
        expect(cache.get("b")).toBe("2");
    });

    it("delete removes the entry", () => {
        const cache = new TtlCache<string>(60_000);
        cache.set("key", "value");
        cache.delete("key");

        expect(cache.get("key")).toBeUndefined();
    });

    it("overwrite refreshes the timestamp", async () => {
        const cache = new TtlCache<string>(50);
        cache.set("key", "old");

        await new Promise((resolve) => setTimeout(resolve, 60));

        cache.set("key", "new");

        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(cache.get("key")).toBe("new");
    });
});
