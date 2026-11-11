import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  GATE_STEP_SECONDS,
  createGateCode,
  gateMessage,
  gateStep,
  msUntilNextStep,
  parseGateCode,
} from '../../shared/contract.ts';
import { gateSigner, newQrSecret } from '../src/auth.ts';

describe('gate code format', () => {
  const secret = newQrSecret();
  const sign = gateSigner(secret);
  const at = Date.UTC(2026, 10, 9, 18, 30, 5);

  it('round-trips through parse', () => {
    const raw = createGateCode(42, 'in', 0, at, sign);
    const parsed = parseGateCode(raw);
    assert.deepEqual(parsed, {
      memberId: 42,
      step: gateStep(at),
      direction: 'in',
      seq: 0,
      signature: sign(gateMessage(42, gateStep(at), 'in', 0)).slice(0, 16),
    });
  });

  it('encodes direction and presence sequence in the code', () => {
    assert.match(createGateCode(7, 'in', 12, at, sign), /^NG2\.7\.\d+\.i\.12\.[0-9a-f]{16}$/);
    assert.match(createGateCode(7, 'out', 12, at, sign), /^NG2\.7\.\d+\.o\.12\.[0-9a-f]{16}$/);
  });

  it('gives every presence sequence its own code within the same step', () => {
    assert.notEqual(createGateCode(7, 'in', 12, at, sign), createGateCode(7, 'in', 13, at, sign));
  });

  it('rejects anything that is not exactly a gate code', () => {
    for (const raw of [
      '',
      'hello',
      'NG2.1.2.i.0.abc',
      'NG1.1.2.i.0123456789abcdef',
      'NG2.1.2.i.0123456789abcdef',
      'NG2.1.2.x.0.0123456789abcdef',
      'NG2.-1.2.i.0.0123456789abcdef',
      'NG2.1.2.i.-3.0123456789abcdef',
      'NG2.1.2.i.0.0123456789ABCDEF',
      'NG2.1.2.i.0.0123456789abcdef.extra',
      'https://evil.example/?NG2.1.2.i.0.0123456789abcdef',
    ]) {
      assert.equal(parseGateCode(raw), null, raw);
    }
  });

  it('tolerates scanner whitespace', () => {
    assert.notEqual(parseGateCode(`  ${createGateCode(1, 'in', 0, at, sign)}\n`), null);
  });

  it('changes every step and counts down to the next one', () => {
    const stepMs = GATE_STEP_SECONDS * 1000;
    const start = Math.floor(at / stepMs) * stepMs;
    assert.equal(gateStep(start), gateStep(start + stepMs - 1));
    assert.equal(gateStep(start) + 1, gateStep(start + stepMs));
    assert.equal(msUntilNextStep(start), stepMs);
    assert.equal(msUntilNextStep(start + 1000), stepMs - 1000);
    assert.notEqual(createGateCode(1, 'in', 0, start, sign), createGateCode(1, 'in', 0, start + stepMs, sign));
  });
});

describe('phone and server sign identically', () => {
  // The phone signs with @noble/hashes, the server verifies with node:crypto.
  const nobleSigner = (secretHex: string) => (message: string) =>
    bytesToHex(hmac(sha256, hexToBytes(secretHex), utf8ToBytes(message)));

  it('produces the same HMAC for many secrets and messages', () => {
    for (let i = 0; i < 50; i++) {
      const secret = newQrSecret();
      const message = gateMessage(i + 1, 59_000_000 + i, i % 2 === 0 ? 'in' : 'out', i * 7);
      assert.equal(nobleSigner(secret)(message), gateSigner(secret)(message));
    }
  });

  it('matches the RFC 4231 test case 2 vector', () => {
    const keyHex = bytesToHex(utf8ToBytes('Jefe'));
    const expected = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';
    assert.equal(gateSigner(keyHex)('what do ya want for nothing?'), expected);
    assert.equal(nobleSigner(keyHex)('what do ya want for nothing?'), expected);
  });
});
