# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### New Features

- **Message state timestamp** — `MessageState.createdAt` reports when a message was created (RFC 3339).

## [4.0.0] - 2026-09-28

### New Features

- **Outgoing MMS** — `Message.mmsMessage` sends an MMS with an optional `subject`, `text`, and base64-encoded `attachments` (`contentType`, `name`, `data`). Unset fields are omitted from the request body.

### Breaking Changes

- **`Message` enforces a single payload** — `Message` is now a union type, so providing more than one of `message`, `textMessage`, `dataMessage`, or `mmsMessage` is a compile-time error instead of a runtime `400`.

## [3.6.1] - 2026-09-22

### Bug Fixes

- **`send()` always transmits `priority`** — messages sent without an explicit priority now include `priority: 0` on the wire instead of omitting the field, matching the other client libraries byte-for-byte.

## [3.6.0] - 2026-08-20

### New Features

#### Message fields
- **Message priority** — `Message.priority` accepts a value in the range `-128..127` (default `0`); values greater than `99` bypass sending limits and delays. Use the exported `MessagePriority` constants (`Minimum`, `Default`, `BypassThreshold`, `Maximum`).
- **Scheduling and expiry** — `Message.validUntil` and `Message.scheduleAt` control how long a message stays valid and when it is delivered. `validUntil` is mutually exclusive with `ttl`, and `scheduleAt` must be in the future and no later than `validUntil`.

#### Message payloads
- **Text message payload** — `Message.textMessage` carries the message text as `{ text: string }`, the preferred replacement for the legacy `message` field.
- **Data message payload** — `Message.dataMessage` sends a binary message as `{ data: string, port: number }` with a base64-encoded payload and destination port.

Exactly one of `message`, `textMessage`, or `dataMessage` must be provided; the server rejects requests with none or more than one of them. The legacy `message` field is deprecated in favor of `textMessage`.