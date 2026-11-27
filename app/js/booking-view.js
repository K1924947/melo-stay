import { el } from './dom.js';
import { PROPERTY, ROOMS_BY_ID } from './catalog.js';
import { enumerateNights } from './format.js';
import {
  clearBookingSession,
  readBookingSession,
  writeBookingSession,
} from './bookings-source.js';

const ICONS = {
  booking: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M8 12h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

let ctx = null;
let session = null;
let booking = null;
let messages = [];
let draft = '';
let kind = 'message';
let notice = '';
let error = '';
let busy = false;
let captchaStarted = false;
let refDraft = '';
let whoDraft = '';
let ticket = 0;

function mount(page) {
  if (document.body.dataset.tab !== 'booking') return page;
  const main = document.getElementById('main');
  if (!main) return page;
  const offline = main.querySelector('.banner.offline');
  main.replaceChildren();
  if (offline) main.append(offline);
  main.append(page);
  return page;
}

export function bookingIcon() {
  return ICONS.booking;
}

export function restoreBookingSession() {
  session = readBookingSession();
}

function statusKind(status) {
  if (status === 'cancelled') return 'closed';
  if (status === 'pending') return 'few';
  return 'open';
}

function roomLabel() {
  if (!booking) return '';
  const room = ROOMS_BY_ID[booking.roomTypeId];
  if (!room) return booking.roomCode;
  const copy = room.copy[ctx.lang] || room.copy.en;
  return copy.name;
}

function nightsText() {
  const count = booking.nights || enumerateNights(booking.checkIn, booking.checkOut).length;
  if (count === 1) return ctx.t('dates_1_night');
  return ctx.t('dates_nights', { n: String(count) });
}

async function refresh() {
  if (!session) {
    booking = null;
    messages = [];
    return;
  }
  booking = await ctx.source.lookupBooking({ reference: session.reference, who: session.who });
  if (!booking) {
    clearBookingSession(session.reference);
    session = null;
    messages = [];
    error = ctx.t('booking_missing');
    return;
  }
  messages = await ctx.source.listMessages(booking.reference, ctx.lang);
}

function ensureCaptcha() {
  if (captchaStarted) return;
  captchaStarted = true;
  const script = document.createElement('script');
  script.src = 'https://web3forms.com/client/script.js';
  script.async = true;
  document.body.appendChild(script);
}

function ensureForm() {
  let form = document.getElementById('bookingForm');
  if (form) return form;
  form = el('form', { id: 'bookingForm', class: 'booking-form' });
  form.append(
    el('label', { class: 'field' }, [
      el('span', { 'data-i18n': 'booking_thread' }, ''),
      el('textarea', { name: 'message', rows: '3', required: true }),
    ]),
    el('input', { type: 'hidden', name: 'access_key', value: PROPERTY.enquiry.accessKey }),
    el('input', { type: 'checkbox', name: 'botcheck', tabindex: '-1', autocomplete: 'off', class: 'botcheck', 'aria-hidden': 'true' }),
    el('div', { class: 'h-captcha', 'data-captcha': 'true' }),
    el('p', { class: 'booking-notice', role: 'status' }),
    el('button', { type: 'submit', class: 'btn btn-ink' }, [el('span', { 'data-i18n': 'booking_send' }, '')]),
  );
  form.querySelector('textarea').addEventListener('input', (event) => {
    draft = event.target.value;
    if (kind !== 'message' && event.target.value.trim() === '') kind = 'message';
  });
  form.addEventListener('submit', onSubmit);
  document.getElementById('formPark').append(form);
  return form;
}

async function onSubmit(event) {
  event.preventDefault();
  if (!booking || busy) return;
  const form = event.currentTarget;
  const body = draft.trim();
  if (!body) return;
  busy = true;
  notice = '';
  error = '';
  const tokenField = form.querySelector('[name="h-captcha-response"]');
  try {
    await ctx.source.sendMessage({
      reference: booking.reference,
      body,
      kind,
      captchaToken: tokenField ? tokenField.value : '',
    });
    draft = '';
    kind = 'message';
    notice = ctx.t('booking_sent');
    messages = await ctx.source.listMessages(booking.reference, ctx.lang);
  } catch (err) {
    error = ctx.t('booking_fail');
  } finally {
    busy = false;
    renderBooking(ctx);
  }
}

function paintForm() {
  const form = ensureForm();
  form.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = ctx.t(node.getAttribute('data-i18n'));
  });
  const area = form.querySelector('textarea');
  area.placeholder = ctx.t('booking_placeholder');
  if (document.activeElement !== area && area.value !== draft) area.value = draft;
  const status = form.querySelector('.booking-notice');
  status.replaceChildren();
  if (notice) status.append(el('span', { class: 'status-line' }, [
    el('span', { class: 'mark mark-open', 'aria-hidden': 'true' }),
    el('span', {}, notice),
  ]));
  if (error) status.append(el('span', { class: 'status-line' }, [
    el('span', { class: 'mark mark-ask', 'aria-hidden': 'true' }),
    el('span', {}, error),
  ]));
  form.querySelector('button[type="submit"]').disabled = busy;
  return form;
}

function quick(nextKind, key) {
  kind = nextKind;
  draft = ctx.t(key);
  notice = '';
  error = '';
  renderBooking(ctx);
}

export async function renderBooking(next) {
  ctx = next;
  const mine = ++ticket;
  const page = el('div', { class: 'page' });
  page.append(el('h1', {}, ctx.t('booking_h')));
  const demo = await ctx.source.describeBookings();
  if (demo.demo) page.append(el('p', { class: 'banner' }, ctx.t('booking_demo')));

  if (!session) session = readBookingSession();
  if (session && !booking) {
    try { await refresh(); } catch (err) { error = ctx.t('booking_fail'); }
  }
  if (mine !== ticket) return;

  if (!booking) {
    const ref = el('input', { name: 'reference', autocomplete: 'off', autocapitalize: 'characters', value: refDraft });
    const who = el('input', { name: 'who', autocomplete: 'username', value: whoDraft });
    ref.addEventListener('input', () => { refDraft = ref.value; });
    who.addEventListener('input', () => { whoDraft = who.value; });
    const loginError = el('p', { class: 'field-error', hidden: !error }, error || ctx.t('booking_missing'));
    page.append(el('form', {
      class: 'card',
      onsubmit: async (event) => {
        event.preventDefault();
        error = '';
        const found = await ctx.source.lookupBooking({ reference: ref.value, who: who.value });
        if (!found) {
          error = ctx.t('booking_missing');
          renderBooking(ctx);
          return;
        }
        writeBookingSession(found.reference, who.value);
        session = readBookingSession();
        booking = found;
        messages = await ctx.source.listMessages(found.reference, ctx.lang);
        renderBooking(ctx);
      },
    }, [
      el('p', { class: 'lede' }, ctx.t('booking_login_p')),
      el('label', { class: 'field' }, [el('span', {}, ctx.t('booking_ref')), ref]),
      el('label', { class: 'field' }, [el('span', {}, ctx.t('booking_who')), who]),
      loginError,
      el('button', { type: 'submit', class: 'btn btn-accent' }, ctx.t('booking_enter')),
    ]));
    return mount(page);
  }

  const status = booking.status || 'confirmed';
  page.append(el('article', { class: 'card booking-card' }, [
    el('p', { class: 'booking-ref' }, booking.reference),
    el('p', { class: 'status-line' }, [
      el('span', { class: 'mark mark-' + statusKind(status), 'aria-hidden': 'true' }),
      el('span', {}, ctx.t('booking_status_' + status)),
    ]),
    el('h2', {}, roomLabel()),
    el('p', {}, ctx.t('dates_checkin') + ' ' + booking.checkIn),
    el('p', {}, ctx.t('dates_checkout') + ' ' + booking.checkOut + ' · ' + nightsText()),
    el('p', {}, ctx.t('booking_guests', { n: String(booking.guests) })),
    el('div', { class: 'time-grid' }, [
      el('div', { class: 'time-card' }, [
        el('span', {}, ctx.t('booking_checkin')),
        el('strong', {}, PROPERTY.checkIn),
      ]),
      el('div', { class: 'time-card' }, [
        el('span', {}, ctx.t('booking_checkout')),
        el('strong', {}, PROPERTY.checkOut),
      ]),
    ]),
    el('h2', {}, ctx.t('booking_address')),
    el('p', {}, ctx.t('footer_address')),
    el('a', { class: 'btn btn-accent', href: PROPERTY.mapUrl, target: '_blank', rel: 'noopener' }, ctx.t('map_open')),
    el('p', { class: 'note' }, ctx.t('loc_ddm_l') + ' · ' + ctx.t('loc_ddm_v')),
    el('p', { class: 'note' }, ctx.t('loc_dm_l') + ' · ' + ctx.t('loc_dm_v')),
    el('h2', {}, ctx.t('booking_door_h')),
    el('p', {}, ctx.t('booking_door_p')),
    el('h2', {}, ctx.t('booking_house_h')),
    el('p', {}, ctx.t('booking_house_p')),
  ]));

  const thread = el('section', { class: 'card' }, [el('h2', {}, ctx.t('booking_thread'))]);
  if (!messages.length) thread.append(el('p', { class: 'note' }, ctx.t('booking_empty')));
  messages.forEach((message) => {
    const mine = message.from === 'guest';
    thread.append(el('article', { class: mine ? 'bubble is-guest' : 'bubble is-property' }, [
      el('p', { class: 'status-line' }, [
        el('span', { class: mine ? 'mark mark-ask' : 'mark mark-open', 'aria-hidden': 'true' }),
        el('span', {}, mine ? ctx.t('booking_from_you') : ctx.t('booking_from_us')),
      ]),
      el('p', {}, message.body),
    ]));
  });
  const actions = el('div', { class: 'quick-actions' }, [
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => quick('early-checkin', 'booking_early_body') }, ctx.t('booking_early')),
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => quick('late-checkout', 'booking_late_body') }, ctx.t('booking_late')),
    el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => quick('change', 'booking_change_body') }, ctx.t('booking_change')),
  ]);
  thread.append(actions, paintForm());
  page.append(thread);
  page.append(el('button', {
    type: 'button',
    class: 'text-btn',
    onclick: () => {
      const reference = booking && booking.reference;
      clearBookingSession(reference);
      session = null;
      booking = null;
      messages = [];
      draft = '';
      kind = 'message';
      notice = '';
      error = '';
      renderBooking(ctx);
    },
  }, ctx.t('booking_logout')));
  ensureCaptcha();
  return mount(page);
}
