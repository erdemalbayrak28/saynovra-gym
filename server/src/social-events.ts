import type { SpotMessageDto, SpotRequestDto } from '../../shared/contract.ts';
import { isStaff } from './auth.ts';
import type { LiveHub } from './live.ts';
import type { SocialChange } from './social.ts';

const involves = (request: SpotRequestDto, memberId: number) => request.from.id === memberId || request.to.id === memberId;

/** Pushes the live events a social change implies: radar refresh, request updates, floor feed. */
export function publishSocialChange(live: LiveHub, change: SocialChange): void {
  if (change.radarChanged) live.publish({ type: 'radar' }, (claims) => claims.role === 'member');
  for (const request of change.requests) {
    live.publish({ type: 'spot_request', request }, (claims) => claims.role === 'member' && involves(request, claims.sub));
  }
  for (const event of change.floor) live.publish({ type: 'floor', event }, isStaff);
}

export function publishMessage(live: LiveHub, message: SpotMessageDto, request: SpotRequestDto): void {
  live.publish({ type: 'spot_message', message }, (claims) => claims.role === 'member' && involves(request, claims.sub));
}
