/**
 * Typed error thrown for all encryption failures.
 */
export class EncryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EncryptionError";
    }
}