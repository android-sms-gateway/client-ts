# 📱 SMSGate JS/TS API Client

[![npm Version](https://img.shields.io/npm/v/android-sms-gateway.svg?style=for-the-badge)](https://www.npmjs.com/package/android-sms-gateway)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=for-the-badge)](https://github.com/android-sms-gateway/client-ts/blob/master/LICENSE)
[![Downloads](https://img.shields.io/npm/dw/android-sms-gateway.svg?style=for-the-badge)](https://www.npmjs.com/package/android-sms-gateway)
[![GitHub Issues](https://img.shields.io/github/issues/android-sms-gateway/client-ts.svg?style=for-the-badge)](https://github.com/android-sms-gateway/client-ts/issues)
[![GitHub Stars](https://img.shields.io/github/stars/android-sms-gateway/client-ts.svg?style=for-the-badge)](https://github.com/android-sms-gateway/client-ts/stargazers)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg?style=for-the-badge)](https://www.typescriptlang.org/)

A TypeScript-first client for seamless integration with the [SMSGate](https://sms-gate.app) API. Send and receive SMS messages programmatically through your Android devices with strict typing and modern JavaScript features.

**Note**: The API does not provide CORS headers, so the library cannot be used in a browser environment directly.

## 📖 Table of Contents

- [📱 SMSGate JS/TS API Client](#-smsgate-jsts-api-client)
  - [📖 Table of Contents](#-table-of-contents)
  - [📖 About The Project](#-about-the-project)
  - [✨ Features](#-features)
  - [🚀 Getting Started](#-getting-started)
    - [Requirements](#requirements)
    - [Installation](#installation)
  - [📖 Usage](#-usage)
    - [Authentication](#authentication)
    - [Quickstart](#quickstart)
    - [Messages](#messages)
    - [Webhook Management](#webhook-management)
    - [Device Management](#device-management)
    - [Inbox](#inbox)
    - [Health Check](#health-check)
    - [Log Retrieval](#log-retrieval)
    - [Settings Management](#settings-management)
    - [JWT Token Management](#jwt-token-management)
    - [E2E Encryption](#e2e-encryption)
    - [HTTP Clients](#http-clients)
    - [Type Definitions](#type-definitions)
  - [⚙️ Configuration](#️-configuration)
    - [Client Constructor](#client-constructor)
    - [Environment Variables](#environment-variables)
  - [🛡️ Security Notes](#️-security-notes)
  - [📚 API Reference](#-api-reference)
  - [👥 Contributing](#-contributing)
    - [Development Setup](#development-setup)
  - [📜 License](#-license)
  - [📞 Contact](#-contact)
  - [🙏 Acknowledgments](#-acknowledgments)

## 📖 About The Project

SMSGate JS/TS API Client is the official client library for the SMSGate API. It lets you:

- Send SMS messages through registered Android devices
- Track message state (pending, sent, delivered, failed, cancelled)
- Receive messages via webhooks and read the device inbox
- Manage devices, webhooks, settings, and JWT tokens
- Encrypt message content end-to-end with the target device's public key

The client is server-side focused, promise-based, and works with any HTTP library.

## ✨ Features

- **TypeScript Ready**: Full type definitions out of the box
- **Flexible HTTP Clients**: Works with any HTTP library (fetch, axios, node-fetch, etc.)
- **Promise-based API**: Async/await ready
- **Message Management**: Send, list, filter, and cancel messages
- **E2E Encryption**: Hybrid RSA-OAEP + AES-256-GCM encryption of message bodies and phone numbers
- **Webhook Management**: Create, read, and delete webhooks
- **Device Management**: List and remove devices
- **Inbox Access**: List incoming messages and download MMS attachments
- **Health Check**: Monitor system status
- **Log Retrieval**: Get system logs with time filtering
- **Settings Management**: Get, update, and partially update settings
- **JWT Authentication**: Scoped tokens with TTL and revocation
- **Customizable Base URL**: Point to different API endpoints (Cloud or Private Server)
- **Server-Side Focus**: Designed for Node.js environments

## 🚀 Getting Started

### Requirements

- Node.js v18+ (the default client uses the global `fetch` API)
- npm, yarn, or bun package manager
- Bun runtime for development (build and test tooling)

### Installation

```bash
npm install android-sms-gateway
# or
yarn add android-sms-gateway
# or
bun add android-sms-gateway
```

## 📖 Usage

### Authentication

The client supports two authentication methods. It detects the method from the `login` constructor argument:

- If `login` is a non-empty string: **Basic Authentication** (username + password)
- If `login` is an empty string: **JWT Authentication** (bearer token)

JWT is the recommended approach for production environments because it supports scoped permissions and TTL-based expiry.

**Basic Authentication** is simple and suitable for development, testing, and simple integrations.

**JWT Authentication** provides enhanced security and fine-grained access control, suitable for production environments and systems with multiple components needing different access levels.

### Quickstart

```typescript
import Client from 'android-sms-gateway';

// First, create a client with Basic Auth to generate a JWT token
const basicAuthClient = new Client(
    process.env.ANDROID_SMS_GATEWAY_LOGIN!,
    process.env.ANDROID_SMS_GATEWAY_PASSWORD!
);

// Generate a JWT token with specific scopes
async function generateJWTToken() {
    try {
        const tokenRequest = {
            scopes: [
                "messages:send",
                "messages:read",
                "devices:list"
            ],
            ttl: 3600 // Token expires in 1 hour
        };

        const tokenResponse = await basicAuthClient.generateToken(tokenRequest);
        console.log('JWT Token generated, expires at:', tokenResponse.expires_at);
        return tokenResponse.access_token;
    } catch (error) {
        console.error('Token generation failed:', error);
        throw error;
    }
}

// Initialize client with JWT Authentication
async function initializeJWTClient() {
    const jwtToken = await generateJWTToken();

    // Empty string for login, token for password
    const jwtClient = new Client(
        "", // Empty string for login when using JWT
        jwtToken // JWT token
    );

    return jwtClient;
}

// Send message using JWT Authentication
async function sendSMS() {
    try {
        const jwtClient = await initializeJWTClient();

        const message = {
            phoneNumbers: ['+1234567890'],
            message: 'Secure OTP: 123456'
        };

        const state = await jwtClient.send(message);
        console.log('Message ID:', state.id);

        // Check status after 5 seconds
        setTimeout(async () => {
            const updatedState = await jwtClient.getState(state.id);
            console.log('Message status:', updatedState.state);
        }, 5000);
    } catch (error) {
        console.error('Sending failed:', error);
    }
}

// Revoke a JWT token
async function revokeJWTToken(jti: string) {
    try {
        await basicAuthClient.revokeToken(jti);
        console.log('JWT token revoked successfully');
    } catch (error) {
        console.error('Token revocation failed:', error);
    }
}

sendSMS();
```

### Messages

```typescript
// Send a text message
const state = await api.send({
    phoneNumbers: ['+1234567890'],
    textMessage: { text: 'Hello from SMSGate' },
});
console.log('Message ID:', state.id);

// Send a binary (data) message
await api.send({
    phoneNumbers: ['+1234567890'],
    dataMessage: { data: Buffer.from('payload').toString('base64'), port: 1234 },
});

// List messages with filtering and pagination
const messages = await api.listMessages({
    state: 'Sent',
    deviceId: 'device-id',
    limit: 50,
    offset: 0,
    includeContent: true,
    sort: '-created_at',
});

// Check message status
const currentState = await api.getState(state.id);

// Cancel a pending message
await api.cancelMessage(state.id);
```

Note: the top-level `message` field on `Message` is deprecated in favor of `textMessage` (text) and `dataMessage` (binary, base64-encoded `data` with destination `port`).

### Webhook Management

```typescript
import Client, { WebHookEventType } from 'android-sms-gateway';

// Create webhook
const webhook = {
    url: 'https://your-api.com/sms-callback',
    event: WebHookEventType.SmsReceived,
};

api.registerWebhook(webhook)
    .then(created => console.log('Webhook created:', created.id))
    .catch(console.error);

// List webhooks
api.getWebhooks()
    .then(webhooks => console.log('Active webhooks:', webhooks.length));

// Delete a webhook
api.deleteWebhook('webhook-id')
    .then(() => console.log('Webhook removed'))
    .catch(console.error);
```

Available webhook events: `sms:received`, `sms:sent`, `sms:delivered`, `sms:failed`, `sms:cancelled`, `system:ping`, `app:started`, `mms:received`, `mms:downloaded` (see `WebHookEventType`).

### Device Management

```typescript
// List devices
api.getDevices()
    .then(devices => console.log('Devices:', devices.map(d => d.name)))
    .catch(console.error);

// Remove a device
api.deleteDevice('device-id')
    .then(() => console.log('Device removed'))
    .catch(console.error);
```

### Inbox

```typescript
// List incoming messages
const incoming = await api.listInboxMessages({
    type: 'SMS',
    deviceId: 'device-id',
    from: new Date('2024-01-01T00:00:00Z'),
    to: new Date('2024-01-02T00:00:00Z'),
    includeAttachments: true,
    limit: 100,
});

// Download a raw MMS attachment by message ID and part ID
const bytes: ArrayBuffer = await api.downloadAttachment(messageId, partId);

// Export inbox messages
const since = new Date('2024-01-01T00:00:00Z');
const until = new Date('2024-01-02T00:00:00Z');

api.exportInbox({ deviceId: 'device-id', since, until })
    .then(() => console.log('Inbox export requested'))
    .catch(console.error);
```

### Health Check

```typescript
// Check system health
api.getHealth()
    .then(health => {
        console.log('System status:', health.status);
        console.log('Checks:', Object.keys(health.checks).length);
    })
    .catch(console.error);
```

### Log Retrieval

```typescript
// Get logs
const from = new Date('2024-01-01T00:00:00Z');
const to = new Date('2024-01-02T00:00:00Z');

api.getLogs(from, to)
    .then(logs => console.log('Logs retrieved:', logs.length))
    .catch(console.error);
```

### Settings Management

```typescript
// Get settings
api.getSettings()
    .then(settings => console.log('Settings:', settings))
    .catch(console.error);

// Update settings
const newSettings = {
    messages: { limitPeriod: 'PerDay', limitValue: 100 },
    webhooks: { internetRequired: true, retryCount: 3 },
};

api.updateSettings(newSettings)
    .then(() => console.log('Settings updated'))
    .catch(console.error);

// Partially update settings
const partialSettings = {
    messages: { limitValue: 200 },
};

api.patchSettings(partialSettings)
    .then(() => console.log('Settings partially updated'))
    .catch(console.error);
```

### JWT Token Management

```typescript
// Generate a token with scopes and TTL
const token = await api.generateToken({
    scopes: ['messages:send', 'devices:list'],
    ttl: 3600, // seconds
});
console.log(token.access_token, token.expires_at);

// Revoke a token by its ID (jti)
await api.revokeToken(token.id);
```

### E2E Encryption

Pass `deviceId` in the send options to encrypt a message end-to-end. The client resolves the device from the device listing, encrypts the message body (and every phone number) with the device's public key, and marks the message with `isEncrypted: true`.

```typescript
const state = await api.send(
    {
        phoneNumbers: ['+1234567890'],
        textMessage: { text: 'Secret payload' },
    },
    { deviceId: 'device-id' } // enables E2E encryption
);
```

The wire format is `$rsa-oaep-aes-256-gcm$v=1$k={keyVersion}${base64(encrypted_aes_key)}${base64(iv)}${base64(ciphertext || tag)}` (hybrid RSA-OAEP/SHA-256 wrapping a fresh AES-256-GCM key per value).

When the target device has no public key, the message is sent in plaintext (the `deviceId` is still preserved for routing). A typed `E2EError` is still thrown when `deviceId` is empty, the device is not found in the listing, or the device has a `publicKey` but no `keyVersion`:

| Code                 | Meaning                                            |
| -------------------- | -------------------------------------------------- |
| `DEVICE_ID_REQUIRED` | `deviceId` is empty or whitespace                  |
| `DEVICE_NOT_FOUND`   | Device not found in the device listing             |
| `E2E_NOT_CONFIGURED` | Device has a `publicKey` but no `keyVersion`       |
| `INVALID_FORMAT`     | Encrypted value does not match the E2E wire format |

Device lookups are cached per `deviceId` for 60 seconds to avoid re-fetching the listing on every send.

### HTTP Clients

The library ships with a fetch-based HTTP client. You can provide your own implementation of the `HttpClient` interface:

```typescript
interface HttpClient {
    get<T>(url: string, headers?: Record<string, string>): Promise<T>;
    getBinary?(url: string, headers?: Record<string, string>): Promise<ArrayBuffer>;
    post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    put<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    patch<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    delete<T>(url: string, headers?: Record<string, string>): Promise<T>;
}
```

`getBinary` is optional and only required for `downloadAttachment()`; calling it with a client that does not implement `getBinary` throws.

### Type Definitions

```typescript
interface Message {
    id?: string | null;
    deviceId?: string | null;
    /** @deprecated Use textMessage or dataMessage */
    message: string;
    textMessage?: { text: string } | null;
    dataMessage?: { data: string; port: number } | null; // data is base64-encoded
    isEncrypted?: boolean;
    ttl?: number | null;
    phoneNumbers: string[];
    simNumber?: number | null;
    withDeliveryReport?: boolean | null;
}

interface MessageState {
    id: string;
    state: ProcessState;
    recipients: RecipientState[];
}

enum ProcessState {
    Pending, Cancelling, Cancelled, Processed, Sent, Delivered, Failed
}

interface Device {
    id: string;
    name: string;
    createdAt: string;
    lastSeen: string;
    updatedAt: string;
    deletedAt?: string | null;
    publicKey?: string | null;  // base64 (NO_WRAP) X.509 SPKI DER, for E2E encryption
    keyVersion?: number | null; // key version for rotation tracking
}

interface WebHook {
    id: string;
    event: WebHookEventType;
    url: string;
    deviceId: string;
}

interface DeviceSettings {
    messages?: SettingsMessages;
    webhooks?: SettingsWebhooks;
    gateway?: SettingsGateway;
    encryption?: SettingsEncryption;
    logs?: SettingsLogs;
    ping?: SettingsPing;
}

interface HealthResponse {
    status: HealthStatus;
    version: string;
    releaseId: number;
    checks: { [checkName: string]: HealthCheck };
}

interface LogEntry {
    id: number;
    createdAt: string;
    module: string;
    priority: LogEntryPriority;
    message: string;
    context?: Record<string, string>;
}

interface IncomingMessage {
    id: string;
    type: string; // SMS, DATA_SMS, MMS, MMS_DOWNLOADED
    sender: string;
    contentPreview: string;
    createdAt: string;
    recipient?: string;
    simNumber?: number;
    attachments?: IncomingMessageAttachment[];
}

interface TokenRequest {
    scopes: string[];
    ttl?: number; // seconds
}

interface TokenResponse {
    access_token: string;
    token_type: string;
    id: string;
    expires_at: string;
}
```

For the complete type surface, see [`src/domain.ts`](./src/domain.ts) (webhook event types, webhook payloads, MMS payloads, settings types, enums) and [`src/encryption.ts`](./src/encryption.ts) (E2E helpers and error codes).

## ⚙️ Configuration

### Client Constructor

The `Client` class accepts the following constructor arguments:

| Argument     | Description                       | Default                                  |
| ------------ | --------------------------------- | ---------------------------------------- |
| `login`      | Username, or empty string for JWT | **Required**                             |
| `password`   | Password, or JWT token            | **Required**                             |
| `httpClient` | HTTP client implementation        | fetch-based default                      |
| `baseUrl`    | API base URL                      | `"https://api.sms-gate.app/3rdparty/v1"` |

**Basic Authentication:**

```typescript
const api = new Client(
    process.env.ANDROID_SMS_GATEWAY_LOGIN!,  // Username
    process.env.ANDROID_SMS_GATEWAY_PASSWORD!  // Password
);
```

**JWT Authentication:**

```typescript
const api = new Client(
    "",  // Empty string for login when using JWT
    jwtToken  // JWT token
);
```

### Environment Variables

The library itself does not read environment variables; the examples use them as a convention for storing credentials outside of source code:

| Variable                       | Required         | Description  |
| ------------------------------ | ---------------- | ------------ |
| `ANDROID_SMS_GATEWAY_LOGIN`    | Yes (Basic Auth) | API username |
| `ANDROID_SMS_GATEWAY_PASSWORD` | Yes (Basic Auth) | API password |

## 🛡️ Security Notes

- Always store credentials in environment variables
- Never expose credentials in client-side code
- Use HTTPS for all production communications
- Rotate passwords regularly and use strong, unique passwords
- Use appropriate TTL values for JWT tokens based on your security requirements
- Apply the principle of least privilege when granting token scopes
- Implement proper token revocation workflows
- Use E2E encryption (`deviceId` send option) for sensitive message content

## 📚 API Reference

For complete API documentation including all available methods, request/response schemas, and error codes, visit:
[Official API Documentation](https://docs.sms-gate.app/integration/api/)

## 👥 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Setup

The project uses Bun for build and test tooling:

```bash
git clone https://github.com/android-sms-gateway/client-ts.git
cd client-ts
bun install
bun run build
bun test
```

## 📜 License

Distributed under the Apache 2.0 License. See [LICENSE](LICENSE) for more information.

## 📞 Contact

- Project homepage: [https://sms-gate.app](https://sms-gate.app)
- Issues: [GitHub Issues](https://github.com/android-sms-gateway/client-ts/issues)

## 🙏 Acknowledgments

Android is a trademark of Google LLC. This project is not affiliated with or endorsed by Google.
