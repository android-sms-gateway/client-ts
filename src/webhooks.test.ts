import { WebHookEventType } from './domain';
import {
    MmsBatchDownloadedPayload,
    MmsDownloadedAttachment,
    MmsDownloadedPayload,
    MmsReceivedPayload,
    SmsBatchReceivedPayload,
    SmsDataReceivedPayload,
    SmsReceivedPayload,
    WebHookPayload,
} from './webhooks';

import { describe, expect, it } from "bun:test";

const smsReceivedFixture: SmsReceivedPayload = {
    messageId: 'msg-sms-1',
    phoneNumber: '+10000000001',
    sender: '+10000000002',
    recipient: '+10000000003',
    simNumber: 1,
    message: 'Hello from the gateway',
    receivedAt: '2026-08-18T10:00:00.000Z',
};

const smsDataFixture: SmsDataReceivedPayload = {
    messageId: 'msg-sms-data-1',
    phoneNumber: '+10000000001',
    sender: '+10000000002',
    recipient: '+10000000003',
    simNumber: 1,
    data: 'SGVsbG8gZnJvbSB0aGUgZ2F0ZXdheQ==',
    receivedAt: '2026-08-18T10:00:01.000Z',
};

const mmsReceivedFixture: MmsReceivedPayload = {
    messageId: 'msg-mms-1',
    phoneNumber: '+10000000001',
    sender: '+10000000002',
    recipient: '+10000000003',
    simNumber: 1,
    transactionId: 'T-10001',
    contentClass: 'personal',
    size: 2048,
    subject: 'Photo',
    receivedAt: '2026-08-18T10:00:02.000Z',
};

const mmsDownloadedAttachmentFixture: MmsDownloadedAttachment = {
    partId: 101,
    contentType: 'image/jpeg',
    name: 'photo.jpg',
    data: '/9j/4AAQSkZJRg==',
    size: 2048,
};

const mmsDownloadedFixture: MmsDownloadedPayload = {
    messageId: 'msg-mms-2',
    phoneNumber: '+10000000001',
    sender: '+10000000002',
    recipient: '+10000000003',
    simNumber: 1,
    attachments: [mmsDownloadedAttachmentFixture],
    subject: 'Photo',
    body: 'See attached',
    receivedAt: '2026-08-18T10:00:03.000Z',
};

