import {
    Message,
    MessageState,
    RegisterWebHookRequest,
    WebHook,
    Device,
    DeviceSettings,
    HealthResponse,
    LogEntry,
    MessagesExportRequest,
    TokenRequest,
    TokenResponse
} from "./domain";
import { HttpClient } from "./http";

export const BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

export class Client {
    private baseUrl: string;
    private httpClient: HttpClient;
    private defaultHeaders: Record<string, string>;

    /**
     * @param login The login to use for authentication, pass empty string for JWT
     * @param password The password or JWT to use for authentication
     * @param httpClient The HTTP client to use for requests
     * @param baseUrl The base URL to use for requests. Defaults to {@link BASE_URL}.
     */
    constructor(
        login: string,
        password: string,
        httpClient?: HttpClient,
        baseUrl = BASE_URL
    ) {
        this.baseUrl = baseUrl;
        this.httpClient = httpClient || this.getDefaultHttpClient();
        this.defaultHeaders = {
            "User-Agent": "android-sms-gateway/3.0 (client; js)",
        };

        if (login === "") {
            if (password === "") {
                throw new Error("Token is required for JWT authentication");
            }
            this.defaultHeaders["Authorization"] = `Bearer ${password}`;
        } else {
            if (password === "") {
                throw new Error("Password is required when using Basic Auth with login");
            }
            this.defaultHeaders["Authorization"] = `Basic ${btoa(`${login}:${password}`)}`;
        }
    }

