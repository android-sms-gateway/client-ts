# 📱 SMSGate TypeScript Client

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stars][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]
[![npm Version][version-shield]][version-url]

A TypeScript-first client for the [SMSGate](https://sms-gate.app) API: send and track SMS messages through your Android devices with strict typing, Basic or JWT authentication, and a pluggable HTTP client. See the [client libraries overview](https://docs.sms-gate.app/integration/client-libraries/) for the full ecosystem.

## 📖 About

`android-sms-gateway` is a typed JS/TS library for the SMSGate 3rd-party API. It covers messages (send, state, listing, cancellation), inbox refresh, devices, webhooks, settings, logs, health checks, and the JWT token lifecycle, with full type definitions and a fetch-based HTTP client that you can replace with any implementation. Designed for server-side (Node.js) use: the API does not provide CORS headers, so the library cannot run in a browser.

## 📚 Table of Contents

- [📱 SMSGate TypeScript Client](#-smsgate-typescript-client)
  - [📖 About](#-about)
  - [📚 Table of Contents](#-table-of-contents)
  - [⭐ Features](#-features)
  - [📦 Installation](#-installation)
  - [🔑 Authentication](#-authentication)
    - [Basic Authentication](#basic-authentication)
    - [JWT Authentication](#jwt-authentication)
  - [🚀 Quickstart](#-quickstart)
  - [💻 Usage](#-usage)
  - [📖 API Reference](#-api-reference)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)

## ⭐ Features

- TypeScript-first with full type definitions out of the box
- Basic and JWT authentication; token generate and revoke
- Pluggable HTTP client (default: `fetch`)
- Webhooks, devices, settings, logs, and health checks
- Inbox refresh with webhook delivery modes
- Promise-based API, async/await ready
- Customizable base URL for private deployments

## 📦 Installation

```bash
npm install android-sms-gateway
```

Or with yarn (`yarn add android-sms-gateway`) or bun (`bun add android-sms-gateway`). Requires Node.js 18+.

## 🔑 Authentication

Two methods are supported: Basic authentication with account credentials, and JWT bearer tokens with scoped permissions. Pass an empty login string to switch to JWT.

### Basic Authentication

```typescript
const client = new Client(
    process.env.ANDROID_SMS_GATEWAY_LOGIN!,
    process.env.ANDROID_SMS_GATEWAY_PASSWORD!
);
```

### JWT Authentication

```typescript
const basicClient = new Client(
    process.env.ANDROID_SMS_GATEWAY_LOGIN!,
    process.env.ANDROID_SMS_GATEWAY_PASSWORD!
);

const token = await basicClient.generateToken({
    scopes: ['messages:send', 'messages:read'],
    ttl: 3600,
});

const jwtClient = new Client('', token.access_token);
```

## 🚀 Quickstart

```typescript
import Client, { MessagePriority } from 'android-sms-gateway';

const client = new Client(
    process.env.ANDROID_SMS_GATEWAY_LOGIN!,
    process.env.ANDROID_SMS_GATEWAY_PASSWORD!
);

const state = await client.send({
    phoneNumbers: ['+12025550123'],
    message: 'Hello from TypeScript',
    priority: MessagePriority.Default,
});

console.log('Message ID:', state.id);
```

## 💻 Usage

Beyond sending, the client covers message listing and cancellation, inbox listing and refresh, device management, webhooks, settings (get, update, patch), logs, health checks, and the token lifecycle. See [src/client.ts](https://github.com/android-sms-gateway/client-ts/blob/master/src/client.ts) for the complete method list with signatures and [src/domain.ts](https://github.com/android-sms-gateway/client-ts/blob/master/src/domain.ts) for the type definitions. Webhook payload types live in [src/webhooks.ts](https://github.com/android-sms-gateway/client-ts/blob/master/src/webhooks.ts).

## 📖 API Reference

- [Official API Reference](https://docs.sms-gate.app/integration/api/) - endpoints, payloads, and error codes
- [Authentication Guide](https://docs.sms-gate.app/integration/authentication/) - scopes and token management
- [Client libraries overview](https://docs.sms-gate.app/integration/client-libraries/)
- [Client source](https://github.com/android-sms-gateway/client-ts/blob/master/src/client.ts) - full method reference and examples

## 🤝 Contributing

Contributions are welcome. Open an issue to discuss major changes before submitting a pull request; PRs target the `master` branch.

## 📄 License

Distributed under the Apache License 2.0. See [LICENSE](https://github.com/android-sms-gateway/client-ts/blob/master/LICENSE).

<!-- Badge references: Shields.io style=for-the-badge is mandatory -->
[contributors-shield]: https://img.shields.io/github/contributors/android-sms-gateway/client-ts?style=for-the-badge
[contributors-url]: https://github.com/android-sms-gateway/client-ts/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/android-sms-gateway/client-ts?style=for-the-badge
[forks-url]: https://github.com/android-sms-gateway/client-ts/network/members
[stars-shield]: https://img.shields.io/github/stars/android-sms-gateway/client-ts?style=for-the-badge
[stars-url]: https://github.com/android-sms-gateway/client-ts/stargazers
[issues-shield]: https://img.shields.io/github/issues/android-sms-gateway/client-ts?style=for-the-badge
[issues-url]: https://github.com/android-sms-gateway/client-ts/issues
[license-shield]: https://img.shields.io/github/license/android-sms-gateway/client-ts?style=for-the-badge
[license-url]: https://github.com/android-sms-gateway/client-ts/blob/master/LICENSE
[version-shield]: https://img.shields.io/npm/v/android-sms-gateway?style=for-the-badge
[version-url]: https://www.npmjs.com/package/android-sms-gateway
