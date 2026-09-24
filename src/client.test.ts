import { BASE_URL, Client } from './client';
import {
    Device,
    DeviceSettings,
    HealthResponse,
    HealthStatus,
    IncomingMessageType,
    InboxRefreshRequest,
    LimitPeriod,
    LogEntry,
    LogEntryPriority,
    Message,
    MessagePriority,
    MessageState,
    ProcessState,
    RegisterWebHookRequest,
    TokenRequest,
    TokenResponse,
    WebHook,
    WebHookEventType,
    WebhookDelivery,
    resolveWebhookDelivery,
} from './domain';
import { HttpClient } from './http';

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
            { ...message, priority: 0 },
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
            { ...message, priority: 0 },
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(expectedState);
    });

    describe('Message fields serialization', () => {
        const validUntil = new Date('2026-08-17T12:00:00Z');
        const scheduleAt = new Date('2026-08-17T10:00:00Z');

        function postedBody(): any {
            return (mockHttpClient.post as jest.Mock).mock.calls[0][1];
        }

        it('serializes priority, validUntil and scheduleAt for a legacy text message', async () => {
            const message: Message = {
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
                priority: MessagePriority.Default,
                validUntil,
                scheduleAt,
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message);

            const wire = JSON.stringify(postedBody());
            expect(JSON.parse(wire)).toEqual({
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
                priority: 0,
                validUntil: '2026-08-17T12:00:00.000Z',
                scheduleAt: '2026-08-17T10:00:00.000Z',
            });
            expect(typeof JSON.parse(wire).priority).toBe('number');
            expect(typeof JSON.parse(wire).validUntil).toBe('string');
            expect(typeof JSON.parse(wire).scheduleAt).toBe('string');
        });

        it('serializes priority, validUntil and scheduleAt for a textMessage variant', async () => {
            const message: Message = {
                textMessage: { text: 'Hello' },
                phoneNumbers: ['+1234567890'],
                priority: 100,
                validUntil,
                scheduleAt,
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message);

            const wire = JSON.stringify(postedBody());
            expect(wire).toContain('"priority":100');
            expect(wire).toContain('"validUntil":"2026-08-17T12:00:00.000Z"');
            expect(wire).toContain('"scheduleAt":"2026-08-17T10:00:00.000Z"');
        });

        it('serializes priority, validUntil and scheduleAt for a dataMessage variant', async () => {
            const message: Message = {
                dataMessage: { data: 'aGVsbG8=', port: 1234 },
                phoneNumbers: ['+1234567890'],
                priority: 127,
                validUntil,
                scheduleAt,
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message);

            const wire = JSON.stringify(postedBody());
            expect(JSON.parse(wire)).toEqual({
                dataMessage: { data: 'aGVsbG8=', port: 1234 },
                phoneNumbers: ['+1234567890'],
                priority: 127,
                validUntil: '2026-08-17T12:00:00.000Z',
                scheduleAt: '2026-08-17T10:00:00.000Z',
            });
        });

        it('serializes a message without validUntil/scheduleAt, still emitting priority 0', async () => {
            const message: Message = {
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message);

            const wire = JSON.stringify(postedBody());
            expect(JSON.parse(wire)).toEqual({
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
                priority: 0,
            });
            expect(wire).not.toContain('validUntil');
            expect(wire).not.toContain('scheduleAt');
        });

        it('serializes null validUntil and scheduleAt as JSON null', async () => {
            const message: Message = {
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
                validUntil: null,
                scheduleAt: null,
            };
            const expectedState: MessageState = {
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            };

            (mockHttpClient.post as jest.Mock).mockResolvedValue(expectedState);

            await client.send(message);

            const parsed = JSON.parse(JSON.stringify(postedBody()));
            expect(parsed.validUntil).toBeNull();
            expect(parsed.scheduleAt).toBeNull();
        });
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

    describe('MessageState createdAt pass-through', () => {
        it('getState passes through a createdAt timestamp from the wire JSON', async () => {
            const wire = JSON.stringify({
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
                createdAt: '2026-08-23T10:00:00+03:00',
            });

            (mockHttpClient.get as jest.Mock).mockResolvedValue(JSON.parse(wire));

            const result = await client.getState('123');

            expect(result.createdAt).toBe('2026-08-23T10:00:00+03:00');
        });

        it('listMessages passes through createdAt timestamps from the wire JSON', async () => {
            const wire = JSON.stringify([
                {
                    id: '123',
                    state: ProcessState.Pending,
                    recipients: [],
                    createdAt: '2026-08-23T07:00:00Z',
                },
                {
                    id: '124',
                    state: ProcessState.Sent,
                    recipients: [],
                    createdAt: '2026-08-23T11:30:00+02:00',
                },
            ]);

            (mockHttpClient.get as jest.Mock).mockResolvedValue(JSON.parse(wire));

            const result = await client.listMessages();

            expect(result[0].createdAt).toBe('2026-08-23T07:00:00Z');
            expect(result[1].createdAt).toBe('2026-08-23T11:30:00+02:00');
        });

        it('send passes through a createdAt timestamp from the wire JSON', async () => {
            const wire = JSON.stringify({
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
                createdAt: '2026-08-23T10:00:00+03:00',
            });

            (mockHttpClient.post as jest.Mock).mockResolvedValue(JSON.parse(wire));

            const result = await client.send({
                message: 'Hello',
                phoneNumbers: ['+1234567890'],
            });

            expect(result.createdAt).toBe('2026-08-23T10:00:00+03:00');
        });

        it('handles message state without a createdAt field', async () => {
            const wire = JSON.stringify({
                id: '123',
                state: ProcessState.Pending,
                recipients: [],
            });

            (mockHttpClient.get as jest.Mock).mockResolvedValue(JSON.parse(wire));

            const result = await client.getState('123');

            expect(result.createdAt).toBeUndefined();
        });
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

    it('refreshes inbox', async () => {
        const request: InboxRefreshRequest = {
            deviceId: 'test-device-id',
            since: new Date('2025-01-01T00:00:00Z'),
            until: new Date('2025-01-02T00:00:00Z'),
            messageTypes: [IncomingMessageType.SMS, IncomingMessageType.DATA_SMS],
            webhookDelivery: WebhookDelivery.Batch,
        };

        // Mirrors the real server's 202 Accepted response: empty body, no Content-Type header
        const empty202 = new Response(null, { status: 202 });
        expect(empty202.headers.get('Content-Type')).toBeNull();
        await expect(empty202.text()).resolves.toBe('');

        (mockHttpClient.post as jest.Mock).mockResolvedValue(undefined);

        const result = await client.refreshInbox(request);

        const expectedRequest = {
            deviceId: 'test-device-id',
            since: request.since.toISOString(),
            until: request.until.toISOString(),
            messageTypes: ['SMS', 'DATA_SMS'],
            webhookDelivery: 'Batch',
        };

        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/inbox/refresh`,
            expectedRequest,
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
        expect(result).toBe(undefined);
    });

    it('refreshes inbox with a minimal request (Go parity)', async () => {
        const request: InboxRefreshRequest = {
            since: new Date('2025-01-01T00:00:00Z'),
            until: new Date('2025-01-02T00:00:00Z'),
        };

        (mockHttpClient.post as jest.Mock).mockResolvedValue(undefined);

        await client.refreshInbox(request);

        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/inbox/refresh`,
            {
                since: '2025-01-01T00:00:00.000Z',
                until: '2025-01-02T00:00:00.000Z',
            },
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
    });

    it('rejects an InboxRefreshRequest missing the required since field', () => {
        // @ts-expect-error InboxRefreshRequest requires since
        const missingSince: InboxRefreshRequest = { until: new Date('2025-01-02T00:00:00Z') };

        expect(missingSince.until).toBeInstanceOf(Date);
    });

    it('handles a 202 Accepted empty-body response through the default HttpClient', async () => {
        const originalFetch = globalThis.fetch;
        const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 202 }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        try {
            const defaultClient = new Client('login', 'password');
            const request: InboxRefreshRequest = {
                deviceId: 'test-device-id',
                since: new Date('2025-01-01T00:00:00Z'),
                until: new Date('2025-01-02T00:00:00Z'),
                messageTypes: [IncomingMessageType.SMS, IncomingMessageType.DATA_SMS],
                webhookDelivery: WebhookDelivery.Batch,
            };

            // 202 Accepted with empty body and no Content-Type: the default
            // HttpClient text() path resolves to '' without throwing
            const result: unknown = await defaultClient.refreshInbox(request);
            expect(result).toBe('');

            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe(`${BASE_URL}/inbox/refresh`);
            expect(init).toMatchObject({ method: 'POST' });
            expect(JSON.parse((init as RequestInit).body as string)).toEqual({
                deviceId: 'test-device-id',
                since: '2025-01-01T00:00:00.000Z',
                until: '2025-01-02T00:00:00.000Z',
                messageTypes: ['SMS', 'DATA_SMS'],
                webhookDelivery: 'Batch',
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('rejects when the server responds with an error status', async () => {
        const request: InboxRefreshRequest = {
            since: new Date('2025-01-01T00:00:00Z'),
            until: new Date('2025-01-02T00:00:00Z'),
        };

        (mockHttpClient.post as jest.Mock).mockRejectedValue(new Error('HTTP error 500: internal error'));

        let caught: unknown;
        try {
            await client.refreshInbox(request);
        } catch (e) {
            caught = e;
        }

        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).message).toBe('HTTP error 500: internal error');

        expect(mockHttpClient.post).toHaveBeenCalledWith(
            `${BASE_URL}/inbox/refresh`,
            {
                since: '2025-01-01T00:00:00.000Z',
                until: '2025-01-02T00:00:00.000Z',
            },
            {
                "Content-Type": "application/json",
                "User-Agent": "android-sms-gateway/3.0 (client; js)",
                Authorization: expect.any(String),
            },
        );
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
                { ...message, priority: 0 },
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
                { ...message, priority: 0 },
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
});