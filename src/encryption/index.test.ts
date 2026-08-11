import { describe, expect, it } from "bun:test";

import {
    DEFAULT_ITERATIONS,
    E2E_FORMAT,
    E2E_PREFIX,
    E2E_VERSION,
    EncryptionError,
    E2EMessageEncryptor,
    PASS_PHRASE_FORMAT,
    PASS_PHRASE_PREFIX,
    PassphraseMessageEncryptor,
} from "./index";
import type { Encryptor } from "./index";
import * as root from "../index";
import * as barrel from "./index";

const exportedSymbols = [
    ["E2E_FORMAT", E2E_FORMAT],
    ["E2E_VERSION", E2E_VERSION],
    ["E2E_PREFIX", E2E_PREFIX],
    ["EncryptionError", EncryptionError],
    ["E2EMessageEncryptor", E2EMessageEncryptor],
    ["PASS_PHRASE_FORMAT", PASS_PHRASE_FORMAT],
    ["PASS_PHRASE_PREFIX", PASS_PHRASE_PREFIX],
    ["DEFAULT_ITERATIONS", DEFAULT_ITERATIONS],
    ["PassphraseMessageEncryptor", PassphraseMessageEncryptor],
] as const;

// Test-only helpers + removed classes that must never leak into the
// production surface.
const removedSymbols = [
    "decryptValue",
    "decryptChunk4",
    "decryptChunk6",
    "encryptAESChunk",
    "splitE2EValue",
    "bytesToHex",
    "hexToBytes",
    "splitPassphraseValue",
    "decryptPassphraseValue",
    "encryptPassphraseValue",
    "PlainTextMessageEncryptor",
] as const;

describe("encryption barrel exports", () => {
    it("exports all flow symbols from ./encryption", () => {
        for (const [, value] of exportedSymbols) {
            expect(value).toBeDefined();
        }
    });

    it("exposes the Encryptor interface from ./encryption (type-level)", () => {
        const encryptor: Encryptor = new E2EMessageEncryptor();
        expect(encryptor).toBeDefined();
    });

    it("does NOT export the removed test helpers or PlainTextMessageEncryptor from ./encryption", () => {
        for (const name of removedSymbols) {
            expect((barrel as unknown as Record<string, unknown>)[name]).toBeUndefined();
        }
    });

    it("exports all flow symbols from the package root ./index", () => {
        for (const [name] of exportedSymbols) {
            expect((root as unknown as Record<string, unknown>)[name]).toBeDefined();
        }
    });

    it("exposes the Encryptor interface from the package root ./index (type-level)", () => {
        const encryptor: import("../index").Encryptor = new E2EMessageEncryptor();
        expect(encryptor).toBeDefined();
    });

    it("does NOT export the removed test helpers or PlainTextMessageEncryptor from the package root ./index", () => {
        for (const name of removedSymbols) {
            expect((root as unknown as Record<string, unknown>)[name]).toBeUndefined();
        }
    });

    it("satisfies the interface contract at runtime", () => {
        const impls: Encryptor[] = [new E2EMessageEncryptor(), new PassphraseMessageEncryptor("x")];
        expect(impls).toHaveLength(2);
    });

    it("exposes crypto primitives as E2EMessageEncryptor static members", () => {
        expect(typeof E2EMessageEncryptor.encryptValue).toBe("function");
        expect(typeof E2EMessageEncryptor.bytesToBase64).toBe("function");
        expect(typeof E2EMessageEncryptor.base64ToBytes).toBe("function");
    });

    it("does NOT leak any symbols beyond the declared flow surface from ./encryption (barrel parity)", () => {
        const declared = new Set<string>(exportedSymbols.map(([name]) => name));
        for (const key of Object.keys(barrel)) {
            expect(declared.has(key)).toBe(true);
        }
        expect(Object.keys(barrel)).toHaveLength(exportedSymbols.length);
    });

    it("Encryptor interface includes requiresDevice() (type-level + runtime shape)", () => {
        const gate: Encryptor["requiresDevice"] = () => false;
        expect(typeof gate).toBe("function");
        expect(typeof new E2EMessageEncryptor().requiresDevice).toBe("function");
        expect(typeof new PassphraseMessageEncryptor("x").requiresDevice).toBe("function");
    });
});
