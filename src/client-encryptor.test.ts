import { beforeEach, describe, expect, it, jest } from "bun:test";

import { BASE_URL, Client } from "./client";
import { Device, Message, MessageState, ProcessState } from "./domain";
import { HttpClient } from "./http";
import {
    EncryptionError,
    Encryptor,
    PassphraseMessageEncryptor,
} from "./encryption";
import { decryptPassphraseValue } from "./encryption/test-utils";

import vector from "../test-vectors/e2e-vector-v1.json";

function deepFreeze<T>(value: T): T {
    if (value && typeof value === "object") {
        for (const key of Object.keys(value)) {
            deepFreeze((value as Record<string, unknown>)[key]);
        }
        Object.freeze(value);
    }
    return value;
}

describe("Client encryption orchestration", () => {
    let mockHttpClient: HttpClient;

    const deviceWithKey: Device = {
        id: 'dev-e2e',
        name: 'E2E Device',
        createdAt: '2020-01-01T00:00:00Z',
        lastSeen: '2020-01-01T00:00:00Z',
        updatedAt: '2020-01-01T00:00:00Z',
        publicKey: vector.publicKeySpkiBase64,
        keyVersion: 2,
    };

    const keylessDevice: Device = { ...deviceWithKey, publicKey: null, keyVersion: null };

    function expectedState(): MessageState {
        return { id: '123', state: ProcessState.Pending, recipients: [] };
    }

    function createSpyEncryptor(
        isConfigured: boolean,
        isConfiguredError?: EncryptionError,
    ): { encrypt: jest.Mock; isConfigured: jest.Mock; requiresDevice: jest.Mock } {
        const encryptor = {
            encrypt: jest.fn(async (value: string) => `enc:${value}`),
            isConfigured: jest.fn(),
            requiresDevice: jest.fn(() => true),
        };
        if (isConfiguredError) {
            encryptor.isConfigured.mockImplementation(() => {
                throw isConfiguredError;
            });
        } else {
            encryptor.isConfigured.mockReturnValue(isConfigured);
        }
        return encryptor;
    }

    beforeEach(() => {
        mockHttpClient = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
        } as unknown as HttpClient;
    });

    it('(a) keyed device: encrypts all 4 field kinds via the spy, isEncrypted=true, deviceId=device.id, posts verbatim', async () => {
        const message: Message = {
            message: 'secret body',
            textMessage: { text: 'secret text' },
            dataMessage: { data: 'SGVsbG8gV29ybGQh', port: 53739 },
            phoneNumbers: ['+1234567890', '+0987654321'],
        };
        const encryptor = createSpyEncryptor(true);
        const expected = expectedState();
        (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expected);

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        const result = await client.send(message, { deviceId: 'dev-e2e' });

        expect(encryptor.isConfigured).toHaveBeenCalledTimes(1);
        expect(encryptor.isConfigured).toHaveBeenCalledWith(deviceWithKey);
        expect(encryptor.encrypt).toHaveBeenCalledTimes(5);
        expect(encryptor.encrypt).toHaveBeenCalledWith('secret body', deviceWithKey);
        expect(encryptor.encrypt).toHaveBeenCalledWith('secret text', deviceWithKey);
        expect(encryptor.encrypt).toHaveBeenCalledWith('SGVsbG8gV29ybGQh', deviceWithKey);
        expect(encryptor.encrypt).toHaveBeenCalledWith('+1234567890', deviceWithKey);
        expect(encryptor.encrypt).toHaveBeenCalledWith('+0987654321', deviceWithKey);

        const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        expect(body).toEqual({
            message: 'enc:secret body',
            textMessage: { text: 'enc:secret text' },
            dataMessage: { data: 'enc:SGVsbG8gV29ybGQh', port: 53739 },
            phoneNumbers: ['enc:+1234567890', 'enc:+0987654321'],
            isEncrypted: true,
            deviceId: 'dev-e2e',
        });
        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/message`,
            body,
            expect.any(Object),
        );
        expect(result).toBe(expected);
    });

    it('(b) keyless device: encrypt spy called 0 times, body deep-equal WITHOUT isEncrypted', async () => {
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
        const encryptor = createSpyEncryptor(false);
        (mockHttpClient.get as jest.Mock).mockResolvedValue([keylessDevice]);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await client.send(message, { deviceId: 'dev-e2e' });

        expect(encryptor.isConfigured).toHaveBeenCalledTimes(1);
        expect(encryptor.encrypt).not.toHaveBeenCalled();
        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/message`,
            { message: 'secret', phoneNumbers: ['+1234567890'], deviceId: 'dev-e2e' },
            expect.any(Object),
        );
    });

    it('(b2) caller-set request.isEncrypted=true is overwritten to omitted on a keyless device', async () => {
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'], isEncrypted: true };
        const encryptor = createSpyEncryptor(false);
        (mockHttpClient.get as jest.Mock).mockResolvedValue([keylessDevice]);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await client.send(message, { deviceId: 'dev-e2e' });

        const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        expect(body).toEqual({ message: 'secret', phoneNumbers: ['+1234567890'], deviceId: 'dev-e2e' });
        expect('isEncrypted' in body).toBe(false);
        expect(encryptor.encrypt).not.toHaveBeenCalled();
    });

    it('(c) isConfigured throwing E2ENotConfigured propagates; httpClient.post NOT called', async () => {
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
        const encryptor = createSpyEncryptor(false, new EncryptionError(
            'Device "dev-e2e" has a public key but no keyVersion configured',
        ));
        (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);

        await expect(client.send(message, { deviceId: 'dev-e2e' })).rejects.toMatchObject({
            message: 'Device "dev-e2e" has a public key but no keyVersion configured',
        });
        expect(mockHttpClient.post).not.toHaveBeenCalled();
        expect(encryptor.encrypt).not.toHaveBeenCalled();
    });

    it('(d) passphrase-like encryptor (isConfigured true always) always encrypts, even for a keyless device', async () => {
        const encryptor = new PassphraseMessageEncryptor('shared-secret', 1_000);
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
        (mockHttpClient.get as jest.Mock).mockResolvedValue([keylessDevice]);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor);
        await client.send(message, { deviceId: 'dev-e2e' });

        const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        expect(body.isEncrypted).toBe(true);
        expect(body.deviceId).toBe('dev-e2e');
        expect(body.message).toContain('$aes-256-cbc/pbkdf2-sha1$');
        expect(body.phoneNumbers[0]).toContain('$aes-256-cbc/pbkdf2-sha1$');
        await expect(decryptPassphraseValue('shared-secret', body.message)).resolves.toBe('secret');
        await expect(decryptPassphraseValue('shared-secret', body.phoneNumbers[0])).resolves.toBe('+1234567890');
    });

    it('(e) no SendOptions.deviceId: encryptor NEVER invoked, request posted verbatim', async () => {
        const message: Message = { message: 'Hello', phoneNumbers: ['+1234567890'] };
        const encryptor = createSpyEncryptor(true);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await client.send(message);

        expect(encryptor.isConfigured).not.toHaveBeenCalled();
        expect(encryptor.encrypt).not.toHaveBeenCalled();
        expect(mockHttpClient.get).not.toHaveBeenCalled();
        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/message`,
            message,
            expect.any(Object),
        );
    });

    it('(f) zero encryptable fields with a configured device: isEncrypted=true, deviceId set, encrypt invoked 0 times', async () => {
        const message: Message = { message: '', phoneNumbers: [] };
        const encryptor = createSpyEncryptor(true);
        (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await client.send(message, { deviceId: 'dev-e2e' });

        const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        expect(body).toEqual({ message: '', phoneNumbers: [], isEncrypted: true, deviceId: 'dev-e2e' });
        expect(encryptor.encrypt).not.toHaveBeenCalled();
    });

    it('(g) never mutates the caller message (deep-frozen input)', async () => {
        const message = deepFreeze<Message>({
            message: 'secret body',
            textMessage: { text: 'secret text' },
            phoneNumbers: ['+1234567890'],
        });
        const snapshot = JSON.parse(JSON.stringify(message));
        const encryptor = createSpyEncryptor(true);
        (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await client.send(message, { deviceId: 'dev-e2e' });

        expect(message).toEqual(snapshot);
    });

    it('(h) material-mode spy (requiresDevice false): no device fetch, isConfigured(undefined) once, encrypt per field with undefined, deviceId verbatim, isEncrypted true', async () => {
        const message: Message = {
            message: 'secret body',
            textMessage: { text: 'secret text' },
            dataMessage: { data: 'SGVsbG8gV29ybGQh', port: 53739 },
            phoneNumbers: ['+1234567890'],
        };
        const encryptor = createSpyEncryptor(true);
        encryptor.requiresDevice.mockReturnValue(false);
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await client.send(message, { deviceId: 'dev-material' });

        expect(mockHttpClient.get).not.toHaveBeenCalled();
        expect(encryptor.requiresDevice).toHaveBeenCalledTimes(1);
        expect(encryptor.isConfigured).toHaveBeenCalledTimes(1);
        expect(encryptor.isConfigured).toHaveBeenCalledWith(undefined);
        expect(encryptor.encrypt).toHaveBeenCalledTimes(4);
        expect(encryptor.encrypt).toHaveBeenCalledWith('secret body', undefined);
        expect(encryptor.encrypt).toHaveBeenCalledWith('secret text', undefined);
        expect(encryptor.encrypt).toHaveBeenCalledWith('SGVsbG8gV29ybGQh', undefined);
        expect(encryptor.encrypt).toHaveBeenCalledWith('+1234567890', undefined);

        const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        expect(body).toEqual({
            message: 'enc:secret body',
            textMessage: { text: 'enc:secret text' },
            dataMessage: { data: 'enc:SGVsbG8gV29ybGQh', port: 53739 },
            phoneNumbers: ['enc:+1234567890'],
            isEncrypted: true,
            deviceId: 'dev-material',
        });
    });

    it('(i) passphrase mode: unknown deviceId does NOT throw DeviceNotFound (no listing fetch), deviceId verbatim, isEncrypted true', async () => {
        const encryptor = new PassphraseMessageEncryptor('shared-secret', 1_000);
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState());

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor);
        await client.send(message, { deviceId: 'dev-unknown' });

        expect(mockHttpClient.get).not.toHaveBeenCalled();
        const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        expect(body.deviceId).toBe('dev-unknown');
        expect(body.isEncrypted).toBe(true);
        expect(body.message).toContain('$aes-256-cbc/pbkdf2-sha1$');
        await expect(decryptPassphraseValue('shared-secret', body.message)).resolves.toBe('secret');
    });

    it('(j) material mode: empty deviceId still throws DeviceIDRequired before any resolution or isConfigured call', async () => {
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
        const encryptor = createSpyEncryptor(true);
        encryptor.requiresDevice.mockReturnValue(false);

        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);
        await expect(client.send(message, { deviceId: '' })).rejects.toMatchObject({
            message: 'deviceId is required for E2E messages',
        });
        expect(mockHttpClient.get).not.toHaveBeenCalled();
        expect(mockHttpClient.post).not.toHaveBeenCalled();
        expect(encryptor.isConfigured).not.toHaveBeenCalled();
    });

    it('(k) error order: DeviceIDRequired -> DeviceNotFound -> E2ENotConfigured sequential; httpClient.post NEVER called (listing mode)', async () => {
        const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
        const encryptor = createSpyEncryptor(false, new EncryptionError(
            'Device "dev-e2e" has a public key but no keyVersion configured',
        ));
        const client = new Client('login', 'password', mockHttpClient, BASE_URL, encryptor as unknown as Encryptor);

        // 1. empty/whitespace deviceId -> DeviceIDRequired (before any resolution)
        (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
        await expect(client.send(message, { deviceId: '   ' })).rejects.toMatchObject({
            message: 'deviceId is required for E2E messages',
        });
        expect(mockHttpClient.get).not.toHaveBeenCalled();

        // 2. unknown deviceId -> DeviceNotFound
        (mockHttpClient.get as jest.Mock).mockResolvedValue([]);
        await expect(client.send(message, { deviceId: 'dev-unknown' })).rejects.toMatchObject({
            message: 'Device "dev-unknown" not found in the device listing',
        });

        // 3. publicKey w/o keyVersion -> E2ENotConfigured (isConfigured throws)
        const deviceWithoutKeyVersion: Device = { ...deviceWithKey, keyVersion: null };
        (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithoutKeyVersion]);
        await expect(client.send(message, { deviceId: 'dev-e2e' })).rejects.toMatchObject({
            message: 'Device "dev-e2e" has a public key but no keyVersion configured',
        });

        expect(mockHttpClient.post).not.toHaveBeenCalled();
        expect(encryptor.encrypt).not.toHaveBeenCalled();
    });
});
