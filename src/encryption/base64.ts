/**
 * Internal SDK helper: standard padded base64 codecs for Uint8Array
 * (RFC 4648 with padding, NO line wrapping).
 */

/**
 * Encodes bytes as standard padded base64 (NO line wrapping).
 */
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Decodes standard padded base64 into bytes.
 */
export function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
