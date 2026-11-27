// Bookings and the message thread.
// DemoBookingsSource reads fake rows from demo-bookings.json.
// A channel manager replaces lookupBooking, listMessages, sendMessage, and listInbox.
// Threads a guest writes are kept in sessionStorage only, on that browser.

import { PROPERTY } from './catalog.js';
import { enumerateNights } from './format.js';

const SESSION_KEY = 'melo_booking_session';
const THREAD_PREFIX = 'melo_booking_thread_';

export class BookingsSource {
  /** @returns {Promise<{mode: string, demo: boolean}>} */
  async describeBookings() {
    return { mode: 'none', demo: false };
  }

  /**
   * @param {{reference: string, surname?: string, email?: string, who?: string}} _query
   * @returns {Promise<import('./schema.js').GuestBooking|null>}
   */
  async lookupBooking(_query) {
    throw new Error('BookingsSource.lookupBooking is not implemented');
  }

  /** @returns {Promise<import('./schema.js').BookingMessage[]>} */
  async listMessages(_reference, _lang) {
    throw new Error('BookingsSource.listMessages is not implemented');
  }

  /**
   * @param {{reference: string, body: string, kind: string, captchaToken?: string}} _input
   */
  async sendMessage(_input) {
    throw new Error('BookingsSource.sendMessage is not implemented');
  }

  /** Messages the property can see. Demo mode returns only the sample file. */
  async listInbox() {
    return [];
  }
}

function normaliseReference(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function normaliseWho(value) {
  return String(value || '').trim().toLowerCase();
}

function threadKey(reference) {
  return THREAD_PREFIX + normaliseReference(reference);
}

function readThread(reference) {
  try {
    const raw = sessionStorage.getItem(threadKey(reference));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeThread(reference, messages) {
  sessionStorage.setItem(threadKey(reference), JSON.stringify(messages));
}

function resolveBody(body, lang) {
  if (body && typeof body === 'object') return body[lang] || body.en || '';
  return body || '';
}

export class DemoBookingsSource extends BookingsSource {
  constructor() {
    super();
    this.data = null;
  }

  async load() {
    if (this.data) return this.data;
    const response = await fetch('/app/data/demo-bookings.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('demo bookings ' + response.status);
    this.data = await response.json();
    return this.data;
  }

  async describeBookings() {
    return { mode: 'demo', demo: true };
  }

  async lookupBooking(query) {
    const data = await this.load();
    const reference = normaliseReference(query && query.reference);
    const who = normaliseWho(query && (query.who || query.surname || query.email));
    if (!reference || !who) return null;
    const found = (data.bookings || []).find((booking) => normaliseReference(booking.reference) === reference);
    if (!found) return null;
    const surname = normaliseWho(found.surname);
    const email = normaliseWho(found.email);
    const matches = who === surname || (email && who === email);
    if (!matches) return null;
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

  async listMessages(reference, lang) {
    const data = await this.load();
    const key = normaliseReference(reference);
    const seeds = (data.messages || [])
      .filter((message) => normaliseReference(message.reference) === key)
      .map((message) => ({
        id: message.id,
        reference: message.reference,
        from: message.from,
        kind: message.kind || 'note',
        at: message.at,
        body: resolveBody(message.body, lang),
        demo: true,
      }));
    return seeds.concat(readThread(reference));
  }

  async sendMessage(input) {
    const reference = normaliseReference(input && input.reference);
    const body = String(input && input.body || '').trim();
    const kind = input && input.kind || 'message';
    if (!reference || !body) throw new Error('empty message');
    const form = new FormData();
    form.append('access_key', PROPERTY.enquiry.accessKey);
    form.append('subject', 'Booking ' + reference + ' — ' + kind);
    form.append('message', body);
    form.append('booking_reference', reference);
    form.append('from_name', 'melo stay test booking');
    if (input.captchaToken) form.append('h-captcha-response', input.captchaToken);
    const response = await fetch(PROPERTY.enquiry.action, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) throw new Error(payload.message || 'send failed');
    const message = {
      id: 'local-' + Date.now(),
      reference,
      from: 'guest',
      kind,
      at: new Date().toISOString(),
      body,
      demo: true,
    };
    const thread = readThread(reference);
    thread.push(message);
    writeThread(reference, thread);
    return message;
  }

  async listInbox() {
    const data = await this.load();
    return (data.messages || []).map((message) => ({
      id: message.id,
      reference: message.reference,
      from: message.from,
      kind: message.kind || 'note',
      at: message.at,
      body: resolveBody(message.body, 'en'),
      demo: true,
    }));
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

export function clearBookingSession(reference) {
  sessionStorage.removeItem(SESSION_KEY);
  if (reference) sessionStorage.removeItem(threadKey(reference));
}
