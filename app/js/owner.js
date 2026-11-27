import { el } from './dom.js';
import { GROUPS } from './catalog.js';
import { ROOM_CODES } from './schema.js';
import { ownerText } from './owner-i18n.js';
import { quoteRoom, discountPct } from './pricing.js';
import { addDaysISO, formatKrw, seoulTodayISO } from './format.js';
import { roomOverridesDocument, toPricesDocument } from './static-source.js';

/** Public on purpose. See docs/INTEGRATION.md. */
export const OWNER_GATE = 'melo-owner';

const GITHUB = {
  owner: 'K1924947',
  repo: 'melo-stay',
  branch: 'main',
  overridesPath: 'app/data/room-overrides.json',
  pricesPath: 'prices.json',
};

const COPY_LANGS = [
  ['ko', 'langKo'],
  ['en', 'langEn'],
  ['zh', 'langZh'],
  ['ja', 'langJa'],
];

const COPY_FIELDS = [
  ['name', 'fieldName', false],
  ['tier', 'fieldTier', false],
  ['sub', 'fieldSub', false],
  ['card', 'fieldCard', false],
  ['description', 'fieldDesc', true],
  ['description2', 'fieldDesc2', true],
  ['size', 'fieldSize', false],
  ['beds', 'fieldBeds', false],
];

const ui = { roomId: 'str', copyLang: 'ko' };

function mark(kind) {
  return el('span', { class: 'mark mark-' + kind, 'aria-hidden': 'true' });
}

function statusLabel(kind, text) {
  return el('span', { class: 'status-line' }, [mark(kind), el('span', {}, text)]);
}

function roomName(room, lang) {
  const copy = room.copy[lang] || room.copy.ko || room.copy.en;
  return copy.name;
}

function orderedRooms(rooms) {
  const byId = Object.fromEntries(rooms.map((room) => [room.id, room]));
  const ordered = [];
  GROUPS.forEach((group) => {
    group.ids.forEach((id) => {
      if (byId[id]) ordered.push(byId[id]);
    });
  });
  return ordered;
}

function viewingDocument(store) {
  const draft = store.readRateDraft();
  if (draft && draft.document) return { doc: draft.document, draft };
  const published = store.publishedPrices();
  return { doc: published, draft: null };
}

function ensureDraft(store) {
  return store.beginRateDraft();
}

function setCell(store, date, code, cell) {
  const draft = ensureDraft(store);
  const doc = draft.document;
  if (!doc.nights[date]) {
    doc.nights[date] = {};
    ROOM_CODES.forEach((name) => {
      doc.nights[date][name] = null;
    });
  }
  doc.nights[date][code] = cell;
  store.writeRateDraft(doc);
}

function setEnquireOnly(store, code, on) {
  const draft = ensureDraft(store);
  const doc = draft.document;
  if (!doc.rooms) doc.rooms = {};
  if (on) doc.rooms[code] = { enquire_only: true };
  else delete doc.rooms[code];
  store.writeRateDraft(doc);
}

function previewFor(api, room, date, doc) {
  const quote = quoteRoom({
    prices: doc,
    roomCode: room.code,
    nights: [date],
    guests: 2,
    capacity: room.capacity,
  });
  if (quote.status === 'enquire') return api.t('previewEnquire');
  if (quote.status === 'sold' || quote.status === 'soon') return api.t('previewClosed');
  if (quote.status === 'priced') return formatKrw(quote.totalDirect);
  return api.t('previewEnquire');
}

