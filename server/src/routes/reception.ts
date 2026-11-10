import { Hono } from 'hono';
import { z } from 'zod';
import { MEMBER_SEARCH_MIN, type CreateMemberResponse } from '../../../shared/contract.ts';
import { KVKK_NOTICE_VERSION } from '../../../shared/consent.ts';
import type { AppDeps } from '../app.ts';
import { isStaff } from '../auth.ts';
import { log } from '../log.ts';
import type { AppEnv } from '../middleware.ts';
import { issueActivation, registerMember } from '../onboarding.ts';
import { HttpProblem, readJson, validate } from '../problem.ts';
import { phoneSchema } from './auth.ts';
import {
  cancelMembership,
  expiringMembers,
  freezeMembership,
  listPlans,
  memberDetail,
  receptionSummary,
  searchMembers,
  sellMembership,
  unfreezeMembership,
  type StaffAction,
} from '../reception.ts';
import { localDate, startOfLocalDay } from '../time.ts';

const idSchema = z.coerce.number().int().positive();
const searchSchema = z.object({
  q: z.string().trim().min(MEMBER_SEARCH_MIN, `En az ${MEMBER_SEARCH_MIN} karakter yazın`).max(60),
});
const saleSchema = z.object({
  planId: z.number().int().positive(),
  method: z.enum(['cash', 'card', 'transfer']),
});

const OPTIONAL_PROFILE_FIELDS = ['birthYear', 'gender', 'heightCm', 'weightKg', 'goal'] as const;

const createMemberSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
    phone: phoneSchema,
    noticeVersion: z.literal(KVKK_NOTICE_VERSION, { message: 'Aydınlatma metni güncellendi; sayfayı yenileyip yeni metni gösterin' }),
    consents: z.object({
      notice: z.literal(true, { message: 'Aydınlatma metninin okunduğu onaylanmalı' }),
      optionalData: z.boolean(),
    }),
    profile: z.object({
      birthYear: z.number().int().min(1920).max(2015).nullable().default(null),
      gender: z.enum(['f', 'm', 'x']).nullable().default(null),
      heightCm: z.number().int().min(120).max(230).nullable().default(null),
      weightKg: z.number().min(30).max(250).nullable().default(null),
      goal: z.enum(['lose', 'gain', 'fit', 'strength']).nullable().default(null),
    }),
    sale: saleSchema.nullable().default(null),
  })
  // Without explicit consent the optional fields are refused, not silently dropped.
  .superRefine((input, ctx) => {
    if (input.consents.optionalData) return;
    for (const field of OPTIONAL_PROFILE_FIELDS) {
      if (input.profile[field] !== null) {
        ctx.addIssue({ code: 'custom', path: ['profile', field], message: 'İsteğe bağlı bilgi için açık rıza gerekli' });
      }
    }
  });

const MEMBERSHIP_ACTIONS = {
  freeze: freezeMembership,
  unfreeze: unfreezeMembership,
  cancel: cancelMembership,
} as const;

/** Reception desk, mounted under /staff (the parent requires an owner or desk token). */
export function receptionRoutes({ db, config, live, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const actionFor = (staffId: number): StaffAction => {
    const at = now();
    return { staffId, now: at, today: localDate(at, config.GYM_TIMEZONE) };
  };
  // Staff screens refresh the member; the member's own phone refetches its membership.
  const announce = (memberId: number, fields: Record<string, unknown>) => {
    live.publish({ type: 'membership', memberId }, (claims) => isStaff(claims) || (claims.role === 'member' && claims.sub === memberId));
    log.info('reception change', { memberId, ...fields });
  };

  routes.get('/plans', (c) => c.json(listPlans(db)));

  routes.get('/reception/summary', (c) => {
    const at = now();
    return c.json(receptionSummary(db, localDate(at, config.GYM_TIMEZONE), startOfLocalDay(at, config.GYM_TIMEZONE)));
  });

  routes.get('/members/expiring', (c) => {
    const at = now();
    return c.json(expiringMembers(db, localDate(at, config.GYM_TIMEZONE), at));
  });

  routes.get('/members', (c) => {
    const { q } = validate(searchSchema, c.req.query());
    const at = now();
    return c.json(searchMembers(db, q, localDate(at, config.GYM_TIMEZONE), at));
  });

  routes.get('/members/:id', (c) => {
    const at = now();
    return c.json(memberDetail(db, validate(idSchema, c.req.param('id')), localDate(at, config.GYM_TIMEZONE), at));
  });

  routes.post('/members', async (c) => {
    const request = await readJson(c, createMemberSchema);
    const action = actionFor(c.get('auth').sub);
    const { memberId, activation } = await registerMember(db, request, action);
    live.publish({ type: 'member', memberId }, isStaff);
    log.info('member registered', { memberId, staffId: action.staffId, sale: request.sale !== null, optionalData: request.consents.optionalData });
    c.header('Cache-Control', 'no-store');
    const body: CreateMemberResponse = { detail: memberDetail(db, memberId, action.today, action.now), activation };
    return c.json(body, 201);
  });

  routes.post('/members/:id/activation', async (c) => {
    const memberId = validate(idSchema, c.req.param('id'));
    const action = actionFor(c.get('auth').sub);
    const activation = await issueActivation(db, memberId, action);
    live.publish({ type: 'member', memberId }, isStaff);
    log.info('activation code issued', { memberId, staffId: action.staffId });
    c.header('Cache-Control', 'no-store');
    return c.json(activation, 201);
  });

  routes.post('/members/:id/memberships', async (c) => {
    const memberId = validate(idSchema, c.req.param('id'));
    const request = await readJson(c, saleSchema);
    const action = actionFor(c.get('auth').sub);
    const membershipId = sellMembership(db, memberId, request, action);
    announce(memberId, { action: 'sale', membershipId, planId: request.planId, staffId: action.staffId });
    return c.json(memberDetail(db, memberId, action.today, action.now), 201);
  });

  for (const [name, run] of Object.entries(MEMBERSHIP_ACTIONS)) {
    routes.post(`/memberships/:id/${name}`, (c) => {
      const { role, sub } = c.get('auth');
      if (name === 'cancel' && role !== 'owner') {
        throw new HttpProblem(403, 'Yetki yok', 'Üyelik iptalini yalnızca salon sahibi yapabilir');
      }
      const membershipId = validate(idSchema, c.req.param('id'));
      const action = actionFor(sub);
      const memberId = run(db, membershipId, action);
      announce(memberId, { action: name, membershipId, staffId: action.staffId });
      return c.json(memberDetail(db, memberId, action.today, action.now));
    });
  }

  return routes;
}
