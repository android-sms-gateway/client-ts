/**
 * E2E encryption for the SMS Gateway SDK (Web Crypto API).
 *
 * Wire format (see docs/plan/e2e-encryption/e2e-crypto-spec.md):
 *   $rsa-oaep-aes-256-gcm$v=1$k={keyVersion}${base64(encrypted_aes_key)}${base64(iv)}${base64(ciphertext || 16-byte_tag)}
 *
 * Hybrid scheme:
 *  - RSA-OAEP (SHA-256 hash, MGF1-SHA-256, empty label) wraps a fresh 32-byte
 *    AES-256 key per value.
 *  - AES-256-GCM (128-bit tag, 12-byte IV, empty AAD) encrypts the payload.
 *  - WebCrypto appends the 16-byte GCM tag to the ciphertext automatically, so
 *    the last chunk is base64(ciphertext || tag).
 *
 * All base64 output is standard RFC 4648 with padding and NO line wrapping.
 */

export const E2E_FORMAT = "rsa-oaep-aes-256-gcm";
export const E2E_VERSION = "1";
export const E2E_PREFIX = `$${E2E_FORMAT}$`;

/**
 * Typed error codes for E2E message sending.
 */
export enum E2EErrorCode {
    /**
     * A deviceId is required to resolve the target device's public key.
     */
    DeviceIDRequired = "DEVICE_ID_REQUIRED",
    /**
     * The requested device is not present in the device listing.
     */
    DeviceNotFound = "DEVICE_NOT_FOUND",
    /**
     * The resolved device has no publicKey or no keyVersion (no plaintext fallback).
     */
    E2ENotConfigured = "E2E_NOT_CONFIGURED",
    /**
     * The encrypted value does not match the E2E wire format.
     */
    InvalidFormat = "INVALID_FORMAT",
}

/**
 * Typed error thrown for all E2E failures.
 */
export class E2EError extends Error {
    readonly code: E2EErrorCode;

    constructor(code: E2EErrorCode, message: string) {
        super(message);
        this.name = "E2EError";
        this.code = code;
    }
}

/**
 * Encodes bytes as standard padded base64 (NO line wrapping).
 */
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Decodes standard padded base64 into bytes.
 */
export function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

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
    return base64ToBytes(body);
}

/**
 * Splits and validates an E2E value, returning its exactly-7 chunks.
 *
 * @throws {E2EError} with code {@link E2EErrorCode.InvalidFormat} when the value
 * is not a valid 7-chunk E2E string.
 */
export function splitE2EValue(value: string): string[] {
    const chunks = value.split("$");
    if (chunks.length !== 7 || chunks[0] !== "" || chunks[1] !== E2E_FORMAT) {
        throw new E2EError(E2EErrorCode.InvalidFormat, `Invalid E2E value format: ${value.length} chars`);
    }
    if (chunks[2] !== `v=${E2E_VERSION}`) {
        throw new E2EError(E2EErrorCode.InvalidFormat, `Unsupported E2E version: ${chunks[2]}`);
    }
    return chunks;
}

async function rsaEncrypt(publicKeySpkiBase64: string, data: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        "spki",
        base64ToBytes(publicKeySpkiBase64),
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"],
    );
    return new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, data));
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

async function aesGcmEncrypt(aesKey: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["encrypt"]);
    return new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, tagLength: 128 },
        key,
        plaintext,
    ));
}

/**
 * Encrypts a single value with the E2E hybrid scheme and returns the full
 * 7-chunk wire-format string.
 *
 * @param publicKeySpkiBase64 Base64 (NO_WRAP) X.509 SPKI DER of the target
 * device's RSA public key, as returned by the device listing.
 * @param keyVersion The target device's keyVersion from the listing; embedded
 * verbatim in chunk 3 (`k={keyVersion}`).
 * @param plaintext The value to encrypt (message body, phone number, or the
 * base64 DataMessage.data string).
 */
export async function encryptValue(
    publicKeySpkiBase64: string,
    keyVersion: number,
    plaintext: string,
): Promise<string> {
    // AES-256 key is 32 bytes; the IV is a separate fresh 12-byte value.
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedAesKey = await rsaEncrypt(publicKeySpkiBase64, aesKey);
    const ctTag = await aesGcmEncrypt(aesKey, iv, new TextEncoder().encode(plaintext));

    return `${E2E_PREFIX}v=${E2E_VERSION}$k=${keyVersion}$`
        + `${bytesToBase64(encryptedAesKey)}$`
        + `${bytesToBase64(iv)}$`
        + `${bytesToBase64(ctTag)}`;
}

/**
 * RSA-OAEP-decrypts chunk 4 (the wrapped AES key) with a PKCS#8 PEM private key.
 * Test/verification helper (SDK clients never hold the private key).
 */
export async function decryptChunk4(privateKeyPem: string, chunk4Base64: string): Promise<Uint8Array> {
    return rsaDecrypt(privateKeyPem, base64ToBytes(chunk4Base64));
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
        base64ToBytes(ctTagBase64),
    );
    return new TextDecoder().decode(decrypted);
}

/**
 * AES-GCM-encrypts a plaintext with a fixed key and IV and returns base64
 * (ciphertext || tag). Test/verification helper for byte-comparable chunk 6.
 */
export async function encryptAESChunk(aesKey: Uint8Array, iv: Uint8Array, plaintext: string): Promise<string> {
    const ctTag = await aesGcmEncrypt(aesKey, iv, new TextEncoder().encode(plaintext));
    return bytesToBase64(ctTag);
}

/**
 * Decrypts a full 7-chunk E2E value with a PKCS#8 PEM private key.
 * Test/verification helper.
 */
export async function decryptValue(privateKeyPem: string, value: string): Promise<string> {
    const chunks = splitE2EValue(value);
    const aesKey = await rsaDecrypt(privateKeyPem, base64ToBytes(chunks[4]));
    if (aesKey.length !== 32) {
        throw new E2EError(E2EErrorCode.InvalidFormat, `Decrypted AES key is ${aesKey.length} bytes, expected 32`);
    }
    return decryptChunk6(aesKey, base64ToBytes(chunks[5]), chunks[6]);
}
