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
let error = '';
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
    return;
  }
  booking = await ctx.source.lookupBooking({ reference: session.reference, who: session.who });
  if (!booking) {
    clearBookingSession();
    session = null;
    error = ctx.t('booking_missing');
    return;
  }
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
    el('button', {
      type: 'button',
      class: 'btn btn-ink',
      onclick: () => ctx.openMessages(booking.reference),
    }, ctx.t('messages_open')),
  ]));
  page.append(el('button', {
    type: 'button',
    class: 'text-btn',
    onclick: () => {
      const reference = booking && booking.reference;
      clearBookingSession();
      session = null;
      booking = null;
      error = '';
      renderBooking(ctx);
    },
  }, ctx.t('booking_logout')));
  return mount(page);
}
