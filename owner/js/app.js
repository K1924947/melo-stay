import { el } from '/app/js/dom.js';
import { StaticDataSource } from '/app/js/static-source.js';
import { createGuestSource } from '/app/js/channel-manager.js';
import { summarise } from '/app/js/stats.js';
import { formatKrw } from '/app/js/format.js';
import { OWNER_GATE, t } from './i18n.js';

const store = new StaticDataSource();
const source = createGuestSource(store);

const state = {
  lang: 'ko',
  authed: false,
  view: 'calendar',
  month: '',
  date: '',
  ready: false,
  error: false,
  report: null,
  rooms: [],
  connection: null,
  inbox: [],
};

function text(key, vars) {
  return t(state.lang, key, vars);
}

function roomName(code) {
  const room = state.rooms.find((item) => item.code === code);
  if (!room) return code;
  const copy = room.copy[state.lang] || room.copy.ko || room.copy.en;
  return copy.name;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const names = text('months');
  if (state.lang === 'ko') return year + '년 ' + names[month - 1];
  return names[month - 1] + ' ' + year;
}

function monthsIn(days) {
  const keys = [];
  days.forEach((day) => {
    const key = day.date.slice(0, 7);
    if (keys.indexOf(key) === -1) keys.push(key);
  });
  return keys;
}

function gridFor(month, days) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, monthNumber, 0).getDate();
  const byDate = {};
  days.forEach((day) => { byDate[day.date] = day; });
  const cells = [];
  for (let index = 0; index < pad; index += 1) cells.push({ pad: true });
  for (let day = 1; day <= count; day += 1) {
    const iso = year + '-' + String(monthNumber).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    cells.push({ iso, day, data: byDate[iso] || null });
  }
  return cells;
}

function mark(kind) {
  return el('i', { class: 'mark mark-' + kind, 'aria-hidden': 'true' });
}

function statusWord(kind) {
  if (kind === 'closed') return text('sold');
  if (kind === 'enquire') return text('enquire');
  if (kind === 'few') return text('few');
  return text('open');
}

function dayClass(cell) {
  if (!cell.data) return 'day is-empty';
  const data = cell.data;
  if (data.soldOut) return 'day is-sold';
  if (data.openCount === 0 && data.enquireCount) return 'day is-ask';
  if (data.closedCount && data.openCount) return 'day is-mixed';
  return 'day is-open';
}

function shortPrice(amount) {
  if (amount == null) return '';
  if (state.lang === 'ko') return Math.round(amount / 10000) + '만';
  return Math.round(amount / 1000) + 'k';
}

function dayFace(data) {
  if (!data) return { kind: 'empty', label: text('noData'), price: '' };
  if (data.soldOut) return { kind: 'closed', label: text('sold'), price: '' };
  if (data.openCount === 0) return { kind: 'ask', label: text('enquire'), price: '' };
  const label = data.unitsComplete ? text('left', { n: data.unitsLeft }) : text('types', { n: data.openCount });
  const kind = data.rooms.some((room) => room.status === 'few') && data.openCount <= 2 ? 'few' : 'open';
  return { kind, label, price: shortPrice(data.minPrice) };
}

function renderGate() {
  const error = el('p', { class: 'gate-error', hidden: true, role: 'alert' }, text('gateWrong'));
  const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': text('gatePass') });
  return el('form', {
    class: 'gate',
    onsubmit: (event) => {
      event.preventDefault();
      if (input.value.trim() === OWNER_GATE) {
        state.authed = true;
        try { sessionStorage.setItem('melo_owner_ok', '1'); } catch (err) { /* ignore */ }
        render();
      } else error.hidden = false;
    },
  }, [
    el('h1', {}, text('gateTitle')),
    el('p', { class: 'lede' }, text('gateBody')),
    el('label', { class: 'field' }, [text('gatePass'), input]),
    el('p', { class: 'gate-pass' }, text('gatePassValue')),
    el('button', { type: 'submit', class: 'btn' }, text('gateEnter')),
    error,
  ]);
}

