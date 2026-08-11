import { describe, expect, it } from "bun:test";

import { Device } from "../../domain";
import {
    DEFAULT_ITERATIONS,
    PASS_PHRASE_FORMAT,
    PASS_PHRASE_PREFIX,
    PassphraseMessageEncryptor,
} from "./passphrase";
import {
    decryptPassphraseValue,
    encryptPassphraseValue,
    splitPassphraseValue,
} from "../test-utils";

// Triple-verified fixed vector (client-py tests/test_encryption.py:11,
// OpenSSL + pycryptodome re-derivation): passphrase "passphrase", 75000
// iterations, salt a1b4935ba8adb50bd3b5d031a2740a23, plaintext "hello".
const FIXED_VECTOR = "$aes-256-cbc/pbkdf2-sha1$i=75000$obSTW6ittQvTtdAxonQKIw==$g3QFAC9CtBcPxoKlouqsyQ==";

const device: Device = {
    id: "dev-pass",
    name: "Passphrase Device",
    createdAt: "2020-01-01T00:00:00Z",
    lastSeen: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
};

describe("PassphraseMessageEncryptor constants", () => {
    it("exports the exact wire-format constants", () => {
        expect(PASS_PHRASE_FORMAT).toBe("aes-256-cbc/pbkdf2-sha1");
        expect(PASS_PHRASE_PREFIX).toBe("$aes-256-cbc/pbkdf2-sha1$");
        expect(DEFAULT_ITERATIONS).toBe(75_000);
    });
});

describe("fixed vector (byte-exact)", () => {
    it("encryptPassphraseValue produces the exact fixed vector at 75k iterations", async () => {
        const actual = await encryptPassphraseValue("passphrase", 75_000, "a1b4935ba8adb50bd3b5d031a2740a23", "hello");
        expect(actual).toBe(FIXED_VECTOR);
    });

    it("decryptPassphraseValue decrypts the fixed vector back to the plaintext", async () => {
        await expect(decryptPassphraseValue("passphrase", FIXED_VECTOR)).resolves.toBe("hello");
    });

    it("rejects the fixed vector with a wrong passphrase (OperationError via auto-unpad)", async () => {
        await expect(decryptPassphraseValue("wrong-passphrase", FIXED_VECTOR)).rejects.toMatchObject({
            name: "OperationError",
        });
    });
});

describe("round-trip via decryptPassphraseValue", () => {
    const cases: Array<[string, string]> = [
        ["unicode/multibyte", "Hello, 世界! Привет 🎉"],
        ["long multi-block", "0123456789abcdef0123456789abcdef0123456789abcdef"],
        ["empty string", ""],
    ];

    for (const [name, plaintext] of cases) {
        it(`round-trips ${name}`, async () => {
            const encrypted = await PassphraseMessageEncryptor.encryptValue("roundtrip", 1_000, plaintext);
            await expect(decryptPassphraseValue("roundtrip", encrypted)).resolves.toBe(plaintext);
        });
    }

    it("produces distinct ciphertexts for the same plaintext (fresh random salt)", async () => {
        const first = await PassphraseMessageEncryptor.encryptValue("unique", 1_000, "same plaintext");
        const second = await PassphraseMessageEncryptor.encryptValue("unique", 1_000, "same plaintext");
        expect(first).not.toBe(second);
    });
});

describe("wire structure", () => {
    it("emits exactly 5 chunks with algo, i= params, 16-byte salt and padded no-wrap base64", async () => {
        const encrypted = await PassphraseMessageEncryptor.encryptValue("structure", 1_000, "wire check");
        const chunks = splitPassphraseValue(encrypted);
        expect(chunks).toHaveLength(5);
        expect(chunks[0]).toBe("");
        expect(chunks[1]).toBe(PASS_PHRASE_FORMAT);
        expect(chunks[2]).toBe("i=1000");
        const salt = PassphraseMessageEncryptor.base64ToBytes(chunks[3]);
        expect(salt).toHaveLength(16);
        expect(chunks[3]).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        expect(chunks[4]).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
        expect(chunks[3]).not.toContain("\n");
        expect(chunks[4]).not.toContain("\n");
    });

    it("honors a custom iteration count embedded verbatim in i= and round-trips", async () => {
        const encrypted = await PassphraseMessageEncryptor.encryptValue("custom-iter", 1_000, "iterations");
        const chunks = splitPassphraseValue(encrypted);
        expect(chunks[2]).toBe("i=1000");
        await expect(decryptPassphraseValue("custom-iter", encrypted)).resolves.toBe("iterations");
    });
});

