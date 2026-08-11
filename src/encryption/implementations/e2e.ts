import { Device } from "../../domain";
import { EncryptionError } from "../errors";
import { Encryptor } from "../interface";

/**
 * E2E encryption for the SMSGate SDK (Web Crypto API).
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
 * Default E2E encryptor: encrypts individual string values (message body,
 * phone numbers, DataMessage.data, TextMessage.text) with the device's RSA
 * public key using the hybrid E2E scheme. Field orchestration, deviceId
 * provenance and `isEncrypted` are owned by the Client.
 *
 * Two modes:
 * - LISTING mode (no ctor args, the Client default): the device is resolved
 *   from the listing by the Client and passed per call. Behavior by device
 *   state:
 *   - device with publicKey + keyVersion: encrypts the value;
 *   - device without publicKey (or no device): returns the value unchanged
 *     (plaintext pass-through, never throws);
 *   - device with publicKey but no keyVersion: throws
 *     {@link EncryptionError} embedding the device id (E2ENotConfigured).
 *   `requiresDevice()` returns true.
 * - MATERIAL mode (ctor publicKey + keyVersion): the encryptor carries the
 *   key material itself - the Client skips device resolution and passes
 *   `device = undefined` (`requiresDevice()` returns false).
 *   `isConfigured(any)` returns true (configured by construction) and
 *   `encrypt(value, device?)` always encrypts with the ctor material,
 *   ignoring the device argument.
 *
 * Input values are never mutated.
 */
export class E2EMessageEncryptor implements Encryptor {
    private readonly publicKey?: string;
    private readonly keyVersion?: number;

    /**
     * @param publicKey Base64 (NO_WRAP) X.509 SPKI DER of the target device's
     * RSA public key, as returned by the device listing. Either BOTH
     * publicKey and keyVersion are provided (material mode) or NEITHER
     * (listing mode); providing exactly one throws a plain Error (fail-fast,
     * mirrors the server's ErrInconsistentE2E).
     * @param keyVersion The device's keyVersion, embedded verbatim in the
     * wire format (`k={keyVersion}`). Must be a positive integer (0 would be
     * indistinguishable from a missing keyVersion).
     */
    constructor(publicKey?: string, keyVersion?: number) {
        const hasKey = publicKey !== undefined;
        const hasVersion = keyVersion !== undefined;
        if (hasKey !== hasVersion) {
            throw new Error(
                `E2EMessageEncryptor requires BOTH publicKey and keyVersion`
                + ` (got ${hasKey ? "publicKey" : "keyVersion"} only)`,
            );
        }
        if (hasKey) {
            if (typeof publicKey !== "string" || publicKey === "") {
                throw new Error("publicKey must be a non-empty string");
            }
            if (!Number.isInteger(keyVersion) || (keyVersion as number) < 1) {
                throw new Error(`keyVersion must be a positive integer, got ${keyVersion}`);
            }
            this.publicKey = publicKey;
            this.keyVersion = keyVersion;
        }
    }

    /**
     * Declares whether the Client must resolve the Device from the listing.
     *
     * - false in material mode (ctor publicKey + keyVersion): the encryptor
     *   has all material itself - the Client skips resolution and passes
     *   `device = undefined`;
     * - true in listing mode (no ctor args): the Client resolves the device
     *   and passes it per call.
     */
    public requiresDevice(): boolean {
        return this.publicKey === undefined;
    }
    /**
     * Encodes bytes as standard padded base64 (NO line wrapping).
     */
    public static bytesToBase64(bytes: Uint8Array): string {
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Decodes standard padded base64 into bytes.
     */
    public static base64ToBytes(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
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
    public static async encryptValue(
        publicKeySpkiBase64: string,
        keyVersion: number,
        plaintext: string,
    ): Promise<string> {
        // AES-256 key is 32 bytes; the IV is a separate fresh 12-byte value.
        const aesKey = crypto.getRandomValues(new Uint8Array(32));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encryptedAesKey = await E2EMessageEncryptor.rsaEncrypt(publicKeySpkiBase64, aesKey);
        const ctTag = await E2EMessageEncryptor.aesGcmEncrypt(aesKey, iv, new TextEncoder().encode(plaintext));

        return `${E2E_PREFIX}v=${E2E_VERSION}$k=${keyVersion}$`
            + `${E2EMessageEncryptor.bytesToBase64(encryptedAesKey)}$`
            + `${E2EMessageEncryptor.bytesToBase64(iv)}$`
            + `${E2EMessageEncryptor.bytesToBase64(ctTag)}`;
    }

    /**
     * RSA-OAEP-encrypts a raw key with an SPKI public key.
     */
    private static async rsaEncrypt(publicKeySpkiBase64: string, data: Uint8Array): Promise<Uint8Array> {
        const key = await crypto.subtle.importKey(
            "spki",
            E2EMessageEncryptor.base64ToBytes(publicKeySpkiBase64),
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["encrypt"],
        );
        return new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, data));
    }

    /**
     * AES-GCM-encrypts a plaintext with a raw AES key and IV, appending the
     * 128-bit tag to the ciphertext (WebCrypto behavior).
     */
    private static async aesGcmEncrypt(aesKey: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
        const key = await crypto.subtle.importKey("raw", aesKey, { name: "AES-GCM" }, false, ["encrypt"]);
        return new Uint8Array(await crypto.subtle.encrypt(
            { name: "AES-GCM", iv, tagLength: 128 },
            key,
            plaintext,
        ));
    }

    /**
     * Encrypts a single value with the device's E2E key material.
     *
     * - material mode: always encrypts with the ctor publicKey/keyVersion,
     *   ignoring the `device` argument entirely;
     * - listing mode: device undefined or no publicKey: value returned
     *   unchanged (pass-through, never throws); publicKey without keyVersion:
     *   throws {@link EncryptionError} embedding the device id
     *   (E2ENotConfigured, listing-mode only); keyed: delegates to the
     *   public static {@link encryptValue}.
     *
     * The input value is never mutated.
     */
    public async encrypt(value: string, device?: Device): Promise<string> {
        if (this.publicKey !== undefined && this.keyVersion !== undefined) {
            return E2EMessageEncryptor.encryptValue(this.publicKey, this.keyVersion, value);
        }
        if (!device || !device.publicKey) {
            return value;
        }
        if (!device.keyVersion) {
            throw new EncryptionError(
                `Device "${device.id}" has a public key but no keyVersion configured`,
            );
        }
        return E2EMessageEncryptor.encryptValue(device.publicKey, device.keyVersion, value);
    }

    /**
     * PURE capability check (the Client calls it once per send).
     *
     * - material mode: always true (configured by construction, never
     *   throws - E2ENotConfigured cannot occur);
     * - listing mode: device undefined or no publicKey: false
     *   (unconfigured); publicKey without keyVersion: throws
     *   {@link EncryptionError}; keyed: true (READY).
     */
    public isConfigured(device?: Device): boolean {
        if (this.publicKey !== undefined) {
            return true;
        }
        if (!device || !device.publicKey) {
            return false;
        }
        if (!device.keyVersion) {
            throw new EncryptionError(
                `Device "${device.id}" has a public key but no keyVersion configured`,
            );
        }
        return true;
    }
}
