// Bookings and the message centre.
// Demo data is fake. Guest and owner on the same browser share threads in
// localStorage so a test reply shows up on both sides. That is not a server.
// A channel manager, or something like Supabase, has to hold the real threads.

import { PROPERTY } from './catalog.js';
import { enumerateNights } from './format.js';

const SESSION_KEY = 'melo_booking_session';
const STORE_KEY = 'melo_demo_mail_v1';
export const ASK_THREAD = 'ASK';

const AUTO_REPLY = {
  en: {
    message: 'Thanks. This is an automatic test reply, not a person.',
    'early-checkin': 'Test reply: early check-in is sometimes possible from 13:00. We still need to confirm.',
    'late-checkout': 'Test reply: late checkout is sometimes possible until 12:00, if the room is free.',
    directions: 'Test reply: we are at 325 Jong-ro, Changsin Glass Tower, 5th–6th floor. About 5 minutes from Dongdaemun Station.',
    luggage: 'Test reply: luggage can be left before check-in or after check-out.',
    change: 'Test reply: we have your change or cancellation request. This test booking is not a real reservation.',
  },
  zh: {
    message: '收到。这是自动测试回复，不是人工答复。',
    'early-checkin': '测试回复：有时可以提前到 13:00 入住，仍需我们确认。',
    'late-checkout': '测试回复：如果房间空着，有时可以延迟到 12:00 退房。',
    directions: '测试回复：地址是钟路 325，昌信玻璃大厦 5–6 层，距东大门站步行约 5 分钟。',
    luggage: '测试回复：入住前或退房后都可以寄存行李。',
    change: '测试回复：已收到取消或改期请求。这是测试订单，不是真实预订。',
  },
  ko: {
    message: '받았습니다. 자동 테스트 답장이고, 사람이 쓴 답은 아닙니다.',
    'early-checkin': '테스트 답장: 얼리 체크인은 13:00부터 가능한 날이 있습니다. 확답은 따로 드립니다.',
    'late-checkout': '테스트 답장: 객실이 비어 있으면 12:00까지 레이트 체크아웃이 될 때가 있습니다.',
    directions: '테스트 답장: 종로 325, 창신글래스타워 5–6층입니다. 동대문역에서 걸어서 약 5분입니다.',
    luggage: '테스트 답장: 체크인 전이나 체크아웃 후에 짐을 맡기실 수 있습니다.',
    change: '테스트 답장: 취소·변경 요청을 받았습니다. 이 예약은 테스트용이며 실제 예약이 아닙니다.',
  },
  ja: {
    message: '受け取りました。自動のテスト返信で、担当者からの返事ではありません。',
    'early-checkin': 'テスト返信: アーリーチェックインは13:00から可能な場合があります。確定は別途ご連絡します。',
    'late-checkout': 'テスト返信: お部屋が空いていれば、12:00までのレイトチェックアウトが可能な場合があります。',
    directions: 'テスト返信: 鍾路325、昌信グラスタワー5–6階です。東大門駅から徒歩約5分です。',
    luggage: 'テスト返信: チェックイン前とチェックアウト後にお荷物をお預かりできます。',
    change: 'テスト返信: 取消または変更の依頼を受け取りました。この予約はテスト用で、実在の予約ではありません。',
  },
};

const memory = { threads: {} };

function storageGet() {
  try {
    if (typeof localStorage === 'undefined') return memory;
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : { threads: {} };
    if (!parsed.threads) parsed.threads = {};
    return parsed;
  } catch (err) {
    return memory;
  }
}