describe('WebHookPayload', () => {
    it('sms:batch:received payload narrows to SmsReceivedPayload[]', () => {
        const webhook: WebHookPayload = {
            event: WebHookEventType.SmsBatchReceived,
            payload: { messages: [smsReceivedFixture] },
        };

        expect(webhook.event).toBe(WebHookEventType.SmsBatchReceived);

        if (webhook.event === WebHookEventType.SmsBatchReceived) {
            expect(Array.isArray(webhook.payload.messages)).toBe(true);
            expect(webhook.payload.messages[0].messageId).toBe('msg-sms-1');
            expect(webhook.payload.messages[0].message).toBe('Hello from the gateway');
        }
    });

    it('sms:batch:data-received payload narrows to SmsDataReceivedPayload[]', () => {
        const webhook: WebHookPayload = {
            event: WebHookEventType.SmsDataBatchReceived,
            payload: { messages: [smsDataFixture] },
        };

        expect(webhook.event).toBe(WebHookEventType.SmsDataBatchReceived);

        if (webhook.event === WebHookEventType.SmsDataBatchReceived) {
            expect(Array.isArray(webhook.payload.messages)).toBe(true);
            expect(webhook.payload.messages[0].messageId).toBe('msg-sms-data-1');
            expect(webhook.payload.messages[0].data).toBe('SGVsbG8gZnJvbSB0aGUgZ2F0ZXdheQ==');
        }
    });

    it('mms:batch:received payload narrows to MmsReceivedPayload[]', () => {
        const webhook: WebHookPayload = {
            event: WebHookEventType.MmsBatchReceived,
            payload: { messages: [mmsReceivedFixture] },
        };

        expect(webhook.event).toBe(WebHookEventType.MmsBatchReceived);

        if (webhook.event === WebHookEventType.MmsBatchReceived) {
            expect(Array.isArray(webhook.payload.messages)).toBe(true);
            expect(webhook.payload.messages[0].messageId).toBe('msg-mms-1');
            expect(webhook.payload.messages[0].transactionId).toBe('T-10001');
            expect(webhook.payload.messages[0].contentClass).toBe('personal');
            expect(webhook.payload.messages[0].size).toBe(2048);
        }
    });

    it('mms:batch:downloaded payload narrows to MmsDownloadedPayload[]', () => {
        const webhook: WebHookPayload = {
            event: WebHookEventType.MmsBatchDownloaded,
            payload: { messages: [mmsDownloadedFixture] },
        };

        expect(webhook.event).toBe(WebHookEventType.MmsBatchDownloaded);

        if (webhook.event === WebHookEventType.MmsBatchDownloaded) {
            expect(Array.isArray(webhook.payload.messages)).toBe(true);
            expect(webhook.payload.messages[0].messageId).toBe('msg-mms-2');
            expect(Array.isArray(webhook.payload.messages[0].attachments)).toBe(true);
            expect(webhook.payload.messages[0].attachments[0].partId).toBe(101);
            expect(webhook.payload.messages[0].attachments[0].contentType).toBe('image/jpeg');
        }
    });

    it('sms:received full-shape fixture is WebHookPayload-aligned', () => {
        const webhook: WebHookPayload = {
            event: WebHookEventType.SmsReceived,
            payload: smsReceivedFixture,
        };

        expect(webhook.event).toBe(WebHookEventType.SmsReceived);

        if (webhook.event === WebHookEventType.SmsReceived) {
            expect(webhook.payload.messageId).toBe('msg-sms-1');
            expect(webhook.payload.sender).toBe('+10000000002');
            expect(webhook.payload.recipient).toBe('+10000000003');
            expect(webhook.payload.simNumber).toBe(1);
            expect(webhook.payload.message).toBe('Hello from the gateway');
            expect(webhook.payload.phoneNumber).toBe('+10000000001');
            expect(webhook.payload.receivedAt).toBe('2026-08-18T10:00:00.000Z');
        }
    });

    it('rejects a single-event payload paired with a batch event', () => {
        // @ts-expect-error SmsBatchReceived requires a SmsBatchReceivedPayload, not a single SmsReceivedPayload
        const wrongPairing: WebHookPayload = { event: WebHookEventType.SmsBatchReceived, payload: smsReceivedFixture };

        expect(wrongPairing.event).toBe(WebHookEventType.SmsBatchReceived);
    });

    it('rejects a SmsReceivedPayload missing the required messageId field', () => {
        // @ts-expect-error SmsReceivedPayload requires messageId
        const missingMessageIdPayload: SmsReceivedPayload = {
            phoneNumber: '+10000000001',
            sender: '+10000000002',
            message: 'no id',
            receivedAt: '2026-08-18T10:00:00.000Z',
        };
        const missingMessageId: WebHookPayload = { event: WebHookEventType.SmsReceived, payload: missingMessageIdPayload };

        expect(missingMessageId.event).toBe(WebHookEventType.SmsReceived);
        if (missingMessageId.event === WebHookEventType.SmsReceived) {
            expect(missingMessageId.payload.message).toBe('no id');
        }
    });

    it('rejects a batch payload with a wrong inner message type', () => {
        // @ts-expect-error messages entries must be SmsReceivedPayload, not { message: number }
        const wrongMessagesPayload: SmsBatchReceivedPayload = { messages: [{ message: 42 }] };
        const wrongInnerType: WebHookPayload = { event: WebHookEventType.SmsBatchReceived, payload: wrongMessagesPayload };

        expect(wrongInnerType.event).toBe(WebHookEventType.SmsBatchReceived);
    });

    it('rejects an sms:batch:data-received payload missing the required data field', () => {
        // @ts-expect-error messages entries must be SmsDataReceivedPayload, which requires data
        const missingDataPayload: SmsBatchDataReceivedPayload = { messages: [{ messageId: 'msg-sms-data-2' }] };
        const missingData: WebHookPayload = { event: WebHookEventType.SmsDataBatchReceived, payload: missingDataPayload };

        expect(missingData.event).toBe(WebHookEventType.SmsDataBatchReceived);
    });

    it('rejects an mms:batch:received payload with MmsDownloadedPayload inner messages', () => {
        // @ts-expect-error messages entries must be MmsReceivedPayload (transactionId/contentClass/size), not MmsDownloadedPayload
        const wrongInnerPayload: MmsBatchReceivedPayload = { messages: [mmsDownloadedFixture] };
        const wrongInner: WebHookPayload = { event: WebHookEventType.MmsBatchReceived, payload: wrongInnerPayload };

        expect(wrongInner.event).toBe(WebHookEventType.MmsBatchReceived);
    });

    it('rejects an MmsDownloadedPayload missing the required attachments field', () => {
        // @ts-expect-error MmsDownloadedPayload requires attachments
        const mmsWithoutAttachmentsPayload: MmsBatchDownloadedPayload = { messages: [{ messageId: 'msg-mms-3', phoneNumber: '+10000000001', sender: '+10000000002', receivedAt: '2026-08-18T10:00:04.000Z' }] };
        const mmsWithoutAttachments: WebHookPayload = { event: WebHookEventType.MmsBatchDownloaded, payload: mmsWithoutAttachmentsPayload };

        expect(mmsWithoutAttachments.event).toBe(WebHookEventType.MmsBatchDownloaded);
    });
});