function download(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

async function githubPut(token, path, content, message) {
  const api = 'https://api.github.com/repos/' + GITHUB.owner + '/' + GITHUB.repo + '/contents/' + path;
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  let sha;
  const existing = await fetch(api + '?ref=' + GITHUB.branch, { headers });
  if (existing.status === 200) {
    sha = (await existing.json()).sha;
  } else if (existing.status !== 404) {
    const problem = await existing.json().catch(() => ({}));
    throw new Error(problem.message || 'GitHub ' + existing.status);
  }
  const body = {
    message,
    content: utf8ToBase64(content),
    branch: GITHUB.branch,
  };
  if (sha) body.sha = sha;
  const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
  const data = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error(data.message || 'GitHub ' + put.status);
  return data;
}

function renderGate(api) {
  const error = el('p', { class: 'gate-error', hidden: true, role: 'alert' }, api.t('gateWrong'));
  const input = el('input', {
    type: 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    'aria-label': api.t('gatePass'),
  });
  const form = el('form', {
    class: 'card gate',
    onsubmit: (event) => {
      event.preventDefault();
      if (input.value.trim() === OWNER_GATE) api.unlock();
      else error.hidden = false;
    },
  }, [
    el('h1', {}, api.t('gateTitle')),
    el('p', { class: 'lede' }, api.t('gateBody')),
    el('label', { class: 'field' }, [el('span', {}, api.t('gatePass')), input]),
    el('p', { class: 'gate-pass' }, api.t('gatePassValue')),
    el('button', { type: 'submit', class: 'btn btn-ink' }, api.t('gateEnter')),
    error,
    el('h2', {}, api.t('securityTitle')),
    el('p', { class: 'note' }, api.t('securityBody')),
  ]);
  return form;
}

function renderNav(api) {
  const items = [
    ['overview', 'navOverview'],
    ['rooms', 'navRooms'],
    ['rates', 'navRates'],
    ['availability', 'navAvailability'],
    ['export', 'navExport'],
  ];
  const nav = el('div', { class: 'owner-nav' });
  items.forEach(([id, key]) => {
    nav.append(el('button', {
      type: 'button',
      'aria-current': api.section === id ? 'page' : null,
      onclick: () => api.openSection(id),
    }, api.t(key)));
  });
  const tools = el('div', { class: 'owner-tools' }, [
    el('button', { type: 'button', onclick: () => api.go('rooms') }, api.t('guestApp')),
    el('button', { type: 'button', onclick: () => api.lock() }, api.t('logout')),
  ]);
  return el('div', {}, [nav, tools]);
}

function cellKind(doc, room, date, t) {
  const enquire = doc.rooms && doc.rooms[room.code] && doc.rooms[room.code].enquire_only;
  const cell = doc.nights[date] ? doc.nights[date][room.code] : null;
  if (enquire) return { kind: 'ask', label: t('askWord'), cell };
  if (!cell) return { kind: 'closed', label: t('closedWord'), cell: null };
  if (cell.left != null && cell.left <= 2) return { kind: 'few', label: t('fewWord'), cell };
  return { kind: 'open', label: t('open'), cell };
}

function renderOverview(api) {
  const { doc, draft } = viewingDocument(api.store);
  const wrap = el('section', {});
  wrap.append(el('h1', {}, api.t('overviewTitle')));
  wrap.append(el('p', { class: 'lede' }, api.t('overviewLead')));
  wrap.append(el('p', { class: 'note' }, api.t('channelOff')));
  wrap.append(el('p', { class: 'note' }, api.t('inboxNote') + ' ' + 'melostayseoul@gmail.com'));
  wrap.append(el('p', { class: 'note' }, api.t('roomCount')));
  if (!doc || !doc.nights) {
    wrap.append(el('p', {}, api.t('noFeed')));
    return wrap;
  }
  wrap.append(el('p', { class: 'updated' }, (draft ? api.t('draft') : api.t('published')) + ' · ' + api.t('updated', { date: doc.updated || '—' })));
  if (draft && api.store.publishedPrices() && draft.basedOnUpdated !== api.store.publishedPrices().updated) {
    wrap.append(el('p', { class: 'banner' }, api.t('draftStale')));
  }
  const rooms = orderedRooms(api.rooms);
  let open = 0;
  let few = 0;
  let closed = 0;
  let ask = 0;
  Object.keys(doc.nights).forEach((date) => {
    rooms.forEach((room) => {
      const kind = cellKind(doc, room, date, api.t).kind;
      if (kind === 'closed') closed += 1;
      else if (kind === 'ask') ask += 1;
      else if (kind === 'few') few += 1;
      else open += 1;
    });
  });
  wrap.append(el('div', { class: 'legend' }, [
    statusLabel('open', api.t('summaryOpen', { n: String(open) })),
    statusLabel('few', api.t('summaryFew', { n: String(few) })),
    statusLabel('closed', api.t('summaryClosed', { n: String(closed) })),
    statusLabel('ask', api.t('summaryAsk', { n: String(ask) })),
  ]));
  Object.keys(doc.nights).sort().forEach((date) => {
    const card = el('article', { class: 'card night-card' });
    const head = el('div', { class: 'night-head' }, [
      el('h2', {}, date),
      el('button', {
        type: 'button',
        class: 'text-btn',
        onclick: () => api.openSection('rates', { date }),
      }, api.t('editThis')),
    ]);
    card.append(head);
    rooms.forEach((room) => {
      const info = cellKind(doc, room, date, api.t);
      const meta = [];
      if (info.cell) {
        meta.push(formatKrw(info.cell.ota_krw));
        meta.push(info.cell.left == null ? api.t('noCount') : api.t('units', { n: String(info.cell.left) }));
      }
      card.append(el('div', { class: 'avail-row' }, [
        statusLabel(info.kind, info.label),
        el('span', { class: 'avail-name' }, roomName(room, api.lang)),
        el('span', { class: 'avail-meta' }, meta.join(' · ')),
      ]));
    });
    wrap.append(card);
  });
  return wrap;
}

function renderEditor(api, mode) {
  const published = api.store.publishedPrices();
  const { doc, draft } = viewingDocument(api.store);
  const wrap = el('section', {});
  wrap.append(el('h1', {}, api.t(mode === 'availability' ? 'availTitle' : 'rateTitle')));
  wrap.append(el('p', { class: 'lede' }, api.t(mode === 'availability' ? 'availLead' : 'closedHint')));
  if (!doc || !doc.nights || !Object.keys(doc.nights).length) {
    wrap.append(el('p', {}, api.t('noFeed')));
    return wrap;
  }
  const pct = discountPct(doc);
  wrap.append(el('p', { class: 'note' }, pct ? api.t('discountSome', { pct: String(pct) }) : api.t('discountNone')));
  wrap.append(el('p', { class: 'updated' }, draft ? api.t('draft') : api.t('published')));
  if (draft) {
    wrap.append(el('p', { class: 'note' }, api.t('basedOn', { date: draft.basedOnUpdated || '—' })));
    if (published && draft.basedOnUpdated !== published.updated) {
      wrap.append(el('p', { class: 'banner' }, api.t('draftStale')));
      wrap.append(el('button', {
        type: 'button',
        class: 'btn btn-ghost',
        onclick: () => {
          if (window.confirm(api.t('clearDraftConfirm'))) {
            api.store.clearRateDraft();
            api.rerender();
          }
        },
      }, api.t('restartDraft')));
    }
  }
  const dates = Object.keys(doc.nights).sort();
  const date = dates.indexOf(api.date) !== -1 ? api.date : dates[0];
  const picker = el('div', { class: 'date-grid' });
  const select = el('select', {
    'aria-label': api.t('rateTitle'),
    onchange: (event) => api.openSection(mode === 'availability' ? 'availability' : 'rates', { date: event.target.value }),
  });
  dates.forEach((value) => {
    const option = el('option', { value }, value);
    if (value === date) option.selected = true;
    select.append(option);
  });
  picker.append(el('label', { class: 'field' }, [el('span', {}, api.t('rateTitle')), select]));
  picker.append(el('button', {
    type: 'button',
    class: 'btn btn-ghost',
    onclick: () => {
      const next = addDaysISO(dates[dates.length - 1], 1);
      const fresh = ensureDraft(api.store);
      if (!fresh.document.nights[next]) {
        fresh.document.nights[next] = {};
        ROOM_CODES.forEach((code) => {
          fresh.document.nights[next][code] = null;
        });
        api.store.writeRateDraft(fresh.document);
      }
      api.openSection(mode === 'availability' ? 'availability' : 'rates', { date: next });
    },
  }, api.t('addDate')));
  wrap.append(picker);
  const saved = el('p', { class: 'saved', 'aria-live': 'polite' });
  wrap.append(saved);

  orderedRooms(api.rooms).forEach((room) => {
    const cell = doc.nights[date] ? doc.nights[date][room.code] : null;
    const closed = !cell;
    const enquire = !!(doc.rooms && doc.rooms[room.code] && doc.rooms[room.code].enquire_only);
    const card = el('article', { class: 'card night-edit' });
    card.append(el('h2', {}, roomName(room, api.lang)));
    const preview = el('p', { class: 'preview' }, api.t('guestPreview') + ' · ' + previewFor(api, room, date, doc));
    const amount = el('input', {
      inputmode: 'numeric',
      autocomplete: 'off',
      value: cell ? String(cell.ota_krw) : '',
      disabled: closed,
      'aria-label': api.t('amount'),
    });
    const left = el('input', {
      inputmode: 'numeric',
      autocomplete: 'off',
      value: cell && cell.left != null ? String(cell.left) : '',
      disabled: closed,
      'aria-label': api.t('left'),
    });
    const amountError = el('p', { class: 'field-error', hidden: true }, api.t('amountError'));
    const leftError = el('p', { class: 'field-error', hidden: true }, api.t('leftError'));
    const closedBox = el('input', { type: 'checkbox' });
    closedBox.checked = closed;
    function currentLeft() {
      if (left.value.trim() === '') return null;
      const parsed = Number(left.value);
      if (!Number.isInteger(parsed) || parsed < 0) return undefined;
      return parsed;
    }
    function refreshPreview() {
      const latest = api.store.readRateDraft();
      const source = (latest && latest.document) || api.store.publishedPrices();
      preview.textContent = api.t('guestPreview') + ' · ' + previewFor(api, room, date, source);
    }
    function saveOpen() {
      amountError.hidden = true;
      leftError.hidden = true;
      const parsedLeft = currentLeft();
      if (parsedLeft === undefined) {
        leftError.hidden = false;
        return;
      }
      const parsedAmount = Number(String(amount.value).replace(/,/g, '').trim());
      if (amount.value.trim() === '' || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
        amountError.hidden = false;
        return;
      }
      setCell(api.store, date, room.code, { ota_krw: Math.round(parsedAmount), left: parsedLeft });
      saved.textContent = api.t('savedLocal');
      refreshPreview();
    }
    closedBox.addEventListener('change', () => {
      if (closedBox.checked) {
        setCell(api.store, date, room.code, null);
        amount.disabled = true;
        left.disabled = true;
        amountError.hidden = true;
        leftError.hidden = true;
        saved.textContent = api.t('savedLocal');
        refreshPreview();
        return;
      }
      amount.disabled = false;
      left.disabled = false;
      if (amount.value.trim() === '') {
        closedBox.checked = true;
        amount.disabled = true;
        left.disabled = true;
        amountError.hidden = false;
        if (!amountError.isConnected) card.append(amountError);
        return;
      }
      saveOpen();
      refreshPreview();
    });
    amount.addEventListener('change', saveOpen);
    left.addEventListener('change', saveOpen);
    const enquireBox = el('input', { type: 'checkbox' });
    enquireBox.checked = enquire;
    enquireBox.addEventListener('change', () => {
      setEnquireOnly(api.store, room.code, enquireBox.checked);
      saved.textContent = api.t('savedLocal');
      refreshPreview();
    });
    card.append(preview);
    card.append(el('label', { class: 'checkline' }, [closedBox, api.t('closed')]));
    card.append(el('label', { class: 'checkline' }, [enquireBox, api.t('enquireOnly')]));
    if (mode === 'rates') {
      card.append(el('label', { class: 'field' }, [el('span', {}, api.t('amount')), amount, amountError]));
    } else if (cell) {
      card.append(el('p', { class: 'note' }, api.t('amount') + ' ' + formatKrw(cell.ota_krw)));
    }
    card.append(el('label', { class: 'field' }, [el('span', {}, api.t('left')), left, leftError]));
    if (mode === 'availability') {
      card.append(el('button', {
        type: 'button',
        class: 'text-btn',
        onclick: () => api.openSection('rates', { date }),
      }, api.t('editThis')));
    }
    wrap.append(card);
  });
  if (draft) {
    wrap.append(el('button', {
      type: 'button',
      class: 'btn btn-ghost',
      onclick: () => {
        if (window.confirm(api.t('clearDraftConfirm'))) {
          api.store.clearRateDraft();
          api.rerender();
        }
      },
    }, api.t('clearDraft')));
  }
  return wrap;
}

function mergedCopy(room, lang, draft) {
  const base = room.copy[lang] || room.copy.en;
  const patch = draft && draft.roomTypes && draft.roomTypes[room.id] && draft.roomTypes[room.id].copy
    ? draft.roomTypes[room.id].copy[lang]
    : null;
  return { ...base, ...(patch || {}) };
}

function renderRooms(api) {
  const draft = api.store.readRoomDraft();
  const rooms = orderedRooms(api.rooms);
  if (!rooms.some((room) => room.id === ui.roomId)) ui.roomId = rooms[0].id;
  const room = rooms.find((item) => item.id === ui.roomId) || rooms[0];
  const copy = mergedCopy(room, ui.copyLang, draft);
  const capacity = draft && draft.roomTypes && draft.roomTypes[room.id] && Number.isInteger(draft.roomTypes[room.id].capacity)
    ? draft.roomTypes[room.id].capacity
    : room.capacity;
  const wrap = el('section', {});
  wrap.append(el('h1', {}, api.t('editRoom')));
  wrap.append(el('p', { class: 'lede' }, api.t('autoSave')));
  wrap.append(el('p', { class: 'note' }, api.t('photoNote')));
  const saved = el('p', { class: 'saved', 'aria-live': 'polite' });
  const select = el('select', {
    'aria-label': api.t('pickRoom'),
    onchange: (event) => {
      ui.roomId = event.target.value;
      api.rerender();
    },
  });
  rooms.forEach((item) => {
    const option = el('option', { value: item.id }, roomName(item, api.lang));
    if (item.id === room.id) option.selected = true;
    select.append(option);
  });
  wrap.append(el('label', { class: 'field' }, [el('span', {}, api.t('pickRoom')), select]));
  wrap.append(el('img', {
    class: 'edit-photo',
    src: '/images/rooms/' + room.folder + '/1.jpg',
    alt: roomName(room, api.lang),
  }));
  const cap = el('input', { type: 'number', min: '1', max: '8', value: String(capacity), inputmode: 'numeric' });
  cap.addEventListener('change', () => {
    const parsed = Number(cap.value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) return;
    const next = api.store.readRoomDraft() || api.store.writeRoomDraft(
      JSON.parse(JSON.stringify((api.store.remoteOverrides && api.store.remoteOverrides.roomTypes) || {}))
    );
    const roomTypes = next.roomTypes || {};
    if (!roomTypes[room.id]) roomTypes[room.id] = { copy: {} };
    roomTypes[room.id].capacity = parsed;
    api.store.writeRoomDraft(roomTypes);
    saved.textContent = api.t('savedLocal');
  });
  wrap.append(el('label', { class: 'field' }, [el('span', {}, api.t('capacity')), cap]));
  const langRow = el('div', { class: 'segmented', role: 'group', 'aria-label': api.t('copyLang') });
  COPY_LANGS.forEach(([id, key]) => {
    langRow.append(el('button', {
      type: 'button',
      'aria-pressed': ui.copyLang === id ? 'true' : 'false',
      class: ui.copyLang === id ? 'active' : '',
      onclick: () => {
        ui.copyLang = id;
        api.rerender();
      },
    }, api.t(key)));
  });
  wrap.append(langRow);
  function patch(field, value) {
    let next = api.store.readRoomDraft();
    if (!next) {
      const seed = JSON.parse(JSON.stringify((api.store.remoteOverrides && api.store.remoteOverrides.roomTypes) || {}));
      next = api.store.writeRoomDraft(seed);
    }
    const roomTypes = next.roomTypes;
    if (!roomTypes[room.id]) roomTypes[room.id] = { copy: {} };
    if (!roomTypes[room.id].copy) roomTypes[room.id].copy = {};
    if (!roomTypes[room.id].copy[ui.copyLang]) roomTypes[room.id].copy[ui.copyLang] = {};
    roomTypes[room.id].copy[ui.copyLang][field] = value;
    api.store.writeRoomDraft(roomTypes);
    saved.textContent = api.t('savedLocal');
  }
  COPY_FIELDS.forEach(([field, key, multiline]) => {
    const control = multiline
      ? el('textarea', { rows: '4' }, copy[field] || '')
      : el('input', { type: 'text', value: copy[field] || '' });
    if (multiline) control.value = copy[field] || '';
    control.addEventListener('change', () => patch(field, control.value));
    wrap.append(el('label', { class: 'field' }, [el('span', {}, api.t(key)), control]));
  });
  wrap.append(saved);
  if (draft) {
    wrap.append(el('button', {
      type: 'button',
      class: 'btn btn-ghost',
      onclick: () => {
        if (window.confirm(api.t('clearRoomsConfirm'))) {
          api.store.clearRoomDraft();
          api.rerender();
        }
      },
    }, api.t('clearRooms')));
  }
  return wrap;
}

function renderExport(api) {
  const draft = api.store.readRateDraft();
  const roomDraft = api.store.readRoomDraft();
  const hasRooms = !!(roomDraft && roomDraft.roomTypes && Object.keys(roomDraft.roomTypes).length);
  const wrap = el('section', {});
  wrap.append(el('h1', {}, api.t('exportTitle')));
  wrap.append(el('p', { class: 'lede' }, api.t('exportLead')));
  wrap.append(el('p', { class: 'banner' }, api.t('pricesWarn')));
  const published = api.store.publishedPrices();
  if (published) {
    wrap.append(el('button', {
      type: 'button',
      class: 'btn btn-ink',
      onclick: () => download('prices.json', toPricesDocument(published)),
    }, api.t('downloadPublished')));
  }
  if (draft) {
    wrap.append(el('button', {
      type: 'button',
      class: 'btn btn-accent',
      onclick: () => {
        const doc = toPricesDocument(draft.document);
        doc.updated = seoulTodayISO();
        download('prices.json', doc);
      },
    }, api.t('downloadDraft')));
  }
  wrap.append(el('button', {
    type: 'button',
    class: 'btn btn-ghost',
    disabled: !hasRooms,
    onclick: () => {
      if (!hasRooms) return;
      download('room-overrides.json', roomOverridesDocument(roomDraft));
    },
  }, hasRooms ? api.t('downloadRooms') : api.t('noRoomDraft')));
  wrap.append(el('h2', {}, api.t('githubTitle')));
  wrap.append(el('p', { class: 'note' }, api.t('githubHelp')));
  const token = el('input', {
    type: 'password',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    'aria-label': api.t('token'),
  });
  const includePrices = el('input', { type: 'checkbox' });
  const result = el('p', { class: 'saved', role: 'status' });
  const button = el('button', { type: 'button', class: 'btn btn-ink' }, api.t('commit'));
  button.addEventListener('click', async () => {
    const secret = token.value.trim();
    result.className = 'saved';
    if (!secret) {
      result.textContent = api.t('commitFail');
      return;
    }
    if (!hasRooms && !includePrices.checked) {
      result.textContent = api.t('commitNeed');
      return;
    }
    if (includePrices.checked && !draft && !published) {
      result.textContent = api.t('noFeed');
      return;
    }
    button.disabled = true;
    result.textContent = api.t('committing');
    try {
      if (hasRooms) {
        const body = JSON.stringify(roomOverridesDocument(roomDraft), null, 2) + '\n';
        await githubPut(secret, GITHUB.overridesPath, body, 'Update melo stay room details from the owner app');
      }
      if (includePrices.checked) {
        const sourceDoc = draft ? draft.document : published;
        const doc = toPricesDocument(sourceDoc);
        if (draft) doc.updated = seoulTodayISO();
        await githubPut(secret, GITHUB.pricesPath, JSON.stringify(doc, null, 2) + '\n', 'Update melo stay prices from the owner app');
      }
      token.value = '';
      result.className = 'saved is-ok';
      result.textContent = api.t('commitOk');
    } catch (err) {
      result.className = 'saved is-bad';
      result.textContent = api.t('commitFail') + (err && err.message ? ' ' + err.message : '');
    } finally {
      button.disabled = false;
    }
  });
  wrap.append(el('label', { class: 'field' }, [el('span', {}, api.t('token')), token]));
  wrap.append(el('label', { class: 'checkline' }, [includePrices, api.t('includePrices')]));
  wrap.append(button);
  wrap.append(result);
  wrap.append(el('h2', {}, api.t('securityTitle')));
  wrap.append(el('p', { class: 'note' }, api.t('securityBody')));
  return wrap;
}

export function renderOwner(main, api) {
  const text = (key, vars) => ownerText(api.lang, key, vars);
  const full = { ...api, t: text };
  if (!api.authed) {
    main.append(renderGate(full));
    return;
  }
  main.append(renderNav(full));
  if (api.section === 'rooms') main.append(renderRooms(full));
  else if (api.section === 'rates') main.append(renderEditor(full, 'rates'));
  else if (api.section === 'availability') main.append(renderEditor(full, 'availability'));
  else if (api.section === 'export') main.append(renderExport(full));
  else main.append(renderOverview(full));
}