function storageSet(data) {
  try {
    if (typeof localStorage === 'undefined') {
      memory.threads = data.threads;
      return;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (err) {
    memory.threads = data.threads;
  }
}

export class BookingsSource {
  async describeBookings() {
    return { mode: 'none', demo: false };
  }

  async lookupBooking(_query) {
    throw new Error('BookingsSource.lookupBooking is not implemented');
  }

  async listThreads(_query) {
    throw new Error('BookingsSource.listThreads is not implemented');
  }

  async getThread(_id, _lang) {
    throw new Error('BookingsSource.getThread is not implemented');
  }

  async sendMessage(_input) {
    throw new Error('BookingsSource.sendMessage is not implemented');
  }

  async reply(_input) {
    throw new Error('BookingsSource.reply is not implemented');
  }

  async markRead(_id, _role) {
    throw new Error('BookingsSource.markRead is not implemented');
  }

  async listInbox() {
    return [];
  }

  async listMessages(_reference, _lang) {
    throw new Error('BookingsSource.listMessages is not implemented');
  }
}

function normaliseReference(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function normaliseWho(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveBody(body, lang) {
  if (body && typeof body === 'object') return body[lang] || body.en || '';
  return body || '';
}

function unreadCount(messages, role) {
  const incoming = role === 'owner' ? 'guest' : 'property';
  return messages.filter((message) => message.from === incoming && message.status !== 'read').length;
}

export class DemoBookingsSource extends BookingsSource {
  constructor() {
    super();
    this.data = null;
    this.emailEnabled = true;
  }

  async load() {
    if (!this.data) {
      const response = await fetch('/app/data/demo-bookings.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('demo bookings ' + response.status);
      this.data = await response.json();
    }
    this.mergeSeeds();
    return this.data;
  }

  mergeSeeds() {
    const store = storageGet();
    (this.data.messages || []).forEach((seed) => {
      const id = normaliseReference(seed.reference);
      if (!store.threads[id]) store.threads[id] = [];
      if (store.threads[id].some((message) => message.id === seed.id)) return;
      store.threads[id].push({
        id: seed.id,
        reference: id,
        from: seed.from || 'property',
        kind: seed.kind || 'note',
        at: seed.at,
        body: seed.body,
        status: 'sent',
        readAt: null,
        demo: true,
      });
    });
    if (!store.threads[ASK_THREAD]) store.threads[ASK_THREAD] = [];
    storageSet(store);
  }

  async describeBookings() {
    return { mode: 'demo', demo: true };
  }

  bookingByRef(reference) {
    const key = normaliseReference(reference);
    return (this.data.bookings || []).find((booking) => normaliseReference(booking.reference) === key) || null;
  }

  toGuestBooking(found) {
    const nights = enumerateNights(found.checkIn, found.checkOut);
    return {
      reference: found.reference,
      surname: found.surname,
      email: found.email,
      roomTypeId: found.roomTypeId,
      roomCode: found.roomCode,
      checkIn: found.checkIn,
      checkOut: found.checkOut,
      nights: nights.length,
      guests: found.guests,
      status: found.status,
      demo: true,
    };
  }

  async lookupBooking(query) {
    const data = await this.load();
    void data;
    const reference = normaliseReference(query && query.reference);
    const who = normaliseWho(query && (query.who || query.surname || query.email));
    if (!reference || !who) return null;
    const found = this.bookingByRef(reference);
    if (!found) return null;
    const surname = normaliseWho(found.surname);
    const email = normaliseWho(found.email);
    if (who !== surname && who !== email) return null;
    return this.toGuestBooking(found);
  }

  threadMessages(id) {
    const store = storageGet();
    return (store.threads[normaliseReference(id)] || store.threads[id] || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }

  present(message, lang) {
    return {
      id: message.id,
      reference: message.reference,
      from: message.from,
      kind: message.kind || 'message',
      at: message.at,
      body: resolveBody(message.body, lang),
      status: message.status || 'sent',
      readAt: message.readAt || null,
      demo: true,
    };
  }

  summary(id, role, lang) {
    const key = id === ASK_THREAD ? ASK_THREAD : normaliseReference(id);
    const messages = this.threadMessages(key).map((message) => this.present(message, lang));
    const last = messages[messages.length - 1];
    const booking = key === ASK_THREAD ? null : this.bookingByRef(key);
    return {
      id: key,
      kind: key === ASK_THREAD ? 'general' : 'booking',
      reference: key === ASK_THREAD ? null : (booking ? booking.reference : key),
      surname: booking ? booking.surname : '',
      checkIn: booking ? booking.checkIn : '',
      checkOut: booking ? booking.checkOut : '',
      preview: last ? last.body : '',
      at: last ? last.at : '',
      unread: unreadCount(messages, role),
      demo: true,
    };
  }

  async listThreads(query) {
    await this.load();
    const role = query && query.role === 'owner' ? 'owner' : 'guest';
    const lang = (query && query.lang) || 'en';
    if (role === 'owner') {
      const ids = (this.data.bookings || []).map((booking) => normaliseReference(booking.reference));
      ids.push(ASK_THREAD);
      return ids.map((id) => this.summary(id, 'owner', lang));
    }
    const threads = [];
    if (query && query.reference) threads.push(this.summary(query.reference, 'guest', lang));
    threads.push(this.summary(ASK_THREAD, 'guest', lang));
    return threads;
  }

  async listInbox() {
    return this.listThreads({ role: 'owner', lang: 'en' });
  }

  async getThread(id, lang) {
    await this.load();
    const key = id === ASK_THREAD ? ASK_THREAD : normaliseReference(id);
    const booking = key === ASK_THREAD ? null : this.bookingByRef(key);
    return {
      id: key,
      kind: key === ASK_THREAD ? 'general' : 'booking',
      booking: booking ? this.toGuestBooking(booking) : null,
      messages: this.threadMessages(key).map((message) => this.present(message, lang || 'en')),
      demo: true,
    };
  }

  async listMessages(reference, lang) {
    const thread = await this.getThread(reference, lang);
    return thread.messages;
  }

  async markRead(id, role) {
    await this.load();
    const key = id === ASK_THREAD ? ASK_THREAD : normaliseReference(id);
    const store = storageGet();
    const messages = store.threads[key] || [];
    const incoming = role === 'owner' ? 'guest' : 'property';
    const now = new Date().toISOString();
    messages.forEach((message) => {
      if (message.from === incoming && message.status !== 'read') {
        message.status = 'read';
        message.readAt = now;
      }
    });
    store.threads[key] = messages;
    storageSet(store);
    return this.getThread(key, 'en');
  }

  pushMessage(key, message) {
    const store = storageGet();
    if (!store.threads[key]) store.threads[key] = [];
    store.threads[key].push(message);
    storageSet(store);
  }

  async forwardEmail(reference, kind, body, captchaToken) {
    if (!this.emailEnabled || typeof fetch !== 'function') return false;
    try {
      const subject = reference === ASK_THREAD
        ? 'Ask melo stay — ' + kind
        : 'Booking ' + reference + ' — ' + kind;
      const form = new FormData();
      form.append('access_key', PROPERTY.enquiry.accessKey);
      form.append('subject', subject);
      form.append('message', body);
      form.append('booking_reference', reference);
      form.append('from_name', 'melo stay test booking');
      if (captchaToken) form.append('h-captcha-response', captchaToken);
      const response = await fetch(PROPERTY.enquiry.action, {
        method: 'POST',
        body: form,
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      return !!(response.ok && payload.success);
    } catch (err) {
      return false;
    }
  }

  async sendMessage(input) {
    await this.load();
    const reference = input && (input.threadId || input.reference);
    const key = !reference || reference === ASK_THREAD ? ASK_THREAD : normaliseReference(reference);
    const body = String(input && input.body || '').trim();
    const kind = (input && input.kind) || 'message';
    const lang = (input && input.lang) || 'en';
    if (!body) throw new Error('empty message');
    const emailed = await this.forwardEmail(key, kind, body, input && input.captchaToken);
    const now = Date.now();
    const message = {
      id: 'guest-' + now,
      reference: key,
      from: 'guest',
      kind,
      at: new Date(now).toISOString(),
      body,
      status: 'sent',
      readAt: null,
      demo: true,
    };
    this.pushMessage(key, message);
    const pack = AUTO_REPLY[lang] || AUTO_REPLY.en;
    const reply = {
      id: 'auto-' + (now + 1),
      reference: key,
      from: 'property',
      kind: 'auto',
      at: new Date(now + 1000).toISOString(),
      body: pack[kind] || pack.message,
      status: 'sent',
      readAt: null,
      demo: true,
    };
    this.pushMessage(key, reply);
    return { message: this.present(message, lang), reply: this.present(reply, lang), emailed };
  }

  async reply(input) {
    await this.load();
    const reference = input && (input.threadId || input.reference);
    const key = !reference || reference === ASK_THREAD ? ASK_THREAD : normaliseReference(reference);
    const body = String(input && input.body || '').trim();
    if (!body) throw new Error('empty message');
    const message = {
      id: 'owner-' + Date.now(),
      reference: key,
      from: 'property',
      kind: 'reply',
      at: new Date().toISOString(),
      body,
      status: 'sent',
      readAt: null,
      demo: true,
    };
    this.pushMessage(key, message);
    return this.present(message, (input && input.lang) || 'en');
  }
}

export function readBookingSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !parsed.reference || !parsed.who) return null;
    return { reference: String(parsed.reference), who: String(parsed.who) };
  } catch (err) {
    return null;
  }
}

export function writeBookingSession(reference, who) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    reference: normaliseReference(reference),
    who: String(who || '').trim(),
  }));
}

export function clearBookingSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* ignore */ }
}
