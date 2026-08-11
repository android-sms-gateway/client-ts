import { Device } from "../domain";

/**
 * Value-level encryption strategy for outbound message content.
 *
 * The interface is intentionally Message-free: implementations encrypt single
 * string values and know nothing about Message fields. Field orchestration
 * (which fields to encrypt, deviceId provenance, isEncrypted) is owned by the
 * Client: it invokes {@link isConfigured} exactly once per send and then calls
 * {@link encrypt} once per encryptable field when configured.
 *
 * Input values are never mutated; `encrypt` returns either the transformed
 * value or the input unchanged (pass-through).
 */
export interface Encryptor {
    /**
     * Encrypts a single value for the target device.
     *
     * MUST NOT throw when `isConfigured(device)` is false - the value is
     * returned unchanged (pass-through). MAY throw a typed {@link EncryptionError}
     * (E2ENotConfigured) when direct-invoked against a misconfigured device
     * state (e.g. a publicKey without a keyVersion) - listing mode only; in
     * material mode the encryptor is configured by construction and
     * `encrypt(value, undefined)` always works.
     *
     * The input `value` is never mutated; `device` is never mutated.
     *
     * @param value The plaintext value to encrypt (message body, phone
     * number, or DataMessage.data).
     * @param device The resolved target device, or undefined when none
     * applies (always undefined when {@link requiresDevice} is false).
     * @returns The encrypted value, or the input unchanged when encryption
     * cannot apply.
     */
    encrypt(value: string, device?: Device): Promise<string>;

    /**
     * Reports whether this encryptor is READY to encrypt for the device.
     *
     * PURE: no side effects and stateless implementations, so it is safe to
     * call exactly once per send (the Client derives `isEncrypted` from this
     * single call). MAY throw for malformed configuration (E2E listing mode:
     * publicKey without keyVersion -> E2ENotConfigured). Returns false when
     * unconfigured (E2E listing mode: keyless/undefined device); passphrase
     * returns true always; E2E material mode returns true always (configured
     * by construction - E2ENotConfigured cannot occur).
     *
     * NOTE: "ready" does not guarantee ciphertext - values already in the
     * target wire format pass through verbatim under the passphrase prefix
     * guard.
     *
     * @param device The resolved target device, or undefined when none
     * applies (always undefined when {@link requiresDevice} is false; when
     * requiresDevice() is false, calling with `undefined` MUST be
     * meaningful).
     * @returns true when encryption is possible for this device state.
     */
    isConfigured(device?: Device): boolean;

    /**
     * Declares whether the Client MUST resolve the target Device from the
     * device listing and pass it to {@link encrypt} / {@link isConfigured}.
     *
     * PURE: no arguments, no side effects, sync - safe to call exactly once
     * per send.
     *
     * - true: the Client resolves the Device from the listing (DeviceNotFound
     *   applies) and passes it to `isConfigured` / `encrypt`.
     * - false: the encryptor has all key material itself or needs none - the
     *   Client SKIPS device resolution and passes `device = undefined`. When
     *   false, `isConfigured(undefined)` MUST be meaningful (E2E material
     *   mode -> true when material is present; passphrase -> true).
     *
     * @returns true when the Client must resolve and pass the Device record.
     */
    requiresDevice(): boolean;
}
