import { Hono } from 'hono';
import { z } from 'zod';
import { MEMBER_SEARCH_MIN, type CreateMemberResponse } from '../../../shared/contract.ts';
import { KVKK_NOTICE_VERSION, KVKK_TRAINER_NOTICE_VERSION } from '../../../shared/consent.ts';
import type { AppDeps } from '../app.ts';
import { isStaff } from '../auth.ts';
import { log } from '../log.ts';
import type { AppEnv } from '../middleware.ts';
import { issueActivation, registerMember } from '../onboarding.ts';
import { HttpProblem, readJson, validate } from '../problem.ts';
import { phoneSchema } from './auth.ts';
import {
  assignTrainer,
  cancelMembership,
  expiringMembers,
  freezeMembership,
  listPlans,
  listTrainers,
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

const NOTICE_VERSION = { member: KVKK_NOTICE_VERSION, trainer: KVKK_TRAINER_NOTICE_VERSION } as const;
const trainerSchema = z.object({ trainerId: z.number().int().positive().nullable() });

const createMemberSchema = z
  .object({
    role: z.enum(['member', 'trainer']).default('member'),
    fullName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
    phone: phoneSchema,
    noticeVersion: z.string().max(20),
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
    if (input.noticeVersion !== NOTICE_VERSION[input.role]) {
      ctx.addIssue({ code: 'custom', path: ['noticeVersion'], message: 'Aydınlatma metni güncellendi; sayfayı yenileyip yeni metni gösterin' });
    }
    // A trainer account is only the account: no package, no optional profile.
    if (input.role === 'trainer') {
      if (input.sale) ctx.addIssue({ code: 'custom', path: ['sale'], message: 'Eğitmen hesabına paket satılmaz' });
      if (input.consents.optionalData) ctx.addIssue({ code: 'custom', path: ['consents', 'optionalData'], message: 'Eğitmen hesabında isteğe bağlı bilgi tutulmaz' });
    }
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
    const { role, sub } = c.get('auth');
    if (request.role === 'trainer' && role !== 'owner') {
      throw new HttpProblem(403, 'Yetki yok', 'Eğitmen hesabını yalnızca salon sahibi açabilir');
    }
    const action = actionFor(sub);
    const { memberId, activation } = await registerMember(db, request, action);
    live.publish({ type: 'member', memberId }, isStaff);
    log.info('account registered', { memberId, role: request.role, staffId: action.staffId, sale: request.sale !== null, optionalData: request.consents.optionalData });
    c.header('Cache-Control', 'no-store');
    const body: CreateMemberResponse = { detail: memberDetail(db, memberId, action.today, action.now), activation };
    return c.json(body, 201);
  });

  routes.get('/trainers', (c) => c.json(listTrainers(db)));

  routes.post('/members/:id/trainer', async (c) => {
    const memberId = validate(idSchema, c.req.param('id'));
    const { trainerId } = await readJson(c, trainerSchema);
    const action = actionFor(c.get('auth').sub);
    const previous = assignTrainer(db, memberId, trainerId, action);
    // Staff screens, the member, and both the old and the new trainer refetch.
    const involved = new Set([memberId, previous, trainerId]);
    live.publish({ type: 'training', memberId }, (claims) => isStaff(claims) || involved.has(claims.sub));
    log.info('trainer assigned', { memberId, trainerId, staffId: action.staffId });
    return c.json(memberDetail(db, memberId, action.today, action.now));
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
