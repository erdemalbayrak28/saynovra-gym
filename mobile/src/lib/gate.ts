import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import type { GateSigner } from '../../../shared/contract';

/** Same HMAC-SHA256 as the server's node:crypto signer; server/test/gate-code.test.ts proves they match. */
export function gateSigner(qrSecretHex: string): GateSigner {
  const key = hexToBytes(qrSecretHex);
  return (message) => bytesToHex(hmac(sha256, key, utf8ToBytes(message)));
}
