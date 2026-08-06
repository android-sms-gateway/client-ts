import { BASE_URL, Client } from './client';
import {
    Device,
    DeviceSettings,
    HealthResponse,
    HealthStatus,
    LimitPeriod,
    LogEntry,
    LogEntryPriority,
    Message,
    MessageState,
    ProcessState,
    RegisterWebHookRequest,
    TokenRequest,
    TokenResponse,
    WebHook,
    WebHookEventType,
} from './domain';
import { HttpClient } from './http';
import { E2EErrorCode, decryptValue, splitE2EValue } from './encryption';

import vector from '../test-vectors/e2e-vector-v1.json';

import { beforeEach, describe, expect, it, jest } from "bun:test";

describe('Client', () => {
    let client: Client;
    let mockHttpClient: HttpClient;

    beforeEach(() => {
        mockHttpClient = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            patch: jest.fn(),
            delete: jest.fn(),
        } as unknown as HttpClient;
        client = new Client('login', 'password', mockHttpClient);
    });

    it('sends a message', async () => {
        const message: Message = {
            message: 'Hello',
            phoneNumbers: ['+1234567890'],
        };
        const expectedState: MessageState = {
            id: '123',
            state: ProcessState.Pending,
            recipients: [
                {
                    phoneNumber: '+1234567890',
                    state: ProcessState.Pending,
                }
            ]
        };

        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

        const result = await client.send(message);

        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/message`,
            message,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(expectedState);
    });

    it('sends a message with skipPhoneValidation', async () => {
        const message: Message = {
            message: 'Hello',
            phoneNumbers: ['+1234567890'],
        };
        const expectedState: MessageState = {
            id: '123',
            state: ProcessState.Pending,
            recipients: [
                {
                    phoneNumber: '+1234567890',
                    state: ProcessState.Pending,
                }
            ]
        };

        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

        const result = await client.send(message, { skipPhoneValidation: true });

        const url = new URL(`${BASE_URL}/message?skipPhoneValidation=true`);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
            url.toString(),
            message,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(expectedState);
    });

    it('gets the state of a message', async () => {
        const messageId = '123';
        const expectedState: MessageState = {
            id: '123',
            state: ProcessState.Pending,
            recipients: [
                {
                    phoneNumber: '+1234567890',
                    state: ProcessState.Pending,
                }
            ]
        };

        (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedState);

        const result = await client.getState(messageId);

        expect(mockHttpClient.get).toHaveBeenCalledWith(
            `${BASE_URL}/message/${messageId}`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(expectedState);
    });

    it('gets webhooks', async () => {
        const expectedWebhooks: WebHook[] = [
            { id: '1', url: 'https://example.com/webhook1', event: WebHookEventType.SmsReceived, deviceId: null },
            { id: '2', url: 'https://example.com/webhook2', event: WebHookEventType.SystemPing, deviceId: 'device2' },
        ];

        (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedWebhooks);

        const result = await client.getWebhooks();

        expect(mockHttpClient.get).toHaveBeenCalledWith(
            `${BASE_URL}/webhooks`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toEqual(expectedWebhooks);
    });

    it('register a webhook', async () => {
        const req: RegisterWebHookRequest = {
            url: 'https://example.com/webhook',
            event: WebHookEventType.SmsReceived,
            deviceId: null,
        }
        const expectedRes: WebHook = {
            id: 'test',
            url: 'https://example.com/webhook',
            event: WebHookEventType.SmsReceived,
            deviceId: 'device1'
        };

        (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedRes);

        const result = await client.registerWebhook(req);

        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/webhooks`,
            req,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(expectedRes);
    });

    it('delete a webhook', async () => {
        (mockHttpClient.delete as jest.Mock).mockResolvedValue(undefined);

        const result = await client.deleteWebhook('test');

        expect(mockHttpClient.delete).toHaveBeenCalledWith(
            `${BASE_URL}/webhooks/test`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(undefined);
    });

    // New tests

    it('gets devices', async () => {
        const expectedDevices: Device[] = [
            { id: '1', name: 'Device 1', createdAt: '2020-01-01T00:00:00Z', lastSeen: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
            { id: '2', name: 'Device 2', createdAt: '2020-01-01T00:00:00Z', lastSeen: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' },
        ];

        (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedDevices);

        const result = await client.getDevices();

        expect(mockHttpClient.get).toHaveBeenCalledWith(
            `${BASE_URL}/devices`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toEqual(expectedDevices);
    });

    it('deletes a device', async () => {
        (mockHttpClient.delete as jest.Mock).mockResolvedValue(undefined);

        const result = await client.deleteDevice('test-device-id');

        expect(mockHttpClient.delete).toHaveBeenCalledWith(
            `${BASE_URL}/devices/test-device-id`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(undefined);
    });

    it('gets health', async () => {
        const expectedHealth: HealthResponse = {
            status: HealthStatus.Pass,
            version: '1.0.0',
            releaseId: 1,
            checks: {
                'messages:failed': { status: HealthStatus.Pass, description: 'Failed messages for last hour', observedValue: 0, observedUnit: 'messages' },
                'connection:status': { status: HealthStatus.Pass, description: 'Internet connection status', observedValue: 1, observedUnit: 'boolean' },
            },
        };

        (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedHealth);

        const result = await client.getHealth();

        expect(mockHttpClient.get).toHaveBeenCalledWith(
            `${BASE_URL}/health`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toEqual(expectedHealth);
    });

    it('exports inbox', async () => {
        const since = new Date('2024-01-01T00:00:00Z');
        const until = new Date('2024-01-02T00:00:00Z');

        (mockHttpClient.post as jest.Mock).mockResolvedValue(undefined);

        const result = await client.exportInbox({ deviceId: 'test-device-id', since, until });

        const expectedRequest = {
            deviceId: 'test-device-id',
            since: since.toISOString(),
            until: until.toISOString(),
        };

        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/inbox/export`,
            expectedRequest,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(undefined);
    });

    it('gets logs', async () => {
        const from = new Date('2024-01-01T00:00:00Z');
        const to = new Date('2024-01-01T01:00:00Z');
        const expectedLogs: LogEntry[] = [
            { id: 1, createdAt: '2024-01-01T00:00:00Z', module: 'auth', priority: LogEntryPriority.Info, message: 'User logged in' },
            { id: 2, createdAt: '2024-01-01T00:01:00Z', module: 'auth', priority: LogEntryPriority.Error, message: 'Login failed' },
        ];

        (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedLogs);

        const result = await client.getLogs(from, to);

        expect(mockHttpClient.get).toHaveBeenCalledWith(
            `${BASE_URL}/logs?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toEqual(expectedLogs);
    });

    it('gets settings', async () => {
        const expectedSettings: DeviceSettings = {
            messages: { limitPeriod: LimitPeriod.PerDay, limitValue: 100 },
            webhooks: { internetRequired: true, retryCount: 3 },
        };

        (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedSettings);

        const result = await client.getSettings();

        expect(mockHttpClient.get).toHaveBeenCalledWith(
            `${BASE_URL}/settings`,
            {
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toEqual(expectedSettings);
    });

    it('updates settings', async () => {
        const settings: DeviceSettings = {
            messages: { limitPeriod: LimitPeriod.PerDay, limitValue: 100 },
            webhooks: { internetRequired: true, retryCount: 3 },
        };

        (mockHttpClient.put as jest.Mock).mockResolvedValue(undefined);

        const result = await client.updateSettings(settings);

        expect(mockHttpClient.put).toHaveBeenCalledWith(
            `${BASE_URL}/settings`,
            settings,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(undefined);
    });

    // JWT Authentication Tests
    describe('Client with JWT Authentication', () => {
        let client: Client;
        let mockHttpClient: HttpClient;
        const jwtToken = 'fake-token-123';

        beforeEach(() => {
            mockHttpClient = {
                get: jest.fn(),
                post: jest.fn(),
                put: jest.fn(),
                patch: jest.fn(),
                delete: jest.fn(),
            } as unknown as HttpClient;

            client = new Client('', jwtToken, mockHttpClient);
        });

        it('creates client with JWT authentication', () => {
            expect(client).toBeDefined();
        });

        it('sends a message with JWT authentication', async () => {
            const message: Message = {
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [
                    {
                        phoneNumber: '+1234567890',
                        state: ProcessState.Pending,
                    }
                ]
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.send(message);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/message`,
                message,
                {
                    "Content-Type": "application/json",
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: `Bearer fake-token-123`,
                },
            );
            expect(result).toBe(expectedState);
        });

        it('gets the state of a message with JWT authentication', async () => {
            const messageId = '123';
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [
                    {
                        phoneNumber: '+1234567890',
                        state: ProcessState.Pending,
                    }
                ]
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.getState(messageId);

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                `${BASE_URL}/message/${messageId}`,
                {
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: `Bearer fake-token-123`,
                },
            );
            expect(result).toBe(expectedState);
        });

        it('throws error when JWT token is missing', () => {
            expect(() => {
                new Client('', '', mockHttpClient);
            }).toThrow('Token is required for JWT authentication');
        });
    });

    // Backward Compatibility Tests
    describe('Client Backward Compatibility', () => {
        let client: Client;
        let mockHttpClient: HttpClient;

        beforeEach(() => {
            mockHttpClient = {
                get: jest.fn(),
                post: jest.fn(),
                put: jest.fn(),
                patch: jest.fn(),
                delete: jest.fn(),
            } as unknown as HttpClient;
            client = new Client('login', 'password', mockHttpClient);
        });

        it('creates client with Basic Auth using legacy constructor', () => {
            expect(client).toBeDefined();
        });

        it('sends a message with Basic Auth using legacy constructor', async () => {
            const message: Message = {
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [
                    {
                        phoneNumber: '+1234567890',
                        state: ProcessState.Pending,
                    }
                ]
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.send(message);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/message`,
                message,
                {
                    "Content-Type": "application/json",
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: expect.stringMatching(/^Basic /),
                },
            );
            expect(result).toBe(expectedState);
        });

        it('throws error when password is missing in legacy constructor', () => {
            expect(() => {
                new Client('login', '', mockHttpClient);
            }).toThrow('Password is required when using Basic Auth with login');
        });
    });

    it('patches settings', async () => {
        const settings: Partial<DeviceSettings> = {
            messages: { limitValue: 200 },
        };

        (mockHttpClient.patch as jest.Mock).mockResolvedValue(undefined);

        const result = await client.patchSettings(settings);

        expect(mockHttpClient.patch).toHaveBeenCalledWith(
            `${BASE_URL}/settings`,
            settings,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(undefined);
    });

    // JWT Token Management Tests
    describe('JWT Token Management', () => {
        let client: Client;
        let mockHttpClient: HttpClient;

        beforeEach(() => {
            mockHttpClient = {
                get: jest.fn(),
                post: jest.fn(),
                put: jest.fn(),
                patch: jest.fn(),
                delete: jest.fn(),
            } as unknown as HttpClient;
            client = new Client('login', 'password', mockHttpClient);
        });

        it('generates a new token', async () => {
            const tokenRequest: TokenRequest = {
                scopes: ['read', 'write'],
                ttl: 3600,
            };
            const expectedResponse: TokenResponse = {
                access_token: 'fake-token-123',
                token_type: 'Bearer',
                id: 'token-id-123',
                expires_at: '2024-12-31T23:59:59Z',
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedResponse);

            const result = await client.generateToken(tokenRequest);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/auth/token`,
                tokenRequest,
                {
                    "Content-Type": "application/json",
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: expect.any(String),
                },
            );
            expect(result).toBe(expectedResponse);
        });

        it('generates a new token without TTL', async () => {
            const tokenRequest: TokenRequest = {
                scopes: ['read'],
            };
            const expectedResponse: TokenResponse = {
                access_token: 'fake-token-123',
                token_type: 'Bearer',
                id: 'token-id-456',
                expires_at: '2024-12-31T23:59:59Z',
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedResponse);

            const result = await client.generateToken(tokenRequest);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/auth/token`,
                tokenRequest,
                {
                    "Content-Type": "application/json",
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: expect.any(String),
                },
            );
            expect(result).toBe(expectedResponse);
        });

        it('revokes a token', async () => {
            const jti = 'token-id-123';

            (mockHttpClient.delete as jest.Mock).mockResolvedValue(undefined);

            const result = await client.revokeToken(jti);

            expect(mockHttpClient.delete).toHaveBeenCalledWith(
                `${BASE_URL}/auth/token/${jti}`,
                {
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: expect.any(String),
                },
            );
            expect(result).toBe(undefined);
        });
    });

    // E2E encryption tests
    describe('Client E2E encryption', () => {
        let client: Client;
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

        beforeEach(() => {
            mockHttpClient = {
                get: jest.fn(),
                post: jest.fn(),
                put: jest.fn(),
                patch: jest.fn(),
                delete: jest.fn(),
            } as unknown as HttpClient;
            client = new Client('login', 'password', mockHttpClient);
        });

        it('encrypts message body and phone numbers when deviceId is provided', async () => {
            const message: Message = {
                message: 'secret message',
                phoneNumbers: ['+1234567890', '+0987654321'],
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.send(message, { deviceId: 'dev-e2e' });

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                `${BASE_URL}/devices`,
                { "User-Agent": "android-sms-gateway/3.0 (client; js)", Authorization: expect.any(String) },
            );

            const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
            expect(body).toEqual({
                message: expect.any(String),
                phoneNumbers: [expect.any(String), expect.any(String)],
                isEncrypted: true,
                deviceId: 'dev-e2e',
            });

            // body decrypts back to the original values (real encryption, not obfuscation)
            expect(await decryptValue(vector.privateKeyPem, body.message)).toBe('secret message');
            expect(await decryptValue(vector.privateKeyPem, body.phoneNumbers[0])).toBe('+1234567890');
            expect(await decryptValue(vector.privateKeyPem, body.phoneNumbers[1])).toBe('+0987654321');

            // wire format: 7 chunks each
            expect(splitE2EValue(body.message)).toHaveLength(7);
            expect(splitE2EValue(body.phoneNumbers[0])).toHaveLength(7);
            expect(splitE2EValue(body.phoneNumbers[1])).toHaveLength(7);

            // distinct fresh IVs for body and each phone number
            const ivs = [body.message, body.phoneNumbers[0], body.phoneNumbers[1]]
                .map((v: string) => splitE2EValue(v)[5]);
            expect(new Set(ivs).size).toBe(3);

            expect(result).toBe(expectedState);
        });

        it('falls back to plaintext when the device lacks a publicKey', async () => {
            const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
            const deviceWithoutKey: Device = { ...deviceWithKey, publicKey: null, keyVersion: null };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithoutKey]);
            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.send(message, { deviceId: 'dev-e2e' });

            expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
            expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/message`,
                { message: 'secret', phoneNumbers: ['+1234567890'], deviceId: 'dev-e2e' },
                {
                    "Content-Type": "application/json",
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: expect.any(String),
                },
            );
            expect(result).toBe(expectedState);
        });

        it('falls back to plaintext when the device publicKey is undefined', async () => {
            const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
            const deviceWithoutKey: Device = { ...deviceWithKey, publicKey: undefined, keyVersion: undefined };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithoutKey]);
            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.send(message, { deviceId: 'dev-e2e' });

            expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
            expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/message`,
                { message: 'secret', phoneNumbers: ['+1234567890'], deviceId: 'dev-e2e' },
                expect.any(Object),
            );
            expect(result).toBe(expectedState);
        });

        it('throws a typed error when the device has a publicKey but no keyVersion', async () => {
            const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
            const deviceWithoutVersion: Device = { ...deviceWithKey, keyVersion: null };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithoutVersion]);

            await expect(client.send(message, { deviceId: 'dev-e2e' })).rejects.toMatchObject({
                code: E2EErrorCode.E2ENotConfigured,
            });
            expect(mockHttpClient.post).not.toHaveBeenCalled();
        });

        it('throws a typed error when the device is not in the listing', async () => {
            const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([]);

            await expect(client.send(message, { deviceId: 'missing-device' })).rejects.toMatchObject({
                code: E2EErrorCode.DeviceNotFound,
            });
            expect(mockHttpClient.post).not.toHaveBeenCalled();
        });

        it('throws a typed error when deviceId is empty', async () => {
            const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };

            await expect(client.send(message, { deviceId: '' })).rejects.toMatchObject({
                code: E2EErrorCode.DeviceIDRequired,
            });
            expect(mockHttpClient.get).not.toHaveBeenCalled();
            expect(mockHttpClient.post).not.toHaveBeenCalled();
        });

        it('sends unencrypted as before when no deviceId is provided (backward compatibility)', async () => {
            const message: Message = { message: 'Hello', phoneNumbers: ['+1234567890'] };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [{ phoneNumber: '+1234567890', state: ProcessState.Pending }],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.send(message);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                `${BASE_URL}/message`,
                message,
                {
                    "Content-Type": "application/json",
                    "User-Agent": "android-sms-gateway/3.0 (client; js)",
                    Authorization: expect.any(String),
                },
            );
            expect(mockHttpClient.get).not.toHaveBeenCalled();
            expect(result).toBe(expectedState);
        });

        it('encrypts DataMessage.data with the same scheme and leaves port untouched', async () => {
            const message: Message = {
                message: '',
                phoneNumbers: ['+1234567890'],
                dataMessage: { data: 'SGVsbG8gV29ybGQh', port: 53739 },
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message, { deviceId: 'dev-e2e' });

            const body = (mockHttpClient.post as jest.Mock).mock.calls[0][1];
            expect(body.dataMessage).toEqual({
                data: expect.any(String),
                port: 53739,
            });
            expect(await decryptValue(vector.privateKeyPem, body.dataMessage.data)).toBe('SGVsbG8gV29ybGQh');
            expect(body.message).toBe('');
            expect(body.isEncrypted).toBe(true);
        });

        it('caches the device listing per deviceId between sends', async () => {
            const message: Message = { message: 'secret', phoneNumbers: ['+1234567890'] };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue([deviceWithKey]);
            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message, { deviceId: 'dev-e2e' });
            await client.send(message, { deviceId: 'dev-e2e' });

            expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
            expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
        });

        it('echoes the encrypted phone string verbatim on status polling', async () => {
            const encryptedPhone = await (async () => {
                const { encryptValue } = await import('./encryption');
                return encryptValue(vector.publicKeySpkiBase64, 2, '+1234567890');
            })();
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [{ phoneNumber: encryptedPhone, state: ProcessState.Pending }],
            };

            (mockHttpClient.get as jest.Mock).mockResolvedValue(expectedState);

            const result = await client.getState('123');

            expect(result.recipients[0].phoneNumber).toBe(encryptedPhone);
        });
    });
});