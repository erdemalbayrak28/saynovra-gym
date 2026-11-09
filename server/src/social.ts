import {
  MUSCLE_GROUP_TEXT,
  type ChatResponse,
  type FloorEvent,
  type GymSpot,
  type MuscleGroup,
  type OpenPostRequest,
  type PublicMember,
  type RadarResponse,
  type SpotMessageDto,
  type SpotRequestDto,
  type SpotRequestStatus,
  type SpotterPostDto,
} from '../../shared/contract.ts';
import { transaction, type Db } from './db.ts';
import { displayName, nextSpotStatus, type SpotEvent } from './domain/spot.ts';
import { HttpProblem } from './problem.ts';
import { initials, insideMemberIds, lastGrantedCheckin } from './queries.ts';
import { hoursAgo } from './time.ts';

const FLOOR_FEED_HOURS = 3;
const FLOOR_FEED_LIMIT = 10;
const LIVE_STATUSES = "('pending', 'accepted')";

/** What a mutation changed, so the caller can push exactly the right live events. */
export interface SocialChange {
  radarChanged: boolean;
  requests: SpotRequestDto[];
  floor: FloorEvent[];
}

const noChange = (): SocialChange => ({ radarChanged: false, requests: [], floor: [] });

function merge(a: SocialChange, b: SocialChange): SocialChange {
  return { radarChanged: a.radarChanged || b.radarChanged, requests: [...a.requests, ...b.requests], floor: [...a.floor, ...b.floor] };
}

// ---------------------------------------------------------------------------
// Rows and mapping
// ---------------------------------------------------------------------------

interface PostRow {
  id: number;
  member_id: number;
  muscle_group: MuscleGroup;
  location: GymSpot;
  note: string;
  created_at: string;
  closed_at: string | null;
  full_name: string;
}

interface RequestRow {
  id: number;
  post_id: number;
  from_member_id: number;
  status: SpotRequestStatus;
  created_at: string;
  modified_at: string;
  to_member_id: number;
  location: GymSpot;
  muscle_group: MuscleGroup;
  from_name: string;
  to_name: string;
}

const POST_SELECT = 'SELECT p.*, m.full_name FROM spotter_posts p JOIN members m ON m.id = p.member_id';
const REQUEST_SELECT = `
  SELECT r.id, r.post_id, r.from_member_id, r.status, r.created_at, r.modified_at,
    p.member_id AS to_member_id, p.location, p.muscle_group, fm.full_name AS from_name, tm.full_name AS to_name
  FROM spot_requests r
  JOIN spotter_posts p ON p.id = r.post_id
  JOIN members fm ON fm.id = r.from_member_id
  JOIN members tm ON tm.id = p.member_id`;

export function publicMember(id: number, fullName: string): PublicMember {
  return { id, displayName: displayName(fullName), initials: initials(fullName) };
}

