import { Device } from "../../domain";
import { Encryptor } from "../interface";
import { base64ToBytes, bytesToBase64 } from "../base64";

/**
 * Passphrase encryption for the SMS Gateway SDK (Web Crypto API).
 *
 * Wire format (https://docs.sms-gate.app/privacy/encryption/):
 *   $aes-256-cbc/pbkdf2-sha1$i={iterations}${base64(salt)}${base64(ciphertext)}
 *
 * Scheme:
 *  - PBKDF2-SHA1 derives a fresh 256-bit AES key per value from the passphrase,
 *    a random 16-byte salt, and the iteration count (default 75,000).
 *  - AES-256-CBC encrypts the payload with the salt as IV (salt MUST be exactly
 *    16 bytes: WebCrypto AesCbcParams iv must be 16 bytes).
 *  - WebCrypto applies PKCS#7 padding automatically on encrypt and validates
 *    and strips it on decrypt (NO manual padding).
 *
 * All base64 output is standard RFC 4648 with padding and NO line wrapping.
 *
 * The passphrase is supplied client-side only and is NEVER read from the
 * Device record (the device's DeviceSettings.passphrase is its own copy that
 * must match for decryption to succeed).
 *
 * Note: this encryptor is device-independent (`requiresDevice()` is false) -
 * the Client SKIPS device resolution for passphrase sends and passes
 * `device = undefined` (the device record is never read). DeviceIDRequired
 * (trim-empty deviceId) is still enforced by Client.send - the deviceId is
 * used verbatim for routing; DeviceNotFound can no longer occur in passphrase
 * mode (no listing fetch).
 */

export const PASS_PHRASE_FORMAT = "aes-256-cbc/pbkdf2-sha1";
export const PASS_PHRASE_PREFIX = `$${PASS_PHRASE_FORMAT}$`;
export const DEFAULT_ITERATIONS = 75_000;

/**
 * Passphrase-based encryptor: encrypts individual string values (message
 * body, phone numbers, DataMessage.data, TextMessage.text) with a
 * passphrase-derived AES-256-CBC key. Field orchestration, deviceId
 * provenance and `isEncrypted` are owned by the Client.
 *
 * Behavior:
 * - encrypts every value unconditionally (the Client derives `isEncrypted`
 *   from `isConfigured`, which is always true);
 * - the device argument is ignored entirely (deviceId provenance is
 *   Client-owned; the device record is never read for the passphrase);
 * - any value already starting with {@link PASS_PHRASE_PREFIX} passes through
 *   verbatim and is NEVER re-encrypted (mirrors client-go);
 * - input values are never mutated.
 */
export class PassphraseMessageEncryptor implements Encryptor {
    /**
     * Encodes bytes as standard padded base64 (NO line wrapping).
     */
    public static bytesToBase64(bytes: Uint8Array): string {
        return bytesToBase64(bytes);
    }

    /**
     * Decodes standard padded base64 into bytes.
     */
    public static base64ToBytes(base64: string): Uint8Array {
        return base64ToBytes(base64);
    }

    /**
     * Encrypts a single value with a fresh random 16-byte salt and returns the
     * full 5-chunk passphrase wire-format string.
     *
     * @param passphrase The shared passphrase (client-supplied).
     * @param iterations The PBKDF2 iteration count, embedded verbatim in `i=`.
     * @param plaintext The value to encrypt (message body, phone number, or
     * the base64 DataMessage.data string).
     */
    public static async encryptValue(
        passphrase: string,
        iterations: number,
        plaintext: string,
    ): Promise<string> {
        // Salt is EXACTLY 16 bytes: it doubles as the AES-CBC IV, which
        // WebCrypto requires to be 16 bytes (OperationError otherwise).
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const aesKey = await PassphraseMessageEncryptor.deriveAesKey(passphrase, salt, iterations);
        const ct = new Uint8Array(await crypto.subtle.encrypt(
            { name: "AES-CBC", iv: salt },
            aesKey,
            new TextEncoder().encode(plaintext),
        ));

        return `${PASS_PHRASE_PREFIX}i=${iterations}$`
            + `${PassphraseMessageEncryptor.bytesToBase64(salt)}$`
            + `${PassphraseMessageEncryptor.bytesToBase64(ct)}`;
    }

    /**
     * Derives the 256-bit AES-CBC key via PBKDF2-SHA1 (WebCrypto hash name is
     * "SHA-1").
     */
    private static async deriveAesKey(
        passphrase: string,
        salt: Uint8Array,
        iterations: number,
    ): Promise<CryptoKey> {
        const baseKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(passphrase),
            "PBKDF2",
            false,
            ["deriveKey"],
        );
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations, hash: "SHA-1" },
            baseKey,
            { name: "AES-CBC", length: 256 },
            false,
            ["encrypt"],
        );
    }

    private readonly passphrase: string;
    private readonly iterations: number;

    /**
     * @param passphrase The shared passphrase. Must not be an empty string
     * (fail-fast; siblings do not validate - documented deviation). The value
     * is used exactly as given: NOT trimmed.
     * @param iterations The PBKDF2 iteration count. Must be a positive
     * integer; defaults to {@link DEFAULT_ITERATIONS} (75,000).
     */
    constructor(passphrase: string, iterations: number = DEFAULT_ITERATIONS) {
        if (passphrase === "") {
            throw new Error("Passphrase must not be empty");
        }
        if (!Number.isInteger(iterations) || iterations < 1) {
            throw new Error(`Iterations must be a positive integer, got ${iterations}`);
        }
        this.passphrase = passphrase;
        this.iterations = iterations;
    }

    /**
     * Encrypts a single value with the passphrase-derived key.
     *
     * Any value already starting with {@link PASS_PHRASE_PREFIX} passes
     * through verbatim and is NEVER re-encrypted (double-encryption guard,
     * mirrors client-go encryption.go:24-29, 218-220). The device argument is
     * ignored entirely - the passphrase is client-supplied only.
     *
     * The input value is never mutated.
     */
    public async encrypt(value: string, _device?: Device): Promise<string> {
        if (value.startsWith(PASS_PHRASE_PREFIX)) {
            return value;
        }
        return PassphraseMessageEncryptor.encryptValue(this.passphrase, this.iterations, value);
    }

    /**
     * PURE capability check: passphrase mode is always READY
     * (device-independent; the Client calls this once per send).
     */
    public isConfigured(_device?: Device): boolean {
        return true;
    }

    /**
     * Declares whether the Client must resolve the Device from the listing.
     *
     * Always false: the passphrase is client-supplied only, so the Client
     * skips device resolution and passes `device = undefined`
     * (`isConfigured(undefined)` is meaningful and returns true).
     */
    public requiresDevice(): boolean {
        return false;
    }
}
