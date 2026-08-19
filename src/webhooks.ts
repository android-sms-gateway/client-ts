import { WebHookEventType } from "./domain";

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
        payload: SmsReceivedPayload;
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
    } |
    /**
     * Represents the payload of a webhook event of type `SmsCancelled`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsCancelled;

        /**
         * The payload of the event.
         */
        payload: {
            /**
             * The message ID.
             */
            messageId: string;

            /**
             * The date and time of when the message was cancelled.
             */
            cancelledAt: string;
        };
    } |
    /**
     * Represents the payload of a webhook event of type `SmsBatchReceived`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsBatchReceived;

        /**
         * The payload of the event (ordered list of received SMS messages).
         */
        payload: SmsBatchReceivedPayload;
    } |
    /**
     * Represents the payload of a webhook event of type `SmsDataBatchReceived`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.SmsDataBatchReceived;

        /**
         * The payload of the event (ordered list of received data SMS messages).
         */
        payload: SmsBatchDataReceivedPayload;
    } |
    /**
     * Represents the payload of a webhook event of type `MmsBatchReceived`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.MmsBatchReceived;

        /**
         * The payload of the event (ordered list of received MMS messages).
         */
        payload: MmsBatchReceivedPayload;
    } |
    /**
     * Represents the payload of a webhook event of type `MmsBatchDownloaded`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.MmsBatchDownloaded;

        /**
         * The payload of the event (ordered list of downloaded MMS messages).
         */
        payload: MmsBatchDownloadedPayload;
    } |
    /**
     * Represents the payload of a webhook event of type `AppStarted`.
     */
    {
        /**
         * The event type.
         */
        event: WebHookEventType.AppStarted;

        /**
         * The payload of the event (list of SIM cards available in the device).
         */
        payload: AppStartedPayload;
    };

type EmptyObject = {
    [K in any]: never
}

/**
 * Payload of an sms:received event.
 */
export interface SmsReceivedPayload {
    /** The unique identifier of the message. */
    messageId: string;

    /** The phone number of the sender (for incoming messages) or recipient (for outgoing messages). */
    phoneNumber: string;

    /** The phone number of the message sender. */
    sender: string;

    /** The phone number of the message recipient. */
    recipient?: string;

    /** The SIM card number that received the SMS. */
    simNumber?: number;

    /** The content of the SMS message received. */
    message: string;

    /** The timestamp when the SMS message was received. */
    receivedAt: string;
}

/**
 * Payload of an sms:data-received event.
 */
export interface SmsDataReceivedPayload {
    /** The unique identifier of the message. */
    messageId: string;

    /** The phone number of the sender (for incoming messages) or recipient (for outgoing messages). */
    phoneNumber: string;

    /** The phone number of the message sender. */
    sender: string;

    /** The phone number of the message recipient. */
    recipient?: string;

    /** The SIM card number that received the SMS. */
    simNumber?: number;

    /** Base64-encoded content of the SMS message received. */
    data: string;

    /** The timestamp when the SMS message was received. */
    receivedAt: string;
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
 * Payload of an sms:batch:received event (ordered list of received SMS messages).
 */
export interface SmsBatchReceivedPayload {
    /** The ordered list of received SMS messages. */
    messages: SmsReceivedPayload[];
}

/**
 * Payload of an sms:batch:data-received event (ordered list of received data SMS messages).
 */
export interface SmsBatchDataReceivedPayload {
    /** The ordered list of received data SMS messages. */
    messages: SmsDataReceivedPayload[];
}

/**
 * Payload of an mms:batch:received event (ordered list of received MMS messages).
 */
export interface MmsBatchReceivedPayload {
    /** The ordered list of received MMS messages. */
    messages: MmsReceivedPayload[];
}

/**
 * Payload of an mms:batch:downloaded event (ordered list of downloaded MMS messages).
 */
export interface MmsBatchDownloadedPayload {
    /** The ordered list of downloaded MMS messages. */
    messages: MmsDownloadedPayload[];
}

/**
 * Represents a SIM card in an Android device.
 */
export interface SimCard {
    /** 0-based physical slot index. */
    slotIndex: number;

    /** 1-based slot number (1, 2, or 3). */
    simNumber: number;

    /** Phone number associated with the SIM, may be null. */
    phoneNumber?: string | null;

    /** Carrier/network operator name, may be null. */
    carrierName?: string | null;

    /** Integrated Circuit Card Identifier, may be null. */
    iccid?: string | null;
}

/**
 * Payload of an app:started event (list of SIM cards available in the device).
 */
export interface AppStartedPayload {
    /** The list of SIM cards available in the device. */
    simCards: SimCard[];
}