function renderCalendar() {
  const report = state.report;
  const months = monthsIn(report.days);
  if (!state.month || months.indexOf(state.month) === -1) state.month = months[0] || '';
  if (!state.date) state.date = (report.days[0] && report.days[0].date) || '';
  const index = months.indexOf(state.month);
  const selected = report.days.find((day) => day.date === state.date) || null;
  const cells = state.month ? gridFor(state.month, report.days) : [];
  const dow = el('div', { class: 'dow' });
  text('dow').forEach((name) => dow.append(el('span', {}, name)));
  const grid = el('div', { class: 'grid' });
  cells.forEach((cell) => {
    if (cell.pad) {
      grid.append(el('span', { class: 'day is-pad' }));
      return;
    }
    const face = dayFace(cell.data);
    const button = el('button', {
      type: 'button',
      class: dayClass(cell) + (cell.iso === state.date ? '' : ''),
      'aria-current': cell.iso === state.date ? 'date' : null,
      onclick: () => {
        state.date = cell.iso;
        render();
      },
    }, [
      el('span', { class: 'num' }, String(cell.day)),
      cell.data ? mark(face.kind === 'empty' ? 'ask' : face.kind) : null,
      el('span', { class: 'lab' }, face.label),
      face.price ? el('span', { class: 'price' }, face.price) : null,
    ]);
    grid.append(button);
  });
  const detailRooms = selected ? selected.rooms.map((room) => el('div', { class: 'room-line' }, [
    mark(room.status === 'closed' ? 'closed' : room.status),
    el('span', {}, [el('strong', {}, roomName(room.code)), ' ', statusWord(room.status)]),
    el('em', {}, room.amount == null ? text('none') : formatKrw(room.amount) + (room.left == null ? '' : ' · ' + room.left)),
  ])) : [el('p', { class: 'note' }, text('pickDay'))];

  return el('div', {}, [
    el('div', { class: 'month-bar' }, [
      el('button', {
        type: 'button',
        'aria-label': text('prevMonth'),
        disabled: index <= 0,
        onclick: () => { state.month = months[index - 1]; render(); },
      }, '‹'),
      el('h1', {}, state.month ? monthLabel(state.month) : ''),
      el('button', {
        type: 'button',
        'aria-label': text('nextMonth'),
        disabled: index < 0 || index >= months.length - 1,
        onclick: () => { state.month = months[index + 1]; render(); },
      }, '›'),
    ]),
    el('div', { class: 'legend' }, [
      el('span', {}, [mark('closed'), text('legendSold')]),
      el('span', {}, [mark('open'), text('legendOpen')]),
      el('span', {}, [mark('few'), text('legendFew')]),
      el('span', {}, [mark('ask'), text('legendAsk')]),
    ]),
    el('p', { class: 'note' }, text('legendEmpty')),
    el('div', { class: 'cal-layout' }, [
      el('div', {}, [dow, grid]),
      el('section', { class: 'card detail' }, [
        el('h2', {}, selected ? selected.date : text('detail')),
        el('p', { class: 'note' }, selected && !selected.soldOut && selected.minPrice != null ? formatKrw(selected.minPrice) + ' – ' + formatKrw(selected.maxPrice) : text('pickDay')),
        ...detailRooms,
      ]),
    ]),
  ]);
}

function hBars(rows) {
  const width = 640;
  const rowH = 48;
  const height = rows.length * rowH;
  const max = Math.max(...rows.map((row) => row.value || 0), 1);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  rows.forEach((row, index) => {
    const y = index * rowH;
    const barW = Math.max(4, Math.round(((row.value || 0) / max) * (width - 150)));
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '0');
    label.setAttribute('y', String(y + 14));
    label.setAttribute('font-size', '14');
    label.textContent = row.label;
    const value = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    value.setAttribute('x', String(width));
    value.setAttribute('y', String(y + 14));
    value.setAttribute('text-anchor', 'end');
    value.setAttribute('font-size', '14');
    value.textContent = row.text;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', String(y + 22));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', '14');
    rect.setAttribute('rx', '3');
    rect.setAttribute('fill', index % 2 ? '#C0846A' : '#2C2926');
    svg.append(label, value, rect);
  });
  return svg;
}

function columns(rows) {
  const width = 640;
  const height = 160;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const gap = 6;
  const barW = Math.max(8, Math.floor((width - 20) / rows.length) - gap);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  rows.forEach((row, index) => {
    const h = Math.round((row.value / max) * 100);
    const x = 8 + index * (barW + gap);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(120 - h));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(Math.max(h, row.value ? 4 : 2)));
    rect.setAttribute('fill', row.soldOut ? 'none' : '#2C2926');
    rect.setAttribute('stroke', '#2C2926');
    if (row.soldOut) rect.setAttribute('stroke-dasharray', '3 2');
    const num = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    num.setAttribute('x', String(x + barW / 2));
    num.setAttribute('y', String(114 - h));
    num.setAttribute('text-anchor', 'middle');
    num.setAttribute('font-size', '11');
    num.textContent = String(row.value);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(x + barW / 2));
    label.setAttribute('y', '142');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '10');
    label.textContent = row.date.slice(8);
    svg.append(rect, num, label);
  });
  return svg;
}

function kpi(label, value) {
  return el('div', { class: 'kpi' }, [el('span', {}, label), el('strong', {}, value)]);
}

function renderStats() {
  const report = state.report;
  const money = (value) => (value == null ? '—' : formatKrw(value));
  return el('div', {}, [
    el('h1', {}, text('statsTitle')),
    el('div', { class: 'kpis' }, [
      kpi(text('nights'), String(report.nights)),
      kpi(text('soldNights'), String(report.soldOutNights)),
      kpi(text('openNights'), String(report.openNights)),
      kpi(text('avg'), money(report.average)),
      kpi(text('min'), money(report.min)),
      kpi(text('max'), money(report.max)),
      kpi(text('weekday'), money(report.weekdayAverage)),
      kpi(text('weekend'), money(report.weekendAverage)),
    ]),
    el('section', { class: 'card' }, [
      el('h2', {}, text('cheapest')),
      el('p', {}, (report.cheapestDate || '—') + ' · ' + money(report.cheapestPrice)),
      el('h2', {}, text('dearest')),
      el('p', {}, (report.dearestDate || '—') + ' · ' + money(report.dearestPrice)),
    ]),
    el('div', { class: 'charts' }, [
      el('section', { class: 'card' }, [
        el('h2', {}, text('byType')),
        hBars(report.byType.map((row) => ({
          label: roomName(row.code),
          value: row.average || 0,
          text: row.average == null ? '—' : formatKrw(row.average),
        }))),
      ]),
      el('section', { class: 'card' }, [
        el('h2', {}, text('perNight')),
        columns(report.perNight.map((row) => ({
          date: row.date,
          value: row.openCount,
          soldOut: row.soldOut,
        }))),
      ]),
    ]),
  ]);
}

