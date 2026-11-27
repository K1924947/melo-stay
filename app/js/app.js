import { el, svgIcon } from './dom.js';
import { LANGS, translate } from './i18n.js';
import { GROUPS, PROPERTY, ROOM_LIST, roomPhotos } from './catalog.js';
import { StaticDataSource } from './static-source.js';
import { createGuestSource } from './channel-manager.js';
import { bookingIcon, renderBooking, restoreBookingSession } from './booking-view.js';
import {
  defaultCheckinISO,
  quoteRoom,
  stayLeavesTheWindow,
} from './pricing.js';
import {
  addDaysISO,
  enumerateNights,
  formatDisplayDate,
  formatKrw,
  nightsLabel,
  todayISO,
} from './format.js';

const ICONS = {
  rooms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V11m16 7V11M3 18h18M6 11V8.5A1.5 1.5 0 0 1 7.5 7H11a1.5 1.5 0 0 1 1.5 1.5V11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prices: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5V7M16 3.5V7M4 10h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  enquire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v11H5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 7.5 12 13l7-5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  booking: bookingIcon(),
};

const ARIA_PHOTO = {
  en: { prev: 'Previous photo', next: 'Next photo' },
  zh: { prev: '上一张', next: '下一张' },
  ko: { prev: '이전 사진', next: '다음 사진' },
  ja: { prev: '前の写真', next: '次の写真' },
};

const store = new StaticDataSource();
const source = createGuestSource(store);

const state = {
  lang: 'en',
  checkin: '',
  checkout: '',
  guests: 2,
  enquireRoomId: '',
  message: '',
  messageAuto: true,
  name: '',
  email: '',
  loading: true,
  pricesError: false,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  enquiryStatus: null,
  datesReady: false,
  rooms: ROOM_LIST.map((room) => ({ ...room, enquireOnly: false })),
};

let captchaStarted = false;

function t(key, vars) {
  return translate(state.lang, key, vars);
}

function copyOf(room) {
  return room.copy[state.lang] || room.copy.en;
}

function restore() {
  try {
    const lang = localStorage.getItem('melo_lang');
    if (LANGS.some((item) => item.id === lang)) state.lang = lang;
    const stay = JSON.parse(sessionStorage.getItem('melo_stay') || 'null');
    if (stay && typeof stay === 'object') {
      state.checkin = stay.checkin || '';
      state.checkout = stay.checkout || '';
      const guests = Number(stay.guests);
      state.guests = guests >= 1 && guests <= 4 ? guests : 2;
      state.enquireRoomId = stay.enquireRoomId || '';
      state.datesReady = true;
    }
  } catch (err) {
    /* Storage can be blocked. The app still runs. */
  }
}

function persistStay() {
  try {
    sessionStorage.setItem('melo_stay', JSON.stringify({
      checkin: state.checkin,
      checkout: state.checkout,
      guests: state.guests,
      enquireRoomId: state.enquireRoomId,
    }));
  } catch (err) {
    /* ignore */
  }
}

function parseRoute() {
  let raw = (location.hash || '#rooms').replace(/^#/, '');
  if (raw === 'owner' || raw.startsWith('owner/')) {
    history.replaceState(null, '', '#rooms');
    raw = 'rooms';
  }
  if (raw.startsWith('room/')) {
    const roomId = decodeURIComponent(raw.slice(5));
    return { tab: 'rooms', roomId: state.rooms.some((room) => room.id === roomId) ? roomId : null };
  }
  const tabs = ['rooms', 'prices', 'enquire', 'booking', 'info'];
  return { tab: tabs.indexOf(raw) === -1 ? 'rooms' : raw, roomId: null };
}

function navigate(hash) {
  const next = '#' + hash;
  if (location.hash === next) render();
  else location.hash = hash;
}

function buildEnquiryMessage() {
  const nights = enumerateNights(state.checkin, state.checkout);
  const room = state.rooms.find((item) => item.id === state.enquireRoomId);
  const roomName = room ? copyOf(room).name : '';
  let base = '';
  if (nights.length && roomName) {
    base = t('enquiry_prefill', {
      room: roomName,
      checkin: formatDisplayDate(state.checkin, state.lang),
      checkout: formatDisplayDate(state.checkout, state.lang),
      nights: nightsLabel(nights.length, t),
    });
  } else if (nights.length) {
    base = t('enquiry_prefill_dates', {
      checkin: formatDisplayDate(state.checkin, state.lang),
      checkout: formatDisplayDate(state.checkout, state.lang),
      nights: nightsLabel(nights.length, t),
    });
  } else if (roomName) {
    base = t('enquiry_prefill_room', { room: roomName });
  }
  if (!base) return '';
  return base + t('guests_suffix', { n: String(state.guests) });
}

function fillPrice(node, key, vars, otaAmount) {
  const raw = t(key, { ...vars, ota: '\u0000' });
  const parts = raw.split('\u0000');
  node.append(document.createTextNode(parts[0] || ''));
  if (vars.pct && otaAmount != null) {
    const strike = document.createElement('s');
    strike.className = 'price-ota';
    strike.textContent = formatKrw(otaAmount);
    node.append(strike);
  }
  if (parts[1]) node.append(document.createTextNode(parts[1]));
}

function statusLine(kind, text) {
  return el('p', { class: 'status-line' }, [
    el('span', { class: 'mark mark-' + kind, 'aria-hidden': 'true' }),
    el('span', {}, text),
  ]);
}

function quoteFor(room) {
  return quoteRoom({
    prices: store.prices,
    roomCode: room.code,
    nights: enumerateNights(state.checkin, state.checkout),
    guests: state.guests,
    capacity: room.capacity,
  });
}

function priceBlock(room) {
  const wrap = el('div', { class: 'price-block' });
  if (state.loading) {
    wrap.append(el('p', { class: 'price-plain' }, t('loading')));
    return wrap;
  }
  if (state.pricesError && !store.prices) {
    wrap.append(statusLine('ask', t('prices_unavailable')));
    return wrap;
  }
  const quote = quoteFor(room);
  if (quote.status === 'soon') {
    wrap.append(el('p', { class: 'price-plain' }, t('price_soon')));
    return wrap;
  }
  if (quote.status === 'enquire') {
    wrap.append(statusLine('ask', t('price_enquire')));
    return wrap;
  }
  if (quote.status === 'capacity') {
    wrap.append(el('p', { class: 'price-plain' }, t('price_capacity', { n: String(quote.capacity) })));
    wrap.append(statusLine('ask', t('price_enquire')));
    return wrap;
  }
  if (quote.status === 'enquire-dates') {
    wrap.append(statusLine('ask', t('price_enquire_dates')));
    return wrap;
  }
  if (quote.status === 'sold') {
    wrap.append(statusLine('closed', t('price_sold')));
    return wrap;
  }
  if (quote.status === 'from') {
    const line = el('p', { class: 'price-line' });
    line.textContent = t('price_from', { price: formatKrw(quote.fromDirect), ota: '' });
    wrap.append(line);
    if (quote.pct) wrap.append(el('p', { class: 'price-note' }, t('price_note', { pct: String(quote.pct) })));
    return wrap;
  }
  const single = quote.nights.length === 1;
  const line = el('p', { class: 'price-line' });
  if (single) {
    fillPrice(line, 'price_night', { pct: quote.pct, price: formatKrw(quote.nights[0].direct) }, quote.nights[0].ota);
  } else {
    fillPrice(line, 'price_avg', { pct: quote.pct, avg: formatKrw(quote.avgDirect) }, quote.avgOta);
  }
  wrap.append(line);
  const total = el('p', { class: 'price-total' });
  fillPrice(total, 'price_total', { pct: quote.pct, total: formatKrw(quote.totalDirect), n: String(quote.nights.length) }, quote.totalOta);
  wrap.append(total);
  if (quote.pct) wrap.append(el('p', { class: 'price-note' }, t('price_note', { pct: String(quote.pct) })));
  if (quote.fewLeft) {
    const label = quote.minLeft != null ? t('few_left') + ' · ' + quote.minLeft : t('few_left');
    wrap.append(statusLine('few', label));
  }
  if (quote.nights.length > 1) {
    const details = el('details', { class: 'night-breakdown' });
    details.append(el('summary', {}, t('each_night')));
    quote.nights.forEach((night) => {
      details.append(el('div', { class: 'night-row' }, [
        el('span', {}, formatDisplayDate(night.date, state.lang)),
        el('span', {}, formatKrw(night.direct)),
      ]));
    });
    wrap.append(details);
  }
  return wrap;
}

function goEnquire(roomId) {
  state.enquireRoomId = roomId || '';
  state.messageAuto = true;
  state.enquiryStatus = null;
  persistStay();
  navigate('enquire');
}

function langSwitch(current, onPick, langs) {
  const wrap = el('div', { class: 'lang-switch', role: 'group', 'aria-label': 'Language' });
  langs.forEach((lang, index) => {
    if (index) wrap.append(el('span', { class: 'dot', 'aria-hidden': 'true' }, '·'));
    wrap.append(el('button', {
      type: 'button',
      class: lang.id === current ? 'active' : '',
      'aria-pressed': lang.id === current ? 'true' : 'false',
      onclick: () => onPick(lang.id),
    }, lang.label));
  });
  return wrap;
}

function renderTopbar() {
  const bar = document.getElementById('topbar');
  const mark = el('button', {
    type: 'button',
    class: 'wordmark',
    onclick: () => navigate('rooms'),
  }, ['melo stay', el('small', {}, 'SEOUL')]);
  const switcher = langSwitch(state.lang, (id) => {
    state.lang = id;
    try { localStorage.setItem('melo_lang', id); } catch (err) { /* ignore */ }
    if (state.messageAuto) state.message = buildEnquiryMessage();
    render();
  }, LANGS);
  bar.replaceChildren(mark, switcher);
}

function renderTabs(route) {
  const nav = document.getElementById('tabbar');
  const tabs = [
    ['rooms', 'nav_rooms', 'rooms'],
    ['prices', 'tab_prices', 'prices'],
    ['enquire', 'nav_enquire', 'enquire'],
    ['booking', 'tab_booking', 'booking'],
    ['info', 'tab_info', 'info'],
  ];
  nav.replaceChildren();
  tabs.forEach(([id, key, icon]) => {
    nav.append(el('button', {
      type: 'button',
      class: route.tab === id ? 'tab active' : 'tab',
      'aria-current': route.tab === id ? 'page' : null,
      onclick: () => navigate(id),
    }, [svgIcon(ICONS[icon]), el('span', {}, t(key))]));
  });
}

function roomButtonLabel(quote) {
  if (quote.status === 'sold') return '';
  if (quote.status === 'enquire' || quote.status === 'enquire-dates' || quote.status === 'capacity' || quote.status === 'soon') {
    return t('price_enquire');
  }
  return t('nav_book');
}

function renderRoomCard(room, eager) {
  const copy = copyOf(room);
  const quote = state.loading || !store.prices ? null : quoteFor(room);
  const card = el('article', {
    class: quote && quote.status === 'sold' ? 'room-card is-sold' : 'room-card',
    'data-room': room.id,
  });
  const photo = el('button', {
    type: 'button',
    class: 'room-photo',
    onclick: () => navigate('room/' + room.id),
  }, [el('img', {
    src: '/images/rooms/' + room.folder + '/1.jpg',
    alt: copy.name,
    width: '600',
    height: '400',
    decoding: 'async',
    loading: eager ? 'eager' : 'lazy',
  })]);
  const body = el('div', { class: 'room-body' }, [
    el('span', { class: 'tier' }, copy.tier),
    el('h2', {}, copy.name),
    el('p', { class: 'room-desc' }, copy.card),
    el('div', { class: 'facts' }, room.amenities.map((key) => el('span', {}, t(key)))),
    priceBlock(room),
  ]);
  const actions = el('div', { class: 'room-actions' });
  actions.append(el('button', {
    type: 'button',
    class: 'text-btn',
    onclick: () => navigate('room/' + room.id),
  }, t('view_more')));
  if (!quote || quote.status !== 'sold') {
    actions.append(el('button', {
      type: 'button',
      class: 'btn btn-ink btn-small',
      onclick: () => goEnquire(room.id),
    }, roomButtonLabel(quote || { status: 'soon' })));
  }
  body.append(actions);
  card.append(photo, body);
  return card;
}

function renderRooms() {
  const page = el('div', { class: 'page' });
  page.append(el('div', { class: 'hero-mini' }, [
    el('img', {
      src: '/images/hero-mobile.jpg',
      alt: 'melo stay',
      width: '800',
      height: '360',
      decoding: 'async',
      fetchpriority: 'high',
    }),
    el('div', { class: 'hero-mini-copy' }, [
      el('p', { class: 'hero-kicker' }, t('hero_tagline')),
      el('p', {}, t('hero_sub')),
    ]),
  ]));
  page.append(el('div', { class: 'page-intro' }, [
    el('h1', {}, t('rooms_h2')),
    el('p', {}, t('rooms_p')),
  ]));
  GROUPS.forEach((group) => {
    page.append(el('div', { class: 'group-head' }, [
      el('h2', {}, t(group.titleKey)),
      el('span', {}, t(group.subKey)),
    ]));
    group.ids.forEach((id) => {
      const room = state.rooms.find((item) => item.id === id);
      if (room) page.append(renderRoomCard(room, id === 'str'));
    });
  });
  return page;
}

function renderRoomDetail(room) {
  const copy = copyOf(room);
  const photos = roomPhotos(room);
  const aria = ARIA_PHOTO[state.lang] || ARIA_PHOTO.en;
  let index = 0;
  const image = el('img', { src: photos[0], alt: copy.name });
  const counter = el('div', { class: 'gallery-counter' }, '1 / ' + photos.length);
  const thumbs = photos.map((url, photoIndex) => {
    const button = el('button', {
      type: 'button',
      class: photoIndex === 0 ? 'thumb active' : 'thumb',
      onclick: () => show(photoIndex),
    }, [el('img', { src: url, alt: '' })]);
    return button;
  });
  function show(next) {
    index = (next + photos.length) % photos.length;
    image.src = photos[index];
    image.alt = copy.name;
    counter.textContent = (index + 1) + ' / ' + photos.length;
    thumbs.forEach((thumb, thumbIndex) => thumb.classList.toggle('active', thumbIndex === index));
  }
  let startX = 0;
  image.addEventListener('touchstart', (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });
  image.addEventListener('touchend', (event) => {
    const delta = event.changedTouches[0].clientX - startX;
    if (delta > 40) show(index - 1);
    if (delta < -40) show(index + 1);
  }, { passive: true });
  const quote = state.loading ? null : quoteFor(room);
  const page = el('div', { class: 'page' }, [
    el('button', { type: 'button', class: 'text-btn back', onclick: () => navigate('rooms') }, t('back')),
    el('span', { class: 'tier' }, copy.tier),
    el('h1', {}, copy.name),
    el('p', { class: 'room-desc' }, copy.sub),
    el('div', { class: 'gallery' }, [
      el('div', { class: 'gallery-main' }, [
        image,
        el('button', { type: 'button', class: 'gallery-nav prev', 'aria-label': aria.prev, onclick: () => show(index - 1) }, '‹'),
        el('button', { type: 'button', class: 'gallery-nav next', 'aria-label': aria.next, onclick: () => show(index + 1) }, '›'),
        counter,
      ]),
      el('div', { class: 'thumbs' }, thumbs),
    ]),
    el('p', {}, copy.description),
    el('p', { class: 'room-desc' }, copy.description2),
    el('ul', { class: 'fact-list' }, [
      el('li', {}, [el('span', {}, t('modal_fact_size')), el('span', {}, copy.size)]),
      el('li', {}, [el('span', {}, t('modal_fact_beds')), el('span', {}, copy.beds)]),
      el('li', {}, [el('span', {}, t('modal_fact_bath')), el('span', {}, t('modal_fact_bath_v'))]),
    ]),
    priceBlock(room),
  ]);
  if (!quote || quote.status !== 'sold') {
    page.append(el('button', {
      type: 'button',
      class: 'btn btn-accent',
      onclick: () => goEnquire(room.id),
    }, t('modal_enquire')));
  }
  return page;
}

function renderPrices() {
  const nights = enumerateNights(state.checkin, state.checkout);
  const today = todayISO();
  const checkin = el('input', { type: 'date', name: 'checkin' });
  checkin.value = state.checkin;
  checkin.min = today;
  const checkout = el('input', { type: 'date', name: 'checkout' });
  checkout.value = state.checkout;
  checkout.min = state.checkin ? addDaysISO(state.checkin, 1) : addDaysISO(today, 1);
  function commitDates() {
    state.datesReady = true;
    state.checkin = checkin.value;
    state.checkout = checkout.value;
    if (state.checkin && (!state.checkout || state.checkout <= state.checkin)) {
      state.checkout = addDaysISO(state.checkin, 1);
    }
    persistStay();
    if (state.messageAuto) state.message = buildEnquiryMessage();
    render();
  }
  checkin.addEventListener('change', commitDates);
  checkout.addEventListener('change', commitDates);
  const guests = el('select', { name: 'guests', 'aria-label': t('dates_guests') });
  for (let count = 1; count <= 4; count += 1) {
    const option = el('option', { value: String(count) }, String(count));
    if (count === state.guests) option.selected = true;
    guests.append(option);
  }
  guests.addEventListener('change', () => {
    state.guests = Number(guests.value);
    persistStay();
    if (state.messageAuto) state.message = buildEnquiryMessage();
    render();
  });
  const page = el('div', { class: 'page' }, [
    el('h1', {}, t('see_prices')),
    el('form', {
      class: 'card date-card',
      onsubmit: (event) => {
        event.preventDefault();
        const list = document.getElementById('price-list');
        if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }, [
      el('div', { class: 'date-grid' }, [
        el('label', { class: 'field' }, [el('span', {}, t('dates_checkin')), checkin]),
        el('label', { class: 'field' }, [el('span', {}, t('dates_checkout')), checkout]),
      ]),
      el('label', { class: 'field' }, [el('span', {}, t('dates_guests')), guests]),
      el('p', { class: 'nights-label' }, nightsLabel(nights.length, t)),
      el('div', { class: 'row-actions' }, [
        el('button', { type: 'submit', class: 'btn btn-accent' }, t('see_prices')),
        (state.checkin || state.checkout) ? el('button', {
          type: 'button',
          class: 'text-btn',
          onclick: () => {
            state.checkin = '';
            state.checkout = '';
            state.datesReady = true;
            persistStay();
            if (state.messageAuto) state.message = buildEnquiryMessage();
            render();
          },
        }, t('dates_clear')) : null,
      ]),
    ]),
    el('p', { class: 'note' }, t('date_note')),
  ]);
  if (store.prices && store.prices.updated) {
    page.append(el('p', { class: 'updated' }, t('updated_on', { date: formatDisplayDate(store.prices.updated, state.lang) })));
  }
  if (stayLeavesTheWindow(store.prices, nights)) {
    page.append(el('p', { class: 'banner' }, t('horizon_beyond')));
  }
  const list = el('div', { id: 'price-list' });
  GROUPS.forEach((group) => {
    list.append(el('h2', { class: 'group-label' }, t(group.titleKey)));
    group.ids.forEach((id) => {
      const room = state.rooms.find((item) => item.id === id);
      if (!room) return;
      const quote = state.loading ? null : quoteFor(room);
      const row = el('article', {
        class: quote && quote.status === 'sold' ? 'price-row is-sold' : 'price-row',
        'data-room': room.id,
      }, [
        el('button', {
          type: 'button',
          class: 'price-photo',
          onclick: () => navigate('room/' + room.id),
        }, [el('img', { src: '/images/rooms/' + room.folder + '/1.jpg', alt: '' })]),
        el('div', {}, [
          el('h3', {}, copyOf(room).name),
          priceBlock(room),
          quote && quote.status === 'sold' ? null : el('button', {
            type: 'button',
            class: 'text-btn',
            onclick: () => goEnquire(room.id),
          }, roomButtonLabel(quote || { status: 'soon' })),
        ]),
      ]);
      list.append(row);
    });
  });
  page.append(list);
  return page;
}

function renderInfo() {
  const page = el('div', { class: 'page' }, [
    el('h1', {}, t('good_h2')),
    el('div', { class: 'time-grid' }, [
      el('article', { class: 'time-card' }, [
        el('span', {}, t('loc_checkin_l')),
        el('strong', {}, PROPERTY.checkIn),
        el('p', {}, t('footer_checkin')),
      ]),
      el('article', { class: 'time-card' }, [
        el('span', {}, t('loc_checkout_l')),
        el('strong', {}, PROPERTY.checkOut),
        el('p', {}, t('footer_checkout')),
      ]),
    ]),
    el('h2', {}, t('find_h2')),
    el('p', {}, t('find_p')),
    el('p', { class: 'address' }, t('footer_address')),
    el('a', { class: 'btn btn-accent', href: PROPERTY.mapUrl, target: '_blank', rel: 'noopener' }, t('map_open')),
    el('img', { class: 'info-photo', src: '/images/general/exterior.jpg', alt: t('footer_address') }),
    el('ul', { class: 'fact-list' }, [
      el('li', {}, [el('span', {}, t('loc_ddm_l')), el('span', {}, t('loc_ddm_v'))]),
      el('li', {}, [el('span', {}, t('loc_dm_l')), el('span', {}, t('loc_dm_v'))]),
    ]),
    el('h2', {}, t('book_h2')),
    el('p', {}, t('book_p')),
    el('div', { class: 'contact-list' }, [
      el('a', { href: PROPERTY.contact.phoneHref }, [el('span', {}, t('call')), el('span', {}, PROPERTY.contact.phone)]),
      el('a', { href: 'mailto:' + PROPERTY.contact.email }, [el('span', {}, t('email')), el('span', {}, PROPERTY.contact.email)]),
    ]),
    el('h2', {}, t('included_h2')),
    el('p', {}, t('amenities_p')),
    el('div', { class: 'included-row' }, [
      ['/images/general/coffee-corner.jpg', 'included_coffee'],
      ['/images/general/kitchen-appliances.jpg', 'included_kitchen'],
      ['/images/general/ramen-machines.jpg', 'included_laundry'],
      ['/images/general/amenity-kit.jpg', 'included_kit'],
    ].map(([src, key]) => el('figure', {}, [
      el('img', { src, alt: t(key) }),
      el('figcaption', {}, t(key)),
    ]))),
    el('p', {}, t('perk_kitchen_p')),
    el('p', {}, t('amenity_5_p')),
    el('p', {}, t('amenity_4_p')),
    el('h2', {}, t('travel_h2')),
    el('p', {}, t('travel_p')),
    el('h2', {}, t('rules_h')),
    el('p', {}, t('rules_p')),
  ]);
  return page;
}

function createForm() {
  if (document.getElementById('enquiryForm')) return;
  const form = el('form', {
    id: 'enquiryForm',
    class: 'enquiry-form',
    action: PROPERTY.enquiry.action,
    method: 'POST',
  });
  form.append(
    el('div', { class: 'form-row' }, [
      el('label', { class: 'field' }, [
        el('span', { 'data-i18n': 'enquiry_name' }, t('enquiry_name')),
        el('input', { type: 'text', name: 'name', autocomplete: 'name', required: true }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { 'data-i18n': 'enquiry_email' }, t('enquiry_email')),
        el('input', { type: 'email', name: 'email', autocomplete: 'email', required: true }),
      ]),
    ]),
    el('label', { class: 'field' }, [
      el('span', { 'data-i18n': 'enquiry_message' }, t('enquiry_message')),
      el('textarea', { name: 'message', rows: '6', required: true }),
    ]),
    el('input', { type: 'hidden', name: 'access_key', value: PROPERTY.enquiry.accessKey }),
    el('input', { type: 'hidden', name: 'subject', value: PROPERTY.enquiry.subject }),
    el('input', { type: 'checkbox', name: 'botcheck', tabindex: '-1', autocomplete: 'off', class: 'botcheck', 'aria-hidden': 'true' }),
    el('div', { class: 'h-captcha', 'data-captcha': 'true' }),
    el('button', { type: 'submit', id: 'enquirySubmit' }, [el('span', { 'data-i18n': 'enquiry_send' }, t('enquiry_send'))]),
    el('p', { class: 'enquiry-status', role: 'status' }),
  );
  form.querySelector('[name="name"]').addEventListener('input', (event) => {
    state.name = event.target.value;
  });
  form.querySelector('[name="email"]').addEventListener('input', (event) => {
    state.email = event.target.value;
  });
  form.querySelector('[name="message"]').addEventListener('input', (event) => {
    state.message = event.target.value;
    state.messageAuto = false;
  });
  form.addEventListener('submit', onEnquireSubmit);
  document.getElementById('formPark').append(form);
}

async function onEnquireSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('#enquirySubmit');
  button.disabled = true;
  state.enquiryStatus = null;
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error('submit failed');
    await source.recordEnquiry({
      id: 'local-' + Date.now(),
      createdAt: new Date().toISOString(),
      name: state.name,
      email: state.email,
      message: state.message,
      roomTypeId: state.enquireRoomId || null,
      checkIn: state.checkin || null,
      checkOut: state.checkout || null,
      guests: state.guests,
      status: 'sent',
      channel: 'direct',
    });
    state.enquiryStatus = { ok: true };
    state.name = '';
    state.email = '';
    state.message = '';
    state.messageAuto = false;
    form.reset();
  } catch (err) {
    state.enquiryStatus = { ok: false };
  } finally {
    button.disabled = false;
    render();
  }
}

function updateFormChrome() {
  const form = document.getElementById('enquiryForm');
  if (!form) return;
  form.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  const name = form.querySelector('[name="name"]');
  const email = form.querySelector('[name="email"]');
  const message = form.querySelector('[name="message"]');
  if (document.activeElement !== name && name.value !== state.name) name.value = state.name;
  if (document.activeElement !== email && email.value !== state.email) email.value = state.email;
  if (state.messageAuto) state.message = buildEnquiryMessage();
  if (document.activeElement !== message && message.value !== state.message) message.value = state.message;
  const status = form.querySelector('.enquiry-status');
  status.replaceChildren();
  status.className = 'enquiry-status';
  if (!state.enquiryStatus) return;
  status.classList.add(state.enquiryStatus.ok ? 'is-ok' : 'is-bad');
  status.append(
    el('span', { class: 'glyph', 'aria-hidden': 'true' }, state.enquiryStatus.ok ? '✓' : '!'),
    document.createTextNode(state.enquiryStatus.ok ? t('enquiry_success') : t('enquiry_error')),
  );
}

function ensureCaptcha() {
  if (captchaStarted) return;
  captchaStarted = true;
  const script = document.createElement('script');
  script.src = 'https://web3forms.com/client/script.js';
  script.async = true;
  document.body.appendChild(script);
}

function renderEnquire() {
  const room = state.rooms.find((item) => item.id === state.enquireRoomId);
  const nights = enumerateNights(state.checkin, state.checkout);
  const summary = el('div', { class: 'summary' });
  if (room) summary.append(el('strong', {}, copyOf(room).name));
  if (nights.length) {
    summary.append(el('span', {}, formatDisplayDate(state.checkin, state.lang) + ' – ' + formatDisplayDate(state.checkout, state.lang) + ' · ' + nightsLabel(nights.length, t)));
  }
  summary.append(el('span', {}, t('dates_guests') + ' ' + state.guests));
  const select = el('select', { 'aria-label': t('choose_room') });
  select.append(el('option', { value: '' }, t('any_room')));
  state.rooms.forEach((item) => {
    const option = el('option', { value: item.id }, copyOf(item).name);
    if (item.id === state.enquireRoomId) option.selected = true;
    select.append(option);
  });
  select.addEventListener('change', () => {
    state.enquireRoomId = select.value;
    state.messageAuto = true;
    persistStay();
    render();
  });
  const page = el('div', { class: 'page' }, [
    el('h1', {}, t('enquiry_h2')),
    el('p', { class: 'lede' }, t('enquiry_p')),
    el('p', {}, t('book_p')),
    summary,
    el('label', { class: 'field' }, [el('span', {}, t('choose_room')), select]),
    el('button', { type: 'button', class: 'text-btn', onclick: () => navigate('prices') }, t('change_dates')),
  ]);
  const form = document.getElementById('enquiryForm');
  page.append(form);
  page.append(el('h2', {}, t('ota_label')));
  page.append(el('div', { class: 'ota-links' }, PROPERTY.channels.map((channel) => (
    el('a', { class: 'ota-link', href: channel.url, target: '_blank', rel: 'noopener' }, channel.name)
  ))));
  page.append(el('div', { class: 'contact-list' }, [
    el('a', { href: 'mailto:' + PROPERTY.contact.email }, PROPERTY.contact.email),
    el('a', { href: PROPERTY.contact.phoneHref }, PROPERTY.contact.phone),
  ]));
  return page;
}

function render() {
  const route = parseRoute();
  const main = document.getElementById('main');
  const form = document.getElementById('enquiryForm');
  if (form) document.getElementById('formPark').append(form);
  const scroll = main.scrollTop;
  const viewKey = route.roomId ? 'room/' + route.roomId : route.tab;
  document.documentElement.lang = state.lang;
  document.title = 'melo stay';
  document.body.dataset.area = 'guest';
  document.body.dataset.tab = route.roomId ? 'room' : route.tab;
  renderTopbar();
  renderTabs(route);
  updateFormChrome();
  main.replaceChildren();
  if (state.offline) main.append(el('p', { class: 'banner offline' }, t('offline')));
  if (route.roomId) {
    const room = state.rooms.find((item) => item.id === route.roomId);
    main.append(room ? renderRoomDetail(room) : renderRooms());
  } else if (route.tab === 'prices') {
    main.append(renderPrices());
  } else if (route.tab === 'enquire') {
    main.append(renderEnquire());
    ensureCaptcha();
  } else if (route.tab === 'booking') {
    main.append(el('p', { class: 'loading' }, t('loading')));
    renderBooking({ lang: state.lang, t, source });
  } else if (route.tab === 'info') {
    main.append(renderInfo());
  } else {
    main.append(renderRooms());
  }
  if (main.dataset.view === viewKey) main.scrollTop = scroll;
  else main.scrollTop = 0;
  main.dataset.view = viewKey;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      const script = reg.active && reg.active.scriptURL;
      if (reg.scope === location.origin + '/' || (script && /\/sw\.js$/.test(script))) reg.unregister();
    });
  }).catch(() => {});
  navigator.serviceWorker.register('/app/sw.js', { scope: '/app/', updateViaCache: 'none' }).catch(() => {});
}

async function boot() {
  restore();
  restoreBookingSession();
  createForm();
  window.addEventListener('hashchange', () => render());
  window.addEventListener('online', () => {
    state.offline = false;
    render();
  });
  window.addEventListener('offline', () => {
    state.offline = true;
    render();
  });
  if (!location.hash) history.replaceState(null, '', '#rooms');
  render();
  try {
    await store.load();
    state.rooms = await source.listRoomTypes();
    state.pricesError = false;
    if (!state.datesReady) {
      const today = todayISO();
      state.checkin = defaultCheckinISO(store.prices, today);
      state.checkout = addDaysISO(state.checkin, 1);
      state.datesReady = true;
      persistStay();
    }
  } catch (err) {
    state.pricesError = true;
  } finally {
    state.loading = false;
    if (state.messageAuto) state.message = buildEnquiryMessage();
    render();
    document.body.dataset.ready = '1';
  }
  registerServiceWorker();
}

boot();
