import { describe, expect, it } from 'bun:test';
import { MessageState, ProcessState } from './domain';

const fixtureWithCreatedAt: MessageState = {
    id: '123',
    state: ProcessState.Sent,
    recipients: [
        {
            phoneNumber: '+1234567890',
            state: ProcessState.Sent,
        },
    ],
    createdAt: '2026-08-23T10:00:00+03:00',
};

const fixtureWithoutCreatedAt: MessageState = {
    id: '123',
    state: ProcessState.Sent,
    recipients: [],
};

describe('MessageState createdAt fixture assertions', () => {
    it('parses a fixture containing createdAt and yields the field', () => {
        const parsed = JSON.parse(JSON.stringify(fixtureWithCreatedAt)) as MessageState;

        expect(parsed.createdAt).toBe('2026-08-23T10:00:00+03:00');
    });

    it('preserves the exact wire format of the createdAt timestamp (zone offset)', () => {
        const wire = JSON.stringify(fixtureWithCreatedAt);

        expect(wire).toContain('"createdAt":"2026-08-23T10:00:00+03:00"');
    });

    it('does not error on a fixture without createdAt', () => {
        const parsed = JSON.parse(JSON.stringify(fixtureWithoutCreatedAt)) as MessageState;

        expect(parsed.id).toBe('123');
        expect(parsed.createdAt).toBeUndefined();
    });

    it('accepts a string createdAt value', () => {
        const withString: MessageState = {
            id: '123',
            state: ProcessState.Sent,
            recipients: [],
            createdAt: '2026-08-23T10:00:00.000Z',
        };

        expect(typeof withString.createdAt).toBe('string');
    });

    it('rejects a Date createdAt value (string-only type assertion)', () => {
        const withDate: MessageState = {
            id: '123',
            state: ProcessState.Sent,
            recipients: [],
            // @ts-expect-error MessageState.createdAt is string-only; Date is not assignable
            createdAt: new Date('2026-08-23T10:00:00Z'),
        };

        expect(withDate).toBeDefined();
    });
});
