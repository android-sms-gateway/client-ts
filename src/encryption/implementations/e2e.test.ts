import { describe, expect, it } from "bun:test";

import vector from "../../../test-vectors/e2e-vector-v1.json";

import { Device } from "../../domain";
import { E2EMessageEncryptor } from "./e2e";
import { decryptValue } from "../test-utils";

const deviceWithKey: Device = {
    id: "dev-e2e",
    name: "E2E Device",
    createdAt: "2020-01-01T00:00:00Z",
    lastSeen: "2020-01-01T00:00:00Z",
    updatedAt: "2020-01-01T00:00:00Z",
    publicKey: vector.publicKeySpkiBase64,
    keyVersion: vector.keyVersion,
};

describe("E2EMessageEncryptor.encrypt (value-level)", () => {
    const encryptor = new E2EMessageEncryptor();

    it("encrypts a value with a keyed device into the $rsa wire format and decrypts back", async () => {
        const result = await encryptor.encrypt("secret body", deviceWithKey);

        expect(result).toMatch(/^\$rsa-oaep-aes-256-gcm\$/);
        expect(result).not.toContain("secret body");
        expect(await decryptValue(vector.privateKeyPem, result)).toBe("secret body");
    });

    it("passes the value through unchanged when the device has no publicKey (null)", async () => {
        const device: Device = { ...deviceWithKey, publicKey: null, keyVersion: null };

        await expect(encryptor.encrypt("secret", device)).resolves.toBe("secret");
    });

    it("passes the value through unchanged when the device has no publicKey (undefined)", async () => {
        const device: Device = { ...deviceWithKey, publicKey: undefined, keyVersion: undefined };

        await expect(encryptor.encrypt("secret", device)).resolves.toBe("secret");
    });

    it("passes the value through unchanged when device is undefined", async () => {
        await expect(encryptor.encrypt("secret")).resolves.toBe("secret");
    });

    it("throws E2ENotConfigured embedding device.id when publicKey is present but keyVersion is missing", async () => {
        for (const keyVersion of [null, undefined]) {
            const device: Device = { ...deviceWithKey, keyVersion };
            await expect(encryptor.encrypt("secret", device)).rejects.toMatchObject({
                message: `Device "dev-e2e" has a public key but no keyVersion configured`,
            });
        }
    });

    it("does not mutate the input value", async () => {
        const value = "secret body";

        const result = await encryptor.encrypt(value, deviceWithKey);

        expect(result).not.toBe(value);
        expect(value).toBe("secret body");
    });
});

describe("E2EMessageEncryptor.isConfigured", () => {
    const encryptor = new E2EMessageEncryptor();

    it("returns false for an undefined device", () => {
        expect(encryptor.isConfigured()).toBe(false);
    });

    it("returns false when the device has no publicKey (null and undefined)", () => {
        expect(encryptor.isConfigured({ ...deviceWithKey, publicKey: null, keyVersion: null })).toBe(false);
        expect(encryptor.isConfigured({ ...deviceWithKey, publicKey: undefined, keyVersion: undefined })).toBe(false);
    });

    it("throws E2ENotConfigured when the device has a publicKey but no keyVersion", () => {
        for (const keyVersion of [null, undefined]) {
            expect(() => encryptor.isConfigured({ ...deviceWithKey, keyVersion })).toThrow(
                `Device "dev-e2e" has a public key but no keyVersion configured`,
            );
        }
    });

    it("returns true for a keyed device", () => {
        expect(encryptor.isConfigured(deviceWithKey)).toBe(true);
    });
});

describe("E2EMessageEncryptor statics", () => {
    it("keeps encryptValue / bytesToBase64 / base64ToBytes public and working", async () => {
        const value = await E2EMessageEncryptor.encryptValue(
            vector.publicKeySpkiBase64,
            vector.keyVersion,
            "static check",
        );
        expect(value).toMatch(/^\$rsa-oaep-aes-256-gcm\$/);
        expect(await decryptValue(vector.privateKeyPem, value)).toBe("static check");

        const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
        expect(E2EMessageEncryptor.base64ToBytes(E2EMessageEncryptor.bytesToBase64(bytes))).toEqual(bytes);
    });
});

