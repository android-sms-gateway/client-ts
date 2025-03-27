# 📱 SMS Gateway for Android™ JS/TS API Client

[![npm Version](https://img.shields.io/npm/v/android-sms-gateway.svg?style=for-the-badge)](https://www.npmjs.com/package/android-sms-gateway)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=for-the-badge)](https://github.com/android-sms-gateway/client-ts/blob/master/LICENSE)
[![Downloads](https://img.shields.io/npm/dw/android-sms-gateway.svg?style=for-the-badge)](https://www.npmjs.com/package/android-sms-gateway)
[![GitHub Issues](https://img.shields.io/github/issues/android-sms-gateway/client-ts.svg?style=for-the-badge)](https://github.com/android-sms-gateway/client-ts/issues)
[![GitHub Stars](https://img.shields.io/github/stars/android-sms-gateway/client-ts.svg?style=for-the-badge)](https://github.com/android-sms-gateway/client-ts/stargazers)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg?style=for-the-badge)](https://www.typescriptlang.org/)

A TypeScript-first client for seamless integration with the [SMS Gateway for Android](https://sms-gate.app) API. Programmatically send SMS messages through your Android devices with strict typing and modern JavaScript features.

**Note**: The API doesn't provide CORS headers, so the library cannot be used in a browser environment directly.

## 📖 Table of Contents
- [📱 SMS Gateway for Android™ JS/TS API Client](#-sms-gateway-for-android-jsts-api-client)
  - [📖 Table of Contents](#-table-of-contents)
  - [✨ Features](#-features)
  - [⚙️ Requirements](#️-requirements)
  - [📦 Installation](#-installation)
  - [🚀 Quickstart](#-quickstart)
    - [Basic Usage](#basic-usage)
    - [Webhook Management](#webhook-management)
  - [🤖 Client Guide](#-client-guide)
    - [Client Configuration](#client-configuration)
    - [Core Methods](#core-methods)
    - [Type Definitions](#type-definitions)
  - [🌐 HTTP Clients](#-http-clients)
  - [🔒 Security Notes](#-security-notes)
  - [📚 API Reference](#-api-reference)
  - [👥 Contributing](#-contributing)
    - [Development Setup](#development-setup)
  - [📄 License](#-license)

## ✨ Features
- **TypeScript Ready**: Full type definitions out of the box
- **Flexible HTTP Clients**: Works with any HTTP library (fetch, axios, node-fetch, etc.)
- **Promise-based API**: Async/await ready
- **Webhook Management**: Create, read, and delete webhooks
- **Customizable Base URL**: Point to different API endpoints
- **Server-Side Focus**: Designed for Node.js environments

## ⚙️ Requirements
- Node.js v18+
- npm/yarn/bun package manager

## 📦 Installation

```bash
npm install android-sms-gateway
# or
yarn add android-sms-gateway
# or
bun add android-sms-gateway
```

## 🚀 Quickstart

### Basic Usage
```typescript
import Client from 'android-sms-gateway';

// Create a fetch-based HTTP client
const httpFetchClient = {
    get: async (url, headers) => {
        const response = await fetch(url, {
            method: "GET",
            headers
        });

        return response.json();
    },
    post: async (url, body, headers) => {
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });

        return response.json();
    },
    delete: async (url, headers) => {
        const response = await fetch(url, {
            method: "DELETE",
            headers
        });

        return response.json();
    }
};

// Initialize client
const api = new Client(
    process.env.ANDROID_SMS_GATEWAY_LOGIN!,
    process.env.ANDROID_SMS_GATEWAY_PASSWORD!,
    httpFetchClient
);

// Send message
const message = {
    phoneNumbers: ['+1234567890'],
    message: 'Secure OTP: 123456 🔐'
};

async function sendSMS() {
    try {
        const state = await api.send(message);
        console.log('Message ID:', state.id);
        
        // Check status after 5 seconds
        setTimeout(async () => {
            const updatedState = await api.getState(state.id);
            console.log('Message status:', updatedState.status);
        }, 5000);
    } catch (error) {
        console.error('Sending failed:', error);
    }
}

sendSMS();
```

### Webhook Management
```typescript
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
```

## 🤖 Client Guide

### Client Configuration

The `Client` class accepts the following constructor arguments:

| Argument     | Description                | Default                                  |
| ------------ | -------------------------- | ---------------------------------------- |
| `login`      | Username                   | **Required**                             |
| `password`   | Password                   | **Required**                             |
| `httpClient` | HTTP client implementation | **Required**                             |
| `baseUrl`    | API base URL               | `"https://api.sms-gate.app/3rdparty/v1"` |

### Core Methods
| Method                                             | Description              | Returns                 |
| -------------------------------------------------- | ------------------------ | ----------------------- |
| `send(message: Message)`                           | Send SMS message         | `Promise<MessageState>` |
| `getState(messageId: string)`                      | Check message status     | `Promise<MessageState>` |
| `getWebhooks()`                                    | List registered webhooks | `Promise<WebHook[]>`    |
| `registerWebhook(request: RegisterWebHookRequest)` | Register new webhook     | `Promise<WebHook>`      |
| `deleteWebhook(webhookId: string)`                 | Remove webhook           | `Promise<void>`         |

### Type Definitions
```typescript
interface Message {
    id?: string | null;
    message: string;
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

interface WebHook {
    id: string;
    event: WebHookEventType;
    url: string;
}
```

For more details, see the [`domain.ts`](./src/domain.ts).

## 🌐 HTTP Clients

The library doesn't come with built-in HTTP clients. Instead, you should provide your own implementation of the `HttpClient` interface:

```typescript
interface HttpClient {
    get<T>(url: string, headers?: Record<string, string>): Promise<T>;
    post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
    delete<T>(url: string, headers?: Record<string, string>): Promise<T>;
}
```

## 🔒 Security Notes

⚠️ **Important Security Practices**
- Always store credentials in environment variables
- Never expose credentials in client-side code
- Use HTTPS for all production communications

## 📚 API Reference
For complete API documentation including all available methods, request/response schemas, and error codes, visit:
[📘 Official API Documentation](https://docs.sms-gate.app/integration/api/)

## 👥 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Setup
```bash
git clone https://github.com/android-sms-gateway/client-ts.git
cd client-ts
bun install
bun run build
bun test
```

## 📄 License
Distributed under the Apache 2.0 License. See [LICENSE](LICENSE) for more information.

---

**Note**: Android is a trademark of Google LLC. This project is not affiliated with or endorsed by Google.
