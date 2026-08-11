/**
 * Test-only E2E verification helpers (decrypt chain, wire-format validation,
 * hex codecs). NOT exported from any barrel (src/encryption/index.ts,
 * src/encryption/implementations/index.ts, src/index.ts) and therefore never
 * bundled into the published package. Imported directly by test files:
 * src/encryption.test.ts, src/client.test.ts,
 * src/encryption/implementations/e2e.test.ts.
 */
import { EncryptionError } from "./errors";
import {
    E2E_FORMAT,
    E2E_VERSION,
    E2EMessageEncryptor,
} from "./implementations/public-key";
import { PASS_PHRASE_FORMAT, PassphraseMessageEncryptor } from "./implementations/passphrase";

/**
 * Encodes bytes as a lowercase hex string (test/verification helper).
 */
export function bytesToHex(bytes: Uint8Array): string {
    let hex = "";
    for (const byte of bytes) {
        hex += byte.toString(16).padStart(2, "0");
    }
    return hex;
}

/**
 * Decodes a lowercase hex string into bytes (test/verification helper).
 */
export function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function pemToDer(pem: string): Uint8Array {
    const body = pem
        .replace(/-----BEGIN [A-Z ]+-----/, "")
        .replace(/-----END [A-Z ]+-----/, "")
        .replace(/\s/g, "");
    return E2EMessageEncryptor.base64ToBytes(body);
}

/**
 * Constant-time string equality used for wire-format detection (spec section
 * 10). Lengths are compared first; both mismatched lengths and mismatched
 * content yield false without data-dependent branching over the compared
 * bytes. The format strings are public constants, so this is spec-compliance
 * only. Works in Node and browsers (no node:crypto dependency).
 */
function constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

/**
 * Splits and validates an E2E value, returning its exactly-7 chunks.
 *
 * @throws {EncryptionError} when the value is not a valid 7-chunk E2E string.
 */
export function splitE2EValue(value: string): string[] {
    const chunks = value.split("$");
    if (
        chunks.length !== 7
        || !constantTimeEquals(chunks[0], "")
        || !constantTimeEquals(chunks[1], E2E_FORMAT)
    ) {
        throw new EncryptionError(`Invalid E2E value format: ${value.length} chars`);
    }
    if (!constantTimeEquals(chunks[2], `v=${E2E_VERSION}`)) {
        throw new EncryptionError(`Unsupported E2E version: ${chunks[2]}`);
    }
    return chunks;
}

async function rsaDecrypt(privateKeyPem: string, data: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        "pkcs8",
        pemToDer(privateKeyPem),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"],
    );
    return new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, key, data));
}

/**
 * RSA-OAEP-decrypts chunk 4 (the wrapped AES key) with a PKCS#8 PEM private key.
 * Test/verification helper (SDK clients never hold the private key).
 */
export async function decryptChunk4(privateKeyPem: string, chunk4Base64: string): Promise<Uint8Array> {
    return rsaDecrypt(privateKeyPem, E2EMessageEncryptor.base64ToBytes(chunk4Base64));
}

/**
 * AES-GCM-decrypts chunk 6 (ciphertext || tag) with a raw AES key and IV.
 * Test/verification helper.
 */
export async function decryptChunk6(aesKey: Uint8Array, iv: Uint8Array, ctTagBase64: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        E2EMessageEncryptor.base64ToBytes(ctTagBase64),
    );
    return new TextDecoder().decode(decrypted);
}

/**
 * AES-GCM-encrypts a plaintext with a fixed key and IV and returns base64
 * (ciphertext || tag). Test/verification helper for byte-comparable chunk 6.
 */
export async function encryptAESChunk(aesKey: Uint8Array, iv: Uint8Array, plaintext: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["encrypt"]);
    const ctTag = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        new TextEncoder().encode(plaintext),
    ));
    return E2EMessageEncryptor.bytesToBase64(ctTag);
}

/**
 * Decrypts a full 7-chunk E2E value with a PKCS#8 PEM private key.
 * Test/verification helper.
 */
