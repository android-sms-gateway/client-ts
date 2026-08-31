export enum ProcessState {
    Pending = "Pending",
    Cancelling = "Cancelling",
    Cancelled = "Cancelled",
    Processed = "Processed",
    Sent = "Sent",
    Delivered = "Delivered",
    Failed = "Failed",
}

/**
 * Represents the state of a recipient of an SMS message.
 */
export interface RecipientState {
    /**
     * The phone number of the recipient.
     */
    phoneNumber: string;

    /**
     * The state of the recipient.
     */
    state: ProcessState;

    /**
     * An optional error message, if the recipient failed to receive the message.
     */
    error?: string | null;
}

/**
 * Represents the state of an SMS message.
 */
export interface MessageState {
    /**
     * The ID of the message.
     */
    id: string;

    /**
     * The state of the message.
     */
    state: ProcessState;

    /**
     * The list of recipients' states for the message.
     */
    recipients: RecipientState[];
}

/**
 * The text message payload of an SMS message.
 */
export interface TextMessagePayload {
    /**
     * The message content.
     */
    text: string;
}

/**
 * The data message payload of a binary SMS message.
 */
export interface DataMessagePayload {
    /**
     * The base64-encoded payload.
     */
    data: string;

    /**
     * The destination port.
     */
    port: number;
}

/**
 * A single attachment of an MMS message.
 */
export interface MmsAttachment {
    /**
     * The MIME type of the attachment (e.g. `image/png`).
     */
    contentType: string;

    /**
     * The optional file name of the attachment.
     * Omitted from the wire body when not set.
     * @default null
     */
    name?: string | null;

    /**
     * The base64-encoded attachment content.
     */
    data: string;
}

/**
 * The MMS message payload of a message.
 *
 * `attachments` is omitted from the wire body entirely when empty.
 * `subject` and `text` are omitted when not set.
 */
export interface MmsMessagePayload {
    /**
     * The optional subject of the MMS.
     * @default null
     */
    subject?: string | null;

    /**
     * The optional text body of the MMS.
     * @default null
     */
    text?: string | null;

    /**
     * The list of attachments.
     * Omitted from the wire body entirely when empty.
     * @default null
     */
    attachments?: MmsAttachment[] | null;
}

/**
 * Constants for the priority of a message.
 * Messages with values greater than 99 will bypass limits and delays.
 */
export const MessagePriority = {
    Minimum: -128,
    Default: 0,
    BypassThreshold: 100,
    Maximum: 127,
} as const;

/**
 * The fields common to all SMS message variants.
 */
interface MessageCommon {
    /**
     * The ID of the message, will be generated if not provided.
     * @default null
     */
    id?: string | null;

    /**
     * The optional device ID for explicit device selection.
     * @default null
     */
    deviceId?: string | null;

    /**
     * Whether the message content is encrypted.
     * @default false
     */
    isEncrypted?: boolean;

    /**
     * The time-to-live (TTL) of the message in seconds.
     * If set to null, the message will not expire.
     * @default null
     */
    ttl?: number | null;

    /**
     * The priority of the message.
     * Messages with values greater than 99 will bypass limits and delays.
     * Must be in the range -128..127.
     * @default 0
     */
    priority?: number;

    /**
     * The date and time until which the message is valid (RFC3339 date-time).
     * Mutually exclusive with `ttl`.
     * @default null
     */
    validUntil?: Date | null;

    /**
     * The date and time to schedule the message delivery at (RFC3339 date-time).
     * Must be in the future and before or equal to `validUntil`.
     * @default null
     */
    scheduleAt?: Date | null;

    /**
     * The phone numbers to send the message to.
     */
    phoneNumbers: string[];

    /**
     * The SIM number to send the message from.
     * If not specified, the message will be sent from the default SIM.
     * @default null
     */
    simNumber?: number | null;

    /**
     * Whether to include a delivery report for the message.
     * @default true
     */
    withDeliveryReport?: boolean | null;
}

