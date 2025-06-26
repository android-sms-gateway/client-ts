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
    WebHook,
    WebHookEventType
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
});