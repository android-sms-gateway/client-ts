import { describe, expect, it } from "bun:test";

import vector from "../test-vectors/e2e-vector-v1.json";

import {
    E2E_FORMAT,
    E2E_PREFIX,
    E2E_VERSION,
    E2EError,
    E2EErrorCode,
    base64ToBytes,
    bytesToBase64,
    bytesToHex,
    decryptChunk4,
    decryptChunk6,
    decryptValue,
    encryptAESChunk,
    encryptValue,
    hexToBytes,
    splitE2EValue,
} from "./encryption";

describe("E2E encryption (Web Crypto)", () => {
    describe("test vector parsing", () => {
        it("parses fullFormatSample into exactly 7 chunks", () => {
            const chunks = vector.fullFormatSample.split("$");

            expect(chunks).toHaveLength(7);
            expect(chunks[0]).toBe("");
            expect(chunks[1]).toBe("rsa-oaep-aes-256-gcm");
            expect(chunks[2]).toBe("v=1");
            expect(chunks[3]).toBe("k=1");
            expect(chunks[4]).toBe(vector.chunk4EncryptedAesKeyB64);
            expect(chunks[5]).toBe("AAECAwQFBgcICQoL");
            expect(chunks[6]).toBe(vector.ctTagChunkB64);
        });

        it("chunk5 decodes to the fixed 12-byte vector IV", () => {
            const iv = base64ToBytes("AAECAwQFBgcICQoL");
            expect(bytesToHex(iv)).toBe(vector.ivHex);
            expect(iv.length).toBe(12);
        });

        it("splitE2EValue validates a produced value and returns the chunks", () => {
            const chunks = splitE2EValue(vector.fullFormatSample);
            expect(chunks).toHaveLength(7);
            expect(chunks[1]).toBe(E2E_FORMAT);
            expect(chunks[2]).toBe(`v=${E2E_VERSION}`);
            expect(chunks[3]).toBe(`k=${vector.keyVersion}`);
        });

        it("rejects malformed values with a typed InvalidFormat error", () => {
            const badValues = [
                "$rsa-oaep-aes-256-gcm$v=1$k=1$a$b",
                "$aes-256-cbc/pbkdf2-sha1$i=300000$salt$ct",
                "$rsa-oaep-aes-256-gcm$v=2$k=1$a$b$c$d",
            ];

            for (const bad of badValues) {
                let error: unknown;
                try {
                    splitE2EValue(bad);
                } catch (caught) {
                    error = caught;
                }

                expect(error).toBeInstanceOf(E2EError);
                expect((error as E2EError).code).toBe(E2EErrorCode.InvalidFormat);
            }
        });
    });

    describe("vector verification", () => {
        it("chunk4 RSA-decrypts to the fixed 32-byte AES key", async () => {
            const aesKey = await decryptChunk4(vector.privateKeyPem, vector.chunk4EncryptedAesKeyB64);

            expect(bytesToHex(aesKey)).toBe(vector.aesKeyHex);
            expect(aesKey.length).toBe(32);
        });

        it("ctTag chunk AES-GCM-decrypts to the plaintext with the fixed key and IV", async () => {
            const plaintext = await decryptChunk6(
                hexToBytes(vector.aesKeyHex),
                hexToBytes(vector.ivHex),
                vector.ctTagChunkB64,
            );

            expect(plaintext).toBe(vector.plaintext);
        });

        it("re-encrypting with the same key and IV reproduces ctTagChunkB64 byte-for-byte", async () => {
            const ctTag = await encryptAESChunk(
                hexToBytes(vector.aesKeyHex),
                hexToBytes(vector.ivHex),
                vector.plaintext,
            );

            expect(ctTag).toBe(vector.ctTagChunkB64);
        });

        it("decrypts fullFormatSample end to end with the private key", async () => {
            const plaintext = await decryptValue(vector.privateKeyPem, vector.fullFormatSample);
            expect(plaintext).toBe(vector.plaintext);
        });
    });

    describe("encryptValue format", () => {
        it("produces the exact 7-chunk wire format with leading dollar sign", async () => {
            const value = await encryptValue(vector.publicKeySpkiBase64, 1, vector.plaintext);

            expect(value.startsWith(E2E_PREFIX)).toBe(true);
            expect(value).toContain(`v=${E2E_VERSION}$`);
            const chunks = splitE2EValue(value);
            expect(chunks).toHaveLength(7);
            expect(chunks[3]).toBe(`k=${vector.keyVersion}`);
            expect(base64ToBytes(chunks[5]).length).toBe(12);
        });

        it("embeds the listing keyVersion verbatim in k=", async () => {
            const value = await encryptValue(vector.publicKeySpkiBase64, 7, "hello");
            expect(splitE2EValue(value)[3]).toBe("k=7");
        });

        it("uses NO_WRAP padded base64 without line breaks", async () => {
            const value = await encryptValue(vector.publicKeySpkiBase64, 1, vector.plaintext);

            expect(value).not.toMatch(/[\r\n]/);
            for (const chunk of splitE2EValue(value).slice(4)) {
                expect(chunk).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
            }
        });

        it("chunk4 decodes to exactly 256 bytes (RSA-2048) with padding", async () => {
            const value = await encryptValue(vector.publicKeySpkiBase64, 1, vector.plaintext);
            const encAesKey = base64ToBytes(splitE2EValue(value)[4]);

            expect(encAesKey.length).toBe(256);
            expect(splitE2EValue(value)[4]).toMatch(/={1,2}$/);
        });

        it("encrypts an 11-char phone number to ~428 chars", async () => {
            const value = await encryptValue(vector.publicKeySpkiBase64, 1, "+1234567890");
            expect(value.length).toBe(428);
        });

        it("chunk4 is randomized across runs (RFC 8017 7.1.2)", async () => {
            const a = await encryptValue(vector.publicKeySpkiBase64, 1, "same value");
            const b = await encryptValue(vector.publicKeySpkiBase64, 1, "same value");

            expect(splitE2EValue(a)[4]).not.toBe(splitE2EValue(b)[4]);
            // chunk6 is deterministic for the same plaintext? No: fresh IV changes it too.
            expect(a).not.toBe(b);
        });

        it("uses a fresh 12-byte CSPRNG IV that never equals the vector IV", async () => {
            const value = await encryptValue(vector.publicKeySpkiBase64, 1, vector.plaintext);
            const ivB64 = splitE2EValue(value)[5];

            expect(base64ToBytes(ivB64).length).toBe(12);
            expect(ivB64).not.toBe("AAECAwQFBgcICQoL");
        });
    });

    describe("round trip", () => {
        it("decrypts encryptValue output for multiple distinct values", async () => {
            const values = [
                "hello world",
                "+1234567890",
                "Привет мир 🌍",
                "a".repeat(1024),
                "The quick brown fox jumps over the lazy dog 0123456789",
            ];

            for (const plaintext of values) {
                const encrypted = await encryptValue(vector.publicKeySpkiBase64, 3, plaintext);
                expect(await decryptValue(vector.privateKeyPem, encrypted)).toBe(plaintext);
            }
        });

        it("encryptValue output rejects a 12-byte key: decrypted AES key is always 32 bytes", async () => {
            const encrypted = await encryptValue(vector.publicKeySpkiBase64, 1, "payload");
            const aesKey = await decryptChunk4(vector.privateKeyPem, splitE2EValue(encrypted)[4]);

            expect(aesKey.length).toBe(32);
        });
    });

    describe("base64 helpers", () => {
        it("round trips arbitrary byte buffers with padding", () => {
            for (const size of [0, 1, 2, 3, 4, 12, 32, 256]) {
                const bytes = new Uint8Array(size).map((_, i) => i & 0xff);
                const b64 = bytesToBase64(bytes);
                expect(b64).toMatch(/^(?:[A-Za-z0-9+/]+={0,2})?$/);
                expect(base64ToBytes(b64)).toEqual(bytes);
            }
        });
    });
});
