# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Bug Fixes

- **`send()` always transmits `priority`** — messages sent without an explicit priority now include `priority: 0` on the wire instead of omitting the field, matching the other client libraries byte-for-byte for reliable message-priority handling.

## [3.6.0] - 2026-08-20

### New Features

#### Message fields
- **Message priority** — `Message.priority` accepts a value in the range `-128..127` (default `0`); values greater than `99` bypass sending limits and delays. Use the exported `MessagePriority` constants (`Minimum`, `Default`, `BypassThreshold`, `Maximum`).
- **Scheduling and expiry** — `Message.validUntil` and `Message.scheduleAt` control how long a message stays valid and when it is delivered. `validUntil` is mutually exclusive with `ttl`, and `scheduleAt` must be in the future and no later than `validUntil`.

#### Message payloads
- **Text message payload** — `Message.textMessage` carries the message text as `{ text: string }`, the preferred replacement for the legacy `message` field.
- **Data message payload** — `Message.dataMessage` sends a binary message as `{ data: string, port: number }` with a base64-encoded payload and destination port.

Exactly one of `message`, `textMessage`, or `dataMessage` must be provided; the server rejects requests with none or more than one of them. The legacy `message` field is deprecated in favor of `textMessage`.