function renderLater() {
  const items = ['bookings', 'occupancy', 'revenue', 'enquiries'];
  const inbox = state.inbox || [];
  const messages = el('section', { class: 'placeholder' }, [
    el('h2', {}, text('guestMessages')),
    el('p', {}, text('guestMessagesNote')),
    el('span', { class: 'tag' }, text('coming')),
  ]);
  inbox.forEach((message) => {
    messages.append(el('p', { class: 'note' }, message.reference + ' · ' + message.body));
  });
  return el('div', {}, [
    el('h1', {}, text('laterTitle')),
    el('p', { class: 'lede' }, text('laterBody')),
    messages,
    ...items.map((key) => el('section', { class: 'placeholder' }, [
      el('h2', {}, text(key)),
      el('span', { class: 'tag' }, text('coming')),
    ])),
  ]);
}

function render() {
  const main = document.getElementById('main');
  const tabs = document.getElementById('tabs');
  document.documentElement.lang = state.lang;
  document.title = state.lang === 'ko' ? '운영 · melo stay' : 'Owner · melo stay';
  const bar = document.getElementById('topbar');
  bar.replaceChildren(
    el('div', { class: 'wordmark' }, ['melo stay', el('small', {}, 'SEOUL')]),
    el('div', { class: 'lang-switch' }, [
      el('button', {
        type: 'button',
        class: state.lang === 'ko' ? 'active' : '',
        'aria-pressed': state.lang === 'ko' ? 'true' : 'false',
        onclick: () => { state.lang = 'ko'; try { localStorage.setItem('melo_owner_lang', 'ko'); } catch (err) { /* ignore */ } render(); },
      }, '한국어'),
      el('span', { class: 'dot' }, '·'),
      el('button', {
        type: 'button',
        class: state.lang === 'en' ? 'active' : '',
        'aria-pressed': state.lang === 'en' ? 'true' : 'false',
        onclick: () => { state.lang = 'en'; try { localStorage.setItem('melo_owner_lang', 'en'); } catch (err) { /* ignore */ } render(); },
      }, 'EN'),
    ]),
  );
  if (!state.authed) {
    tabs.hidden = true;
    main.replaceChildren(renderGate());
    return;
  }
  tabs.hidden = false;
  tabs.replaceChildren();
  [['calendar', 'calendar'], ['stats', 'stats'], ['later', 'later']].forEach(([id, key]) => {
    tabs.append(el('button', {
      type: 'button',
      'aria-current': state.view === id ? 'page' : null,
      onclick: () => { state.view = id; render(); },
    }, text(key)));
  });
  const head = el('div', {}, [
    el('p', { class: 'banner' }, text('readOnly') + ' · ' + text('windowNote')),
    state.report ? el('p', { class: 'note' }, text('updated', { date: state.report.updated || '—' }) + ' · ' + text('noClock') + ' · ' + (state.report.source || '')) : null,
  ]);
  let body;
  if (state.error) body = el('p', {}, text('failed'));
  else if (!state.ready) body = el('p', { class: 'loading' }, text('loading'));
  else if (state.view === 'stats') body = renderStats();
  else if (state.view === 'later') body = renderLater();
  else body = renderCalendar();
  main.replaceChildren(head, body);
  if (state.authed) {
    main.append(el('button', {
      type: 'button',
      class: 'btn ghost',
      onclick: () => {
        state.authed = false;
        try { sessionStorage.removeItem('melo_owner_ok'); } catch (err) { /* ignore */ }
        render();
      },
    }, text('leave')));
  }
}

async function boot() {
  try {
    const saved = localStorage.getItem('melo_owner_lang');
    if (saved === 'en' || saved === 'ko') state.lang = saved;
    state.authed = sessionStorage.getItem('melo_owner_ok') === '1';
  } catch (err) { /* ignore */ }
  render();
  try {
    await store.load();
    state.rooms = await source.listRoomTypes();
    state.report = summarise(store.publishedPrices());
    state.connection = await source.describeConnection();
    try { state.inbox = await source.listInbox(); } catch (err) { state.inbox = []; }
    state.ready = true;
  } catch (err) {
    state.error = true;
    state.ready = true;
  }
  render();
  document.body.dataset.ready = '1';
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/owner/sw.js', { scope: '/owner/', updateViaCache: 'none' }).catch(() => {});
  }
}

boot();