export async function decryptValue(privateKeyPem: string, value: string): Promise<string> {
    const chunks = splitE2EValue(value);
    const aesKey = await rsaDecrypt(privateKeyPem, E2EMessageEncryptor.base64ToBytes(chunks[4]));
    if (aesKey.length !== 32) {
        throw new EncryptionError(`Decrypted AES key is ${aesKey.length} bytes, expected 32`);
    }
    return decryptChunk6(aesKey, E2EMessageEncryptor.base64ToBytes(chunks[5]), chunks[6]);
}

/**
 * Splits and validates a passphrase value, returning its exactly-5 chunks
 * (empty first chunk, algo, params, salt, ciphertext).
 *
 * Plain string checks only (the prefix is a public constant - no
 * constant-time ceremony, no security claim).
 *
 * @throws {Error} when the value is not a valid 5-chunk passphrase string.
 */
export function splitPassphraseValue(value: string): string[] {
    const chunks = value.split("$");
    if (chunks.length !== 5 || chunks[0] !== "" || chunks[1] !== PASS_PHRASE_FORMAT) {
        throw new Error(`Invalid passphrase value format: ${value.length} chars`);
    }
    return chunks;
}

/**
 * Parses the params chunk (comma-separated k=v pairs, currently only `i=`)
 * and returns the iteration count.
 *
 * @throws {Error} when `i` is missing, malformed, or not a positive integer.
 */
function parsePassphraseIterations(params: string): number {
    const map = new Map<string, string>();
    for (const pair of params.split(",")) {
        const eq = pair.indexOf("=");
        if (eq === -1) {
            throw new Error(`Invalid passphrase parameter: ${pair}`);
        }
        map.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
    const raw = map.get("i");
    if (raw === undefined) {
        throw new Error("Missing iteration count");
    }
    const iterations = Number(raw);
    if (!Number.isInteger(iterations) || iterations < 1) {
        throw new Error(`Invalid iteration count: ${raw}`);
    }
    return iterations;
}

/**
 * Decrypts a full 5-chunk passphrase value with the shared passphrase.
 *
 * Relies on subtle.decrypt AES-CBC auto-unpad (PKCS#7): a wrong passphrase
 * yields invalid padding and the resulting OperationError propagates.
 * Test/verification helper (the SDK never decrypts - the device does).
 */
export async function decryptPassphraseValue(passphrase: string, value: string): Promise<string> {
    const chunks = splitPassphraseValue(value);
    const iterations = parsePassphraseIterations(chunks[2]);

    const salt = PassphraseMessageEncryptor.base64ToBytes(chunks[3]);
    if (salt.length !== 16) {
        throw new Error(`Passphrase salt is ${salt.length} bytes, expected 16`);
    }

    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-1" },
        baseKey,
        { name: "AES-CBC", length: 256 },
        false,
        ["decrypt"],
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: salt },
        aesKey,
        PassphraseMessageEncryptor.base64ToBytes(chunks[4]),
    );
    return new TextDecoder().decode(decrypted);
}

/**
 * Passphrase-encrypts a plaintext with a PINNED salt (given as lowercase hex)
 * and returns the full 5-chunk wire string. Test/verification helper for the
 * byte-exact fixed-vector check (production uses a fresh random salt).
 *
 * @throws {Error} when `saltHex` is not exactly 32 hex chars (16 bytes).
 */
export async function encryptPassphraseValue(
    passphrase: string,
    iterations: number,
    saltHex: string,
    plaintext: string,
): Promise<string> {
    if (saltHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(saltHex)) {
        throw new Error(`Salt must be exactly 32 hex chars (16 bytes), got ${saltHex.length}`);
    }
    const salt = hexToBytes(saltHex);

    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    const aesKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-1" },
        baseKey,
        { name: "AES-CBC", length: 256 },
        false,
        ["encrypt"],
    );
    const ct = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-CBC", iv: salt },
        aesKey,
        new TextEncoder().encode(plaintext),
    ));

    return `$${PASS_PHRASE_FORMAT}$i=${iterations}$`
        + `${PassphraseMessageEncryptor.bytesToBase64(salt)}$`
        + `${PassphraseMessageEncryptor.bytesToBase64(ct)}`;
}
