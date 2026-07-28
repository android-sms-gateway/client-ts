export enum ProcessState {
    Pending = "Pending",
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
 * Represents an SMS message.
 */
export interface Message {
    /**
     * The ID of the message, will be generated if not provided.
     * @default null
     */
    id?: string | null;

    /**
     * The message content.
     */
    message: string;

    /**
     * The time-to-live (TTL) of the message in seconds.
     * If set to null, the message will not expire.
     * @default null
     */
    ttl?: number | null;

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
 * Represents a request to export inbox messages.
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
 * Represents the payload of a webhook event.
 */
export type WebHookPayload =
    /**
     * Represents the payload of a webhook event of type `SmsReceived`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsReceived;

        /**
         * The payload of the event.
         */
        payload: {
            /**
             * The received message.
             */
            message: string;

            /**
             * The phone number of the sender.
             */
            phoneNumber: string;

            /**
             * The date and time of when the message was received.
             */
            receivedAt: string;
        };
    } |
    /**
     * Represents the payload of a webhook event of type `SystemPing`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SystemPing;

        /**
         * The payload of the event.
         * This is an empty object.
         */
        payload: EmptyObject;
    } |
    /**
     * Represents the payload of a webhook event of type `SmsSent`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsSent;

        /**
         * The payload of the event.
         */
        payload: {
            /**
             * The message ID.
             */
            messageId: string;

            /**
             * The date and time of when the message was sent.
             */
            sentAt: string;
        };
    } |
    /**
     * Represents the payload of a webhook event of type `SmsDelivered`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsDelivered;

        /**
         * The payload of the event.
         */
        payload: {
            /**
             * The message ID.
             */
            messageId: string;

            /**
             * The date and time of when the message was delivered.
             */
            deliveredAt: string;
        };
    } |
    /**
     * Represents the payload of a webhook event of type `SmsFailed`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsFailed;

        /**
         * The payload of the event.
         */
        payload: {
            /**
             * The message ID.
             */
            messageId: string;

            /**
             * The date and time of when the message failed.
             */
            failedAt: string;

            /**
             * The error message.
             */
            error: string;
        };
    } |
    /**
     * Represents the payload of a webhook event of type `MmsReceived`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.MmsReceived;

        /**
         * The payload of the event (MMS notification, not yet downloaded).
         */
        payload: MmsReceivedPayload;
    } |
    /**
     * Represents the payload of a webhook event of type `MmsDownloaded`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.MmsDownloaded;

        /**
         * The payload of the event (fully downloaded MMS with attachments).
         */
        payload: MmsDownloadedPayload;
    };

type EmptyObject = {
    [K in any]: never
}

/**
 * Payload of an mms:received event (MMS notification, not yet downloaded).
 */
export interface MmsReceivedPayload {
    /** The unique identifier of the message. */
    messageId: string;

    /** The phone number of the sender. */
    phoneNumber: string;

    /** The phone number of the message sender. */
    sender: string;

    /** Unique MMS transaction identifier. */
    transactionId: string;

    /** MMS content classification. */
    contentClass: string;

    /** Attachment size in bytes. */
    size: number;

    /** The timestamp when the MMS message was received. */
    receivedAt: string;

    /** The phone number of the message recipient. */
    recipient?: string;

    /** The SIM card number that received the message. */
    simNumber?: number;

    /** Message subject line. */
    subject?: string;
}

/**
 * Metadata for a non-text MMS part (attachment).
 */
export interface MmsDownloadedAttachment {
    /** The _id from content://mms/part. */
    partId: number;

    /** MIME type of the attachment (e.g. image/jpeg). */
    contentType: string;

    /** Filename of the attachment, if present. */
    name?: string;

    /** Base64-encoded attachment data, if available. */
    data?: string;

    /** Size in bytes, if known. */
    size?: number;
}

/**
 * Payload of an mms:downloaded event (fully downloaded MMS with attachments).
 */
export interface MmsDownloadedPayload {
    /** The unique identifier of the message. */
    messageId: string;

    /** The phone number of the sender. */
    phoneNumber: string;

    /** The phone number of the message sender. */
    sender: string;

    /** Metadata for non-text MMS parts, including optional Base64 content. */
    attachments: MmsDownloadedAttachment[];

    /** The timestamp when the MMS message was received. */
    receivedAt: string;

    /** The phone number of the message recipient. */
    recipient?: string;

    /** The SIM card number that received the message. */
    simNumber?: number;

    /** Message subject line. */
    subject?: string;

    /** Aggregated text content of the MMS message. */
    body?: string;
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