/**
 * Represents an SMS or MMS message to send.
 *
 * Exactly one of the payload fields must be provided:
 * `message`, `textMessage`, `dataMessage`, or `mmsMessage`.
 * The constraint is enforced at compile time and by the server at runtime,
 * which rejects requests providing none or more than one
 * of these fields with a 400 error.
 */
export type Message = MessageCommon &
    (
        | {
              /**
               * The message content.
               * @deprecated Use textMessage
               */
              message: string;

              textMessage?: never;
              dataMessage?: never;
              mmsMessage?: never;
          }
        | {
              /**
               * The text message payload.
               * Must not be provided together with `message` or `dataMessage`.
               */
              textMessage: TextMessagePayload;

              message?: never;
              dataMessage?: never;
              mmsMessage?: never;
          }
        | {
              /**
               * The data message payload.
               * Must not be provided together with `message` or `textMessage`.
               */
              dataMessage: DataMessagePayload;

              message?: never;
              textMessage?: never;
              mmsMessage?: never;
          }
        | {
              /**
               * The MMS message payload.
               */
              mmsMessage: MmsMessagePayload;

              message?: never;
              textMessage?: never;
              dataMessage?: never;
          }
    );

/**
 * Represents the type of events that can trigger a webhook.
 */
export enum WebHookEventType {
    /**
     * Indicates that a new SMS message has been received.
     */
    SmsReceived = 'sms:received',

    /**
     * Indicates that a ping request has been sent.
     */
    SystemPing = 'system:ping',

    /**
     * Indicates that an SMS message has been sent.
     */
    SmsSent = 'sms:sent',

    /**
     * Indicates that an SMS message has been delivered.
     */
    SmsDelivered = 'sms:delivered',

    /**
     * Indicates that an SMS message has failed to be sent.
     */
    SmsFailed = 'sms:failed',

    /**
     * Indicates that an SMS message has been cancelled.
     */
    SmsCancelled = 'sms:cancelled',

    /**
     * Indicates that the application has been started.
     */
    AppStarted = 'app:started',

    /**
     * Indicates that a new MMS message notification has been received (not yet downloaded).
     */
    MmsReceived = 'mms:received',

    /**
     * Indicates that an MMS message has been downloaded and its attachments are available.
     */
    MmsDownloaded = 'mms:downloaded',

    /**
     * Indicates that a batch of SMS messages has been received.
     */
    SmsBatchReceived = 'sms:batch:received',

    /**
     * Indicates that a batch of data SMS messages has been received.
     */
    SmsDataBatchReceived = 'sms:batch:data-received',

    /**
     * Indicates that a batch of MMS messages has been received.
     */
    MmsBatchReceived = 'mms:batch:received',

    /**
     * Indicates that a batch of MMS messages has been downloaded.
     */
    MmsBatchDownloaded = 'mms:batch:downloaded',
}

/**
 * Represents the delivery mode for webhooks.
 */
export enum WebhookDelivery {
    /**
     * Disable webhook delivery.
     */
    Disabled = 'Disabled',

    /**
     * Deliver webhooks individually (one per message).
     */
    Individual = 'Individual',

    /**
     * Deliver webhooks as ordered batches.
     */
    Batch = 'Batch',
}

/**
 * Represents a request to create or update a webhook.
 */
export interface RegisterWebHookRequest {
    /**
     * The ID of the webhook.
     * If not specified, a new ID will be generated.
     * @default null
     */
    id?: string | null;

    /**
     * The event type that triggers the webhook.
     */
    event: WebHookEventType;

    /**
     * The URL to send the webhook request to.
     */
    url: string;

    /**
     * The device ID the webhook is associated with.
     * @default null
     */
    deviceId?: string | null;
}

/**
 * Represents a webhook configuration.
 * @see RegisterWebHookRequest
 */
export type WebHook = Required<RegisterWebHookRequest>;

/**
 * Represents a device.
 */
export interface Device {
    /**
     * The unique identifier of the device.
     */
    id: string;

    /**
     * The name of the device.
     */
    name: string;

    /**
     * The timestamp when the device was created.
     */
    createdAt: string;

    /**
     * The timestamp when the device was last seen.
     */
    lastSeen: string;

    /**
     * The timestamp when the device was updated.
     */
    updatedAt: string;

    /**
     * The timestamp when the device was deleted (if applicable).
     */
    deletedAt?: string | null;
}

/**
 * Represents the settings for a device.
 */
export interface DeviceSettings {
    /**
     * Settings related to message handling.
     */
    messages?: SettingsMessages;

    /**
     * Settings related to webhook functionality.
     */
    webhooks?: SettingsWebhooks;

    /**
     * Settings related to the Cloud/Private server configuration.
     */
    gateway?: SettingsGateway;

    /**
     * Settings related to message encryption.
     */
    encryption?: SettingsEncryption;

    /**
     * Settings related to logging.
     */
    logs?: SettingsLogs;

    /**
     * Settings related to ping functionality.
     */
    ping?: SettingsPing;
}

/**
 * Represents the settings for message handling.
 */
export interface SettingsMessages {
    /**
     * The period for message sending limits.
     */
    limitPeriod?: LimitPeriod;

    /**
     * The maximum number of messages allowed per limit period.
     */
    limitValue?: number;

    /**
     * The number of days to retain message logs.
     */
    logLifetimeDays?: number;

    /**
     * The minimum interval between message sends (in seconds).
     */
    sendIntervalMin?: number;

    /**
     * The maximum interval between message sends (in seconds).
     */
    sendIntervalMax?: number;

    /**
     * The mode for SIM card selection.
     */
    simSelectionMode?: SimSelectionMode;
}

/**
 * Represents the settings for webhook functionality.
 */
export interface SettingsWebhooks {
    /**
     * Whether internet access is required for webhooks.
     */
    internetRequired?: boolean;

    /**
     * The number of times to retry failed webhook deliveries.
     */
    retryCount?: number;

    /**
     * The secret key used for signing webhook payloads.
     */
    signingKey?: string;
}

/**
 * Represents the settings for the Cloud/Private server configuration.
 */
export interface SettingsGateway {
    /**
     * The URL of the server.
     */
    cloudUrl?: string;

    /**
     * The private token for authenticating with the Private Server.
     */
    privateToken?: string;
}

/**
 * Represents the settings for message encryption.
 */
export interface SettingsEncryption {
    /**
     * The encryption passphrase.
     */
    passphrase?: string;
}

/**
 * Represents the settings for logging.
 */
export interface SettingsLogs {
    /**
     * The number of days to retain logs.
     */
    lifetimeDays?: number;
}

/**
 * Represents the settings for ping functionality.
 */
export interface SettingsPing {
    /**
     * The interval between ping requests (in seconds).
     */
    intervalSeconds?: number;
}

/**
 * Represents the period for message sending limits.
 */
export enum LimitPeriod {
    Disabled = "Disabled",
    PerMinute = "PerMinute",
    PerHour = "PerHour",
    PerDay = "PerDay",
}

/**
 * Represents the mode for SIM card selection.
 */
export enum SimSelectionMode {
    OSDefault = "OSDefault",
    RoundRobin = "RoundRobin",
    Random = "Random",
}

/**
 * Represents the health status of the system.
 */
export enum HealthStatus {
    Pass = "pass",
    Warn = "warn",
    Fail = "fail",
}

/**
 * Represents the health response from the system.
 */
export interface HealthResponse {
    /**
     * The overall status of the application.
     */
    status: HealthStatus;

    /**
     * The version of the application.
     */
    version: string;

    /**
     * The release ID of the application.
     */
    releaseId: number;

    /**
     * A map of check names to their respective details.
     */
    checks: HealthChecks;
}

/**
 * Represents a map of health checks.
 */
export interface HealthChecks {
    [checkName: string]: HealthCheck;
}

/**
 * Represents a health check.
 */
export interface HealthCheck {
    /**
     * The status of the check.
     */
    status: HealthStatus;