function toRequest(row: RequestRow): SpotRequestDto {
  return {
    id: row.id,
    postId: row.post_id,
    status: row.status,
    from: publicMember(row.from_member_id, row.from_name),
    to: publicMember(row.to_member_id, row.to_name),
    location: row.location,
    muscleGroup: row.muscle_group,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

function getRequest(db: Db, id: number): SpotRequestDto | undefined {
  const row = db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id) as RequestRow | undefined;
  return row ? toRequest(row) : undefined;
}

function openPostOf(db: Db, memberId: number): PostRow | undefined {
  return db.prepare(`${POST_SELECT} WHERE p.member_id = ? AND p.closed_at IS NULL`).get(memberId) as PostRow | undefined;
}

function toPost(db: Db, row: PostRow, viewerId: number): SpotterPostDto {
  const mine = row.member_id === viewerId;
  const myRequest = mine
    ? undefined
    : (db
        .prepare(`SELECT id, status FROM spot_requests WHERE post_id = ? AND from_member_id = ? AND status IN ${LIVE_STATUSES}`)
        .get(row.id, viewerId) as { id: number; status: SpotRequestStatus } | undefined);
  return {
    id: row.id,
    member: publicMember(row.member_id, row.full_name),
    muscleGroup: row.muscle_group,
    location: row.location,
    note: row.note,
    createdAt: row.created_at,
    enteredAt: lastGrantedCheckin(db, row.member_id)?.created_at ?? null,
    mine,
    myRequest: myRequest ?? null,
  };
}

function postOpenedEvent(row: { id: number; created_at: string; location: GymSpot; muscle_group: MuscleGroup; full_name: string }): FloorEvent {
  return {
    id: `post-${row.id}`,
    at: row.created_at,
    kind: 'post_opened',
    text: `${displayName(row.full_name)}, ${row.location} için spotter arıyor (${MUSCLE_GROUP_TEXT[row.muscle_group]})`,
  };
}

function matchedEvent(request: SpotRequestDto): FloorEvent {
  return {
    id: `match-${request.id}`,
    at: request.modifiedAt,
    kind: 'matched',
    text: `${request.from.displayName} ve ${request.to.displayName} eşleşti · ${request.location}`,
  };
}

// ---------------------------------------------------------------------------
// State changes
// ---------------------------------------------------------------------------

function transition(db: Db, request: SpotRequestDto, event: SpotEvent, now: Date): SpotRequestDto {
  const next = nextSpotStatus(request.status, event);
  if (!next) throw new HttpProblem(409, 'İşlem yapılamadı', 'Bu istek artık bu işlemi kabul etmiyor');
  db.prepare('UPDATE spot_requests SET status = ?, modified_at = ? WHERE id = ?').run(next, now.toISOString(), request.id);
  const updated = getRequest(db, request.id);
  if (!updated) throw new Error(`Spot request ${request.id} vanished`);
  return updated;
}

function expireWhere(db: Db, where: string, param: number, now: Date, statuses = LIVE_STATUSES): SpotRequestDto[] {
  const rows = db.prepare(`${REQUEST_SELECT} WHERE ${where} AND r.status IN ${statuses}`).all(param) as unknown as RequestRow[];
  return rows.map((row) => transition(db, toRequest(row), 'expire', now));
}

/** Closes a post. Pending requests on it expire; an accepted pairing made from it lives on. */
function closePostRow(db: Db, postId: number, now: Date): SocialChange {
  db.prepare('UPDATE spotter_posts SET closed_at = ? WHERE id = ? AND closed_at IS NULL').run(now.toISOString(), postId);
  return { radarChanged: true, requests: expireWhere(db, 'r.post_id = ?', postId, now, "('pending')"), floor: [] };
}

function requireInside(db: Db, memberId: number, now: Date): void {
  if (!insideMemberIds(db, now).has(memberId)) {
    throw new HttpProblem(409, 'Salonda değilsin', 'Buddy radarı yalnızca salona giriş yapan üyeler içindir');
  }
}

/** Closes posts and ends pairings of members who are no longer inside (left without a scan, or timed out). */
export function closeStalePosts(db: Db, now: Date): SocialChange {
  return transaction(db, () => {
    const inside = insideMemberIds(db, now);
    let change = noChange();
    const open = db.prepare('SELECT id, member_id FROM spotter_posts WHERE closed_at IS NULL').all() as unknown as { id: number; member_id: number }[];
    for (const post of open) if (!inside.has(post.member_id)) change = merge(change, closePostRow(db, post.id, now));

    const live = db
      .prepare(`${REQUEST_SELECT} WHERE r.status IN ${LIVE_STATUSES}`)
      .all() as unknown as RequestRow[];
    const stray = live.filter((row) => !inside.has(row.from_member_id) || !inside.has(row.to_member_id));
    return merge(change, { ...noChange(), requests: stray.map((row) => transition(db, toRequest(row), 'expire', now)) });
  });
}

/** Everything social ends when a member walks out: their post closes, their requests and pairings expire. */
export function leaveFloor(db: Db, memberId: number, now: Date): SocialChange {
  return transaction(db, () => {
    const post = openPostOf(db, memberId);
    const closed = post ? closePostRow(db, post.id, now) : noChange();
    const expired = [...expireWhere(db, 'r.from_member_id = ?', memberId, now), ...expireWhere(db, 'p.member_id = ?', memberId, now)];
    return merge(closed, { ...noChange(), requests: expired });
  });
}

export function radar(db: Db, viewerId: number, now: Date): RadarResponse {
  const inside = insideMemberIds(db, now);
  if (!inside.has(viewerId)) return { inside: false, myPost: null, incoming: [], outgoing: [], matches: [], posts: [] };

  const own = openPostOf(db, viewerId);
  const requests = (
    db.prepare(`${REQUEST_SELECT} WHERE (r.from_member_id = ? OR p.member_id = ?) AND r.status IN ${LIVE_STATUSES} ORDER BY r.created_at`).all(viewerId, viewerId) as unknown as RequestRow[]
  ).map(toRequest);
  const posts = (db.prepare(`${POST_SELECT} WHERE p.closed_at IS NULL AND p.member_id <> ? ORDER BY p.created_at DESC`).all(viewerId) as unknown as PostRow[])
    .filter((row) => inside.has(row.member_id))
    .map((row) => toPost(db, row, viewerId));

  return {
    inside: true,
    myPost: own ? toPost(db, own, viewerId) : null,
    incoming: requests.filter((r) => r.status === 'pending' && r.to.id === viewerId),
    outgoing: requests.filter((r) => r.status === 'pending' && r.from.id === viewerId),
    matches: requests.filter((r) => r.status === 'accepted'),
    posts,
  };
}

/** Opens the member's post, or updates it if one is already open. */
export function openPost(db: Db, memberId: number, input: OpenPostRequest, now: Date): { post: SpotterPostDto; change: SocialChange } {
  return transaction(db, () => {
    requireInside(db, memberId, now);
    const existing = openPostOf(db, memberId);
    if (existing) {
      db.prepare('UPDATE spotter_posts SET muscle_group = ?, location = ?, note = ? WHERE id = ?').run(input.muscleGroup, input.location, input.note, existing.id);
    } else {
      db.prepare('INSERT INTO spotter_posts (member_id, muscle_group, location, note, created_at) VALUES (?, ?, ?, ?, ?)').run(
        memberId, input.muscleGroup, input.location, input.note, now.toISOString(),
      );
    }
    const row = openPostOf(db, memberId);
    if (!row) throw new Error('Post vanished right after write');
    return {
      post: toPost(db, row, memberId),
      change: { radarChanged: true, requests: [], floor: existing ? [] : [postOpenedEvent(row)] },
    };
  });
}

export function closePost(db: Db, memberId: number, now: Date): SocialChange {
  return transaction(db, () => {
    const post = openPostOf(db, memberId);
    return post ? closePostRow(db, post.id, now) : noChange();
  });
}

export function sendRequest(db: Db, fromId: number, postId: number, now: Date): { request: SpotRequestDto; change: SocialChange } {
  return transaction(db, () => {
    requireInside(db, fromId, now);
    const post = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(postId) as PostRow | undefined;
    if (!post || post.closed_at !== null || !insideMemberIds(db, now).has(post.member_id)) {
      throw new HttpProblem(404, 'İlan bulunamadı', 'Bu ilan kapanmış olabilir');
    }
    if (post.member_id === fromId) throw new HttpProblem(400, 'Geçersiz istek', 'Kendi ilanına istek gönderemezsin');
    const live = db.prepare(`SELECT id FROM spot_requests WHERE post_id = ? AND from_member_id = ? AND status IN ${LIVE_STATUSES}`).get(postId, fromId);
    if (live) throw new HttpProblem(409, 'Zaten istek gönderdin', 'Bu ilana gönderdiğin istek hâlâ açık');

    const stamp = now.toISOString();
    const result = db
      .prepare("INSERT INTO spot_requests (post_id, from_member_id, status, created_at, modified_at) VALUES (?, ?, 'pending', ?, ?)")
      .run(postId, fromId, stamp, stamp);
    const request = getRequest(db, Number(result.lastInsertRowid));
    if (!request) throw new Error('Spot request vanished right after insert');
    return { request, change: { radarChanged: false, requests: [request], floor: [] } };
  });
}

/** The post owner accepts or declines; the sender cancels. */
export function actOnRequest(
  db: Db,
  memberId: number,
  requestId: number,
  event: 'accept' | 'decline' | 'cancel',
  now: Date,
): { request: SpotRequestDto; change: SocialChange } {
  return transaction(db, () => {
    const request = getRequest(db, requestId);
    const allowed = request && (event === 'cancel' ? request.from.id === memberId : request.to.id === memberId);
    if (!request || !allowed) throw new HttpProblem(404, 'İstek bulunamadı');
    const updated = transition(db, request, event, now);
    if (updated.status !== 'accepted') return { request: updated, change: { ...noChange(), requests: [updated] } };

    // Once paired, neither member is looking any more: both posts close, other pending requests expire.
    let change: SocialChange = { radarChanged: true, requests: [updated], floor: [matchedEvent(updated)] };
    change = merge(change, closePostRow(db, updated.postId, now));
    const requesterPost = openPostOf(db, updated.from.id);
    if (requesterPost) change = merge(change, closePostRow(db, requesterPost.id, now));
    return { request: updated, change };
  });
}

function participantRequest(db: Db, memberId: number, requestId: number): SpotRequestDto {
  const request = getRequest(db, requestId);
  if (!request || (request.from.id !== memberId && request.to.id !== memberId)) throw new HttpProblem(404, 'Sohbet bulunamadı');
  return request;
}

export function chat(db: Db, memberId: number, requestId: number): ChatResponse {
  const request = participantRequest(db, memberId, requestId);
  const messages = db
    .prepare('SELECT id, request_id, sender_member_id, body, created_at FROM spot_messages WHERE request_id = ? ORDER BY id')
    .all(requestId) as unknown as { id: number; request_id: number; sender_member_id: number; body: string; created_at: string }[];
  return {
    request,
    messages: messages.map((m) => ({ id: m.id, requestId: m.request_id, senderId: m.sender_member_id, body: m.body, createdAt: m.created_at })),
    canSend: request.status === 'accepted',
  };
}

export function sendMessage(db: Db, memberId: number, requestId: number, body: string, now: Date): { message: SpotMessageDto; request: SpotRequestDto } {
  return transaction(db, () => {
    const request = participantRequest(db, memberId, requestId);
    if (request.status !== 'accepted') throw new HttpProblem(409, 'Mesaj gönderilemedi', 'Sohbet yalnızca eşleşme sürerken açık');
    const stamp = now.toISOString();
    const result = db.prepare('INSERT INTO spot_messages (request_id, sender_member_id, body, created_at) VALUES (?, ?, ?, ?)').run(requestId, memberId, body, stamp);
    return { message: { id: Number(result.lastInsertRowid), requestId, senderId: memberId, body, createdAt: stamp }, request };
  });
}

/** Recent posts and current matches for staff screens. */
export function floorFeed(db: Db, now: Date): FloorEvent[] {
  const since = hoursAgo(now, FLOOR_FEED_HOURS);
  const posts = (
    db.prepare(`${POST_SELECT} WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT ?`).all(since, FLOOR_FEED_LIMIT) as unknown as PostRow[]
  ).map(postOpenedEvent);
  const matches = (
    db.prepare(`${REQUEST_SELECT} WHERE r.status = 'accepted' AND r.modified_at >= ? ORDER BY r.modified_at DESC LIMIT ?`).all(since, FLOOR_FEED_LIMIT) as unknown as RequestRow[]
  ).map((row) => matchedEvent(toRequest(row)));
  return [...posts, ...matches].sort((a, b) => b.at.localeCompare(a.at)).slice(0, FLOOR_FEED_LIMIT);
}