    /**
     * Gets the default HTTP client implementation
     */
    private getDefaultHttpClient(): HttpClient {
        const handleResponse = async (response: Response): Promise<any> => {
            if (response.status === 204) {
                return null;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error ${response.status}: ${text}`);
            }

            const contentType = response.headers.get("Content-Type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                return await response.text();
            }
        };

        return {
            get: async <T>(url: string, headers?: Record<string, string>): Promise<T> => {
                const response = await fetch(url, { method: 'GET', headers });
                return handleResponse(response);
            },
            post: async <T>(url: string, body: any, headers?: Record<string, string>): Promise<T> => {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body)
                });
                return handleResponse(response);
            },
            put: async <T>(url: string, body: any, headers?: Record<string, string>): Promise<T> => {
                const response = await fetch(url, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body)
                });
                return handleResponse(response);
            },
            patch: async <T>(url: string, body: any, headers?: Record<string, string>): Promise<T> => {
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body)
                });
                return handleResponse(response);
            },
            delete: async <T>(url: string, headers?: Record<string, string>): Promise<T> => {
                const response = await fetch(url, { method: 'DELETE', headers });
                return handleResponse(response);
            },
        };
    }

    /**
     * Retrieves messages with filtering, pagination, and sorting
     * @param options - Optional filters and pagination
     * @param options.from - Start date (RFC 3339)
     * @param options.to - End date (RFC 3339)
     * @param options.state - Filter by processing state
     * @param options.deviceId - Filter by device ID
     * @param options.limit - Maximum number of messages (1-100, default 50)
     * @param options.offset - Number of messages to skip
     * @param options.includeContent - Include message content
     * @param options.sort - Sort order (created_at or -created_at)
     * @returns An array of message states
     */
    async listMessages(options?: {
        from?: Date;
        to?: Date;
        state?: string;
        deviceId?: string;
        limit?: number;
        offset?: number;
        includeContent?: boolean;
        sort?: 'created_at' | '-created_at';
    }): Promise<MessageState[]> {
        const url = new URL(`${this.baseUrl}/messages`);
        if (options?.from) {
            url.searchParams.append('from', options.from.toISOString());
        }
        if (options?.to) {
            url.searchParams.append('to', options.to.toISOString());
        }
        if (options?.state) {
            url.searchParams.append('state', options.state);
        }
        if (options?.deviceId) {
            url.searchParams.append('deviceId', options.deviceId);
        }
        if (options?.limit !== undefined) {
            url.searchParams.append('limit', options.limit.toString());
        }
        if (options?.offset !== undefined) {
            url.searchParams.append('offset', options.offset.toString());
        }
        if (options?.includeContent !== undefined) {
            url.searchParams.append('includeContent', options.includeContent.toString());
        }
        if (options?.sort) {
            url.searchParams.append('sort', options.sort);
        }

        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<MessageState[]>(url.toString(), headers);
    }

    /**
     * Sends a new message to the API
     * @param request - The message to send
     * @param options - Optional parameters
     * @param options.skipPhoneValidation - Whether to skip phone number validation
     * @returns The state of the message after sending
     */
    async send(request: Message, options?: { skipPhoneValidation?: boolean }): Promise<MessageState> {
        const url = new URL(`${this.baseUrl}/message`);
        if (options?.skipPhoneValidation !== undefined) {
            url.searchParams.append('skipPhoneValidation', options.skipPhoneValidation.toString());
        }

        const headers = {
            "Content-Type": "application/json",
            ...this.defaultHeaders,
        };

        return this.httpClient.post<MessageState>(url.toString(), request, headers);
    }

    /**
     * Retrieves the state of an SMS message from the API
     * @param messageId - The ID of the message to retrieve the state for
     * @returns The state of the message
     */
    async getState(messageId: string): Promise<MessageState> {
        const url = `${this.baseUrl}/message/${messageId}`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<MessageState>(url, headers);
    }

    /**
     * Retrieves a list of registered webhooks from the API
     * @returns An array of webhooks
     */
    async getWebhooks(): Promise<WebHook[]> {
        const url = `${this.baseUrl}/webhooks`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<WebHook[]>(url, headers);
    }

    /**
     * Registers a new webhook
     * @param request - The webhook to register
     * @returns The registered webhook
     */
    async registerWebhook(request: RegisterWebHookRequest): Promise<WebHook> {
        const url = `${this.baseUrl}/webhooks`;
        const headers = {
            "Content-Type": "application/json",
            ...this.defaultHeaders,
        };

        return this.httpClient.post<WebHook>(url, request, headers);
    }

    /**
     * Removes a webhook by its ID
     * @param webhookId - The ID of the webhook to remove
     */
    async deleteWebhook(webhookId: string): Promise<void> {
        const url = `${this.baseUrl}/webhooks/${webhookId}`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.delete<void>(url, headers);
    }

    /**
     * Get a list of registered devices
     * @returns An array of registered devices
     */
    async getDevices(): Promise<Device[]> {
        const url = `${this.baseUrl}/devices`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<Device[]>(url, headers);
    }

    /**
     * Remove a device by ID
     * @param deviceId - The ID of the device to remove
     */
    async deleteDevice(deviceId: string): Promise<void> {
        const url = `${this.baseUrl}/devices/${deviceId}`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.delete<void>(url, headers);
    }

    /**
     * Check if the service is healthy
     * @returns A promise that resolves to the health response
     */
    async getHealth(): Promise<HealthResponse> {
        const url = `${this.baseUrl}/health`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<HealthResponse>(url, headers);
    }

    /**
     * Request inbox messages export
     * @param request - The export request parameters
     */
    async exportInbox(request: MessagesExportRequest): Promise<void> {
        const url = `${this.baseUrl}/inbox/export`;
        const headers = {
            "Content-Type": "application/json",
            ...this.defaultHeaders,
        };

        const exportRequest = {
            deviceId: request.deviceId,
            since: request.since.toISOString(),
            until: request.until.toISOString(),
        };

        return this.httpClient.post<void>(url, exportRequest, headers);
    }

    /**
     * Get logs within a specified time range
     * @param from - The start of the time range (optional)
     * @param to - The end of the time range (optional)
     * @returns An array of log entries
     */
    async getLogs(from?: Date, to?: Date): Promise<LogEntry[]> {
        const url = new URL(`${this.baseUrl}/logs`);
        if (from) {
            url.searchParams.append('from', from.toISOString());
        }
        if (to) {
            url.searchParams.append('to', to.toISOString());
        }

        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<LogEntry[]>(url.toString(), headers);
    }

    /**
     * Get settings for the user
     * @returns The user's settings
     */
    async getSettings(): Promise<DeviceSettings> {
        const url = `${this.baseUrl}/settings`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.get<DeviceSettings>(url, headers);
    }

    /**
     * Update settings for the user
     * @param settings - The new settings to apply
     */
    async updateSettings(settings: DeviceSettings): Promise<void> {
        const url = `${this.baseUrl}/settings`;
        const headers = {
            "Content-Type": "application/json",
            ...this.defaultHeaders,
        };

        return this.httpClient.put<void>(url, settings, headers);
    }

    /**
     * Partially update settings for the user
     * @param settings - The partial settings to update
     */
    async patchSettings(settings: Partial<DeviceSettings>): Promise<void> {
        const url = `${this.baseUrl}/settings`;
        const headers = {
            "Content-Type": "application/json",
            ...this.defaultHeaders,
        };

        return this.httpClient.patch<void>(url, settings, headers);
    }

    /**
     * Generate a new JWT token with specified scopes and TTL
     * @param request - The token request parameters
     * @returns The generated token response
     */
    async generateToken(request: TokenRequest): Promise<TokenResponse> {
        const url = `${this.baseUrl}/auth/token`;
        const headers = {
            "Content-Type": "application/json",
            ...this.defaultHeaders,
        };

        return this.httpClient.post<TokenResponse>(url, request, headers);
    }

    /**
     * Revoke a JWT token by its ID
     * @param jti - The JWT token ID to revoke
     */
    async revokeToken(jti: string): Promise<void> {
        const url = `${this.baseUrl}/auth/token/${jti}`;
        const headers = {
            ...this.defaultHeaders,
        };

        return this.httpClient.delete<void>(url, headers);
    }
}