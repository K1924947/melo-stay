import { el } from './dom.js';
import { ASK_THREAD, readBookingSession } from './bookings-source.js';
import { formatDisplayDate } from './format.js';

const CHIPS = [
  ['early-checkin', 'chip_early', 'booking_early_body'],
  ['late-checkout', 'chip_late', 'booking_late_body'],
  ['directions', 'chip_directions', 'messages_directions_body'],
  ['luggage', 'chip_luggage', 'messages_luggage_body'],
  ['change', 'chip_change', 'booking_change_body'],
];

let ctx = null;
let ticket = 0;
let draft = '';
let notice = '';

export function messagesIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v11H5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 7.5 12 13l7-5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
}

function dayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function clock(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const locale = ctx.lang === 'zh' ? 'zh-CN' : ctx.lang === 'ko' ? 'ko-KR' : ctx.lang === 'ja' ? 'ja-JP' : 'en-GB';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function ticks(message) {
  if (message.from !== 'guest') return null;
  const read = message.status === 'read';
  return el('span', { class: 'tick' }, [
    el('span', { 'aria-hidden': 'true' }, read ? '✓✓' : '✓'),
    el('span', {}, read ? ctx.t('messages_read') : ctx.t('messages_sent')),
  ]);
}

function mount(node) {
  if (document.body.dataset.tab !== 'messages') return;
  const main = document.getElementById('main');
  if (!main) return;
  const offline = main.querySelector('.banner.offline');
  main.replaceChildren();
  if (offline) main.append(offline);
  main.append(node);
  const log = node.querySelector('.chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

async function send(threadId, body, kind) {
  const text = String(body || '').trim();
  if (!text) return;
  notice = '';
  const result = await ctx.source.sendMessage({
    threadId,
    body: text,
    kind: kind || 'message',
    lang: ctx.lang,
  });
  draft = '';
  notice = result.emailed ? ctx.t('booking_sent') : ctx.t('messages_saved');
  await renderMessages(ctx);
}

export async function renderMessages(next) {
  ctx = next;
  const mine = ++ticket;
  document.body.dataset.chat = ctx.threadId ? 'open' : '';
  const session = readBookingSession();
  const demo = await ctx.source.describeBookings();
  if (mine !== ticket) return;
  if (ctx.threadId) {
    await ctx.source.markRead(ctx.threadId, 'guest');
    const thread = await ctx.source.getThread(ctx.threadId, ctx.lang);
    if (mine !== ticket || document.body.dataset.tab !== 'messages') return;
    mount(chatScreen(thread, demo.demo));
    ctx.onUnread && ctx.onUnread();
    return;
  }
  const threads = await ctx.source.listThreads({
    role: 'guest',
    reference: session && session.reference,
    lang: ctx.lang,
  });
  if (mine !== ticket || document.body.dataset.tab !== 'messages') return;
  mount(listScreen(threads, demo.demo, !!session));
  ctx.onUnread && ctx.onUnread();
}

function listScreen(threads, demo, loggedIn) {
  const page = el('div', { class: 'page' });
  page.append(el('h1', {}, ctx.t('messages_h')));
  if (demo) page.append(el('p', { class: 'banner' }, ctx.t('booking_demo')));
  if (!loggedIn) page.append(el('p', { class: 'note' }, ctx.t('messages_login_hint')));
  threads.forEach((thread) => {
    const title = thread.kind === 'general' ? ctx.t('messages_ask') : (thread.reference + (thread.surname ? ' · ' + thread.surname : ''));
    page.append(el('button', {
      type: 'button',
      class: 'thread-row',
      onclick: () => ctx.openThread(thread.id),
    }, [
      el('span', { class: 'thread-title' }, [
        title,
        thread.unread ? el('span', { class: 'badge' }, String(thread.unread)) : null,
      ]),
      el('span', { class: 'thread-preview' }, thread.preview || ctx.t('messages_empty')),
    ]));
  });
  if (!loggedIn) {
    page.append(el('button', { type: 'button', class: 'btn btn-accent', onclick: () => ctx.openBooking() }, ctx.t('booking_enter')));
  }
  return page;
}

function chatScreen(thread, demo) {
  const title = thread.kind === 'general'
    ? ctx.t('messages_ask')
    : (thread.booking ? thread.booking.reference + ' · ' + thread.booking.surname : thread.id);
  const log = el('div', { class: 'chat-log' });
  let lastDay = '';
  thread.messages.forEach((message) => {
    const day = dayKey(message.at);
    if (day && day !== lastDay) {
      lastDay = day;
      log.append(el('p', { class: 'day-sep' }, formatDisplayDate(day, ctx.lang)));
    }
    const mine = message.from === 'guest';
    log.append(el('article', { class: mine ? 'bubble is-guest' : 'bubble is-property' }, [
      el('p', { class: 'bubble-meta' }, [
        el('span', { class: mine ? 'mark mark-ask' : 'mark mark-open', 'aria-hidden': 'true' }),
        el('span', {}, mine ? ctx.t('messages_you') : ctx.t('messages_property')),
        el('span', { class: 'bubble-time' }, clock(message.at)),
      ]),
      el('p', { class: 'bubble-body' }, message.body),
      ticks(message),
    ]));
  });
  if (!thread.messages.length) log.append(el('p', { class: 'note' }, ctx.t('messages_empty')));
  const area = el('textarea', { rows: '2' });
  area.value = draft;
  area.placeholder = ctx.t('chat_placeholder');
  area.addEventListener('input', () => { draft = area.value; });
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(thread.id, draft, 'message');
    }
  });
  const chips = el('div', { class: 'chips' });
  CHIPS.forEach(([kind, label, body]) => {
    chips.append(el('button', {
      type: 'button',
      class: 'chip',
      onclick: () => send(thread.id, ctx.t(body), kind),
    }, ctx.t(label)));
  });
  const screen = el('section', { class: 'chat-screen' }, [
    el('header', { class: 'chat-bar' }, [
      el('button', { type: 'button', class: 'text-btn', onclick: () => ctx.openThread(null) }, ctx.t('back')),
      el('strong', {}, title),
    ]),
    demo ? el('p', { class: 'banner chat-banner' }, ctx.t('booking_demo')) : null,
    log,
    notice ? el('p', { class: 'note chat-note' }, notice) : null,
    chips,
    el('form', {
      class: 'composer',
      onsubmit: (event) => {
        event.preventDefault();
        send(thread.id, draft, 'message');
      },
    }, [
      area,
      el('button', { type: 'submit', class: 'btn btn-ink' }, ctx.t('chat_send')),
    ]),
  ]);
  return screen;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'melo_demo_mail_v1' && ctx && document.body.dataset.tab === 'messages') renderMessages(ctx);
  });
}

export async function guestUnread(source, lang) {
  const session = readBookingSession();
  const threads = await source.listThreads({
    role: 'guest',
    reference: session && session.reference,
    lang: lang || 'en',
  });
  return threads.reduce((sum, thread) => sum + (thread.unread || 0), 0);
}