describe("E2EMessageEncryptor key-material ctor (material mode)", () => {
    it("encrypts a value from ctor material into the $rsa wire format without any device, keyVersion embedded verbatim", async () => {
        const encryptor = new E2EMessageEncryptor(vector.publicKeySpkiBase64, vector.keyVersion);

        const result = await encryptor.encrypt("secret body");

        expect(result).toMatch(/^\$rsa-oaep-aes-256-gcm\$/);
        expect(result).toContain(`k=${vector.keyVersion}$`);
        expect(result).not.toContain("secret body");
        expect(await decryptValue(vector.privateKeyPem, result)).toBe("secret body");
    });

    it("ignores the device argument in material mode (encrypt(value) and encrypt(value, device) both encrypt)", async () => {
        const encryptor = new E2EMessageEncryptor(vector.publicKeySpkiBase64, vector.keyVersion);

        const withDevice = await encryptor.encrypt("secret body", deviceWithKey);
        const withoutDevice = await encryptor.encrypt("secret body");

        expect(withDevice).toMatch(/^\$rsa-oaep-aes-256-gcm\$/);
        expect(withoutDevice).toMatch(/^\$rsa-oaep-aes-256-gcm\$/);
        expect(await decryptValue(vector.privateKeyPem, withDevice)).toBe("secret body");
        expect(await decryptValue(vector.privateKeyPem, withoutDevice)).toBe("secret body");
    });

    it("requiresDevice() returns false in material mode and true in listing mode", () => {
        expect(new E2EMessageEncryptor(vector.publicKeySpkiBase64, vector.keyVersion).requiresDevice()).toBe(false);
        expect(new E2EMessageEncryptor().requiresDevice()).toBe(true);
    });

    it("isConfigured(undefined) returns true in material mode and never throws", () => {
        const encryptor = new E2EMessageEncryptor(vector.publicKeySpkiBase64, vector.keyVersion);
        expect(encryptor.isConfigured()).toBe(true);
        expect(encryptor.isConfigured(deviceWithKey)).toBe(true);
    });

    it("throws a plain Error naming the missing sibling when only publicKey is provided", () => {
        expect(() => new E2EMessageEncryptor(vector.publicKeySpkiBase64)).toThrow(/keyVersion/);
    });

    it("throws a plain Error naming the missing sibling when only keyVersion is provided", () => {
        expect(() => new E2EMessageEncryptor(undefined, 2)).toThrow(/publicKey/);
    });

    it("throws a plain Error for an empty publicKey", () => {
        expect(() => new E2EMessageEncryptor("", 2)).toThrow(/publicKey/);
    });

    it("throws a plain Error for non-positive or non-integer keyVersion (0, -1, 1.5)", () => {
        for (const keyVersion of [0, -1, 1.5]) {
            expect(() => new E2EMessageEncryptor(vector.publicKeySpkiBase64, keyVersion)).toThrow(/keyVersion/);
        }
    });

    it("listing mode (no ctor args) unchanged: requiresDevice true, isConfigured(undefined) false, keyless pass-through, E2ENotConfigured", async () => {
        const encryptor = new E2EMessageEncryptor();
        expect(encryptor.requiresDevice()).toBe(true);
        expect(encryptor.isConfigured()).toBe(false);
        await expect(encryptor.encrypt("secret")).resolves.toBe("secret");
        await expect(encryptor.encrypt("secret", { ...deviceWithKey, keyVersion: null })).rejects.toMatchObject({
            message: 'Device "dev-e2e" has a public key but no keyVersion configured',
        });
    });
});
