import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { displayName, nextSpotStatus } from '../src/domain/spot.ts';

describe('spot request state machine', () => {
  it('allows the documented transitions', () => {
    assert.equal(nextSpotStatus('pending', 'accept'), 'accepted');
    assert.equal(nextSpotStatus('pending', 'decline'), 'declined');
    assert.equal(nextSpotStatus('pending', 'cancel'), 'cancelled');
    assert.equal(nextSpotStatus('pending', 'expire'), 'expired');
    assert.equal(nextSpotStatus('accepted', 'expire'), 'expired');
  });

  it('refuses everything else', () => {
    assert.equal(nextSpotStatus('accepted', 'decline'), null);
    assert.equal(nextSpotStatus('accepted', 'cancel'), null);
    assert.equal(nextSpotStatus('declined', 'accept'), null);
    assert.equal(nextSpotStatus('cancelled', 'accept'), null);
    assert.equal(nextSpotStatus('expired', 'accept'), null);
  });
});

describe('public names', () => {
  it('shows first name and last initial only', () => {
    assert.equal(displayName('Burak Bayram'), 'Burak B.');
    assert.equal(displayName('Ayşe Nur Şimşek'), 'Ayşe Ş.');
    assert.equal(displayName('İrem ışık'), 'İrem I.');
    assert.equal(displayName('Cem'), 'Cem');
  });
});