describe("PassphraseMessageEncryptor constructor validation", () => {
    it("throws on an empty passphrase", () => {
        expect(() => new PassphraseMessageEncryptor("")).toThrow("Passphrase must not be empty");
    });

    it("throws on invalid iteration counts (0, -1, 1.5, NaN)", () => {
        for (const iterations of [0, -1, 1.5, NaN]) {
            expect(() => new PassphraseMessageEncryptor("valid", iterations)).toThrow();
        }
    });

    it("accepts 1 and 1000 iterations", () => {
        expect(() => new PassphraseMessageEncryptor("valid", 1)).not.toThrow();
        expect(() => new PassphraseMessageEncryptor("valid", 1_000)).not.toThrow();
        expect(() => new PassphraseMessageEncryptor("valid")).not.toThrow();
    });
});

describe("encryptPassphraseValue salt validation", () => {
    it("throws when the pinned salt is not exactly 32 hex chars (16 bytes)", async () => {
        const bad = ["abc", "a1b4935ba8adb50bd3b5d031a2740a2", "a1b4935ba8adb50bd3b5d031a2740a231", "zzb4935ba8adb50bd3b5d031a2740a23"];
        for (const salt of bad) {
            await expect(encryptPassphraseValue("passphrase", 1_000, salt, "hello")).rejects.toMatchObject({
                message: expect.stringContaining("Salt must be exactly 32 hex chars"),
            });
        }
    });
});

describe("PassphraseMessageEncryptor.encrypt (value-level)", () => {
    it("encrypts a value into the 5-chunk wire format and round-trips", async () => {
        const encryptor = new PassphraseMessageEncryptor("instance", 1_000);

        const result = await encryptor.encrypt("secret body", device);

        expect(result).toContain(PASS_PHRASE_PREFIX);
        expect(result).not.toContain("secret body");
        await expect(decryptPassphraseValue("instance", result)).resolves.toBe("secret body");
    });

    it("produces distinct ciphertexts for the same plaintext via instance encrypt", async () => {
        const encryptor = new PassphraseMessageEncryptor("unique", 1_000);

        const first = await encryptor.encrypt("same plaintext");
        const second = await encryptor.encrypt("same plaintext");

        expect(first).not.toBe(second);
    });

    it("ignores the device entirely (identical behavior with and without a device)", async () => {
        const encryptor = new PassphraseMessageEncryptor("device-independent", 1_000);

        const withDevice = await encryptor.encrypt("secret", device);
        const withoutDevice = await encryptor.encrypt("secret");

        expect(withDevice).toContain(PASS_PHRASE_PREFIX);
        expect(withoutDevice).toContain(PASS_PHRASE_PREFIX);
        await expect(decryptPassphraseValue("device-independent", withDevice)).resolves.toBe("secret");
        await expect(decryptPassphraseValue("device-independent", withoutDevice)).resolves.toBe("secret");
    });

    it("passes through pre-encrypted prefix-matching values verbatim (no double encryption)", async () => {
        const encryptor = new PassphraseMessageEncryptor("guard", 1_000);
        const preEncrypted = await PassphraseMessageEncryptor.encryptValue("guard", 1_000, "already encrypted");

        await expect(encryptor.encrypt(preEncrypted, device)).resolves.toBe(preEncrypted);
    });

    it("isConfigured returns true always (with and without a device)", () => {
        const encryptor = new PassphraseMessageEncryptor("ready", 1_000);

        expect(encryptor.isConfigured()).toBe(true);
        expect(encryptor.isConfigured(device)).toBe(true);
    });
});

describe("plaintext and passphrase leakage (value-level)", () => {
    it("leaks no plaintext substring and no passphrase in encrypted output", async () => {
        const encryptor = new PassphraseMessageEncryptor("top-secret-passphrase", 1_000);
        const fields = [
            "hello world confidential",
            "another confidential line",
            "+1234567890",
        ];

        const outputs: string[] = [];
        for (const field of fields) {
            outputs.push(await encryptor.encrypt(field, device));
        }

        const serialized = JSON.stringify(outputs);
        expect(serialized).not.toContain("hello world");
        expect(serialized).not.toContain("confidential");
        expect(serialized).not.toContain("+1234567890");
        expect(serialized).not.toContain("top-secret-passphrase");
    });
});