    /**
     * A human-readable description of the check.
     */
    description: string;

    /**
     * The observed value of the check.
     */
    observedValue: number;

    /**
     * The unit of measurement for the observed value.
     */
    observedUnit: string;
}

/**
 * Represents a log entry.
 */
export interface LogEntry {
    /**
     * The unique identifier of the log entry.
     */
    id: number;

    /**
     * The timestamp when the log entry was created.
     */
    createdAt: string;

    /**
     * The module or component that generated the log entry.
     */
    module: string;

    /**
     * The priority level of the log entry.
     */
    priority: LogEntryPriority;

    /**
     * A message describing the log event.
     */
    message: string;

    /**
     * Additional context information related to the log entry.
     */
    context?: Record<string, string>;
}

/**
 * Represents the priority level of a log entry.
 */
export enum LogEntryPriority {
    Debug = "DEBUG",
    Info = "INFO",
    Warn = "WARN",
    Error = "ERROR",
}

/**
 * Represents a request to refresh inbox messages.
 */
export interface InboxRefreshRequest {
    /**
     * The ID of the device to refresh messages for.
     */
    deviceId?: string;

    /**
     * The start of the time range to refresh.
     */
    since: Date;

    /**
     * The end of the time range to refresh.
     */
    until: Date;

    /**
     * The list of message types to refresh.
     * By default, SMS messages are refreshed.
     */
    messageTypes?: IncomingMessageType[];

    /**
     * The delivery mode for webhooks.
     */
    webhookDelivery?: WebhookDelivery;
}

/**
 * Represents a request to export inbox messages.
 * @deprecated Use {@link InboxRefreshRequest} instead.
 */
export interface MessagesExportRequest {
    /**
     * The ID of the device to export messages for.
     */
    deviceId: string;

    /**
     * The start of the time range to export.
     */
    since: Date;

    /**
     * The end of the time range to export.
     */
    until: Date;
}

/**
 * Represents a request to generate a new JWT token.
 */
export interface TokenRequest {
    /**
     * The scopes to include in the token.
     */
    scopes: string[];

    /**
     * The time-to-live (TTL) of the token in seconds.
     */
    ttl?: number;
}

/**
 * Represents a response containing a new JWT token.
 */
export interface TokenResponse {
    /**
     * The JWT access token.
     */
    access_token: string;

    /**
     * The type of the token.
     */
    token_type: string;

    /**
     * The unique identifier of the token.
     */
    id: string;

    /**
     * The expiration time of the token.
     */
    expires_at: string;
}

/**
 * Represents the type of an incoming message.
 */
export enum IncomingMessageType {
    /**
     * SMS message
     */
    SMS = 'SMS',

    /**
     * Data SMS message
     */
    DATA_SMS = 'DATA_SMS',

    /**
     * MMS message
     */
    MMS = 'MMS',

    /**
     * Downloaded MMS message
     */
    MMS_DOWNLOADED = 'MMS_DOWNLOADED',
}

/**
 * Metadata for an MMS attachment returned by the inbox API.
 */
export interface IncomingMessageAttachment {
    /** Part ID of the attachment. */
    partId: number;

    /** Display name of the attachment file. */
    name: string;

    /** Size of the attachment in bytes. */
    size: number;

    /** MIME type of the attachment. */
    contentType: string;
}

/**
 * Represents an incoming message from the inbox.
 */
export interface IncomingMessage {
    /** The unique identifier of the message. */
    id: string;

    /** Message type (SMS, DATA_SMS, MMS, MMS_DOWNLOADED). */
    type: string;

    /** Sender phone number. */
    sender: string;

    /** A preview of the message content. */
    contentPreview: string;

    /** When the message was received. */
    createdAt: string;

    /** Recipient phone number. */
    recipient?: string;

    /** SIM card number that received the message. */
    simNumber?: number;

    /** MMS attachment metadata (only present when include_attachments is true). */
    attachments?: IncomingMessageAttachment[];
}
