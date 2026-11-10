import { Hono } from 'hono';
import { z } from 'zod';
import { GATE_REASON_TEXT, type GateScanResponse } from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { isStaff } from '../auth.ts';
import { scanGateCode } from '../domain/gate.ts';
import { log } from '../log.ts';
import { getCheckin, insideCount } from '../queries.ts';
import { readJson } from '../problem.ts';
import { leaveFloor } from '../social.ts';
import { publishSocialChange } from '../social-events.ts';
import { localDate } from '../time.ts';

const scanSchema = z.object({ code: z.string().min(1).max(200) });

export function gateRoutes({ db, config, live, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole({ secret: config.JWT_SECRET, db }, 'owner', 'desk'));

  routes.post('/scan', async (c) => {
    const { code } = await readJson(c, scanSchema);
    const at = now();
    const scan = scanGateCode(db, code, at, config.GYM_TIMEZONE);
    const checkin = getCheckin(db, scan.checkinId, localDate(at, config.GYM_TIMEZONE));
    if (!checkin) throw new Error(`Checkin ${scan.checkinId} missing right after insert`);

    const gym = { insideCount: insideCount(db, at), capacity: config.GYM_CAPACITY };
    live.publish({ type: 'checkin', checkin, gym }, (claims) => isStaff(claims) || claims.sub === scan.memberId);
    if (scan.granted && scan.memberId !== null && checkin.direction === 'out') {
      publishSocialChange(live, leaveFloor(db, scan.memberId, at));
    }
    log.info('gate scan', { checkinId: checkin.id, memberId: scan.memberId, result: checkin.result, reason: checkin.reason });

    const body: GateScanResponse = {
      checkin,
      reasonText: checkin.reason ? GATE_REASON_TEXT[checkin.reason] : null,
      gym,
    };
    return c.json(body);
  });

  return routes;
}
