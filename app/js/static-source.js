// Reads the live site: /prices.json plus the static room catalogue.
// Owner edits stay in this browser until they are downloaded or committed.
// They are not written back into the guest view, and the token for a
// GitHub commit never passes through this file.

import { DataSource } from './data-source.js';
import { PROPERTY, ROOM_LIST } from './catalog.js';
import { ROOM_CODES, SCHEMA_VERSION } from './schema.js';
import { enumerateNights } from './format.js';

const RATE_DRAFT_KEY = 'melo_owner_rate_draft';
const ROOM_DRAFT_KEY = 'melo_owner_room_draft';
const PRICE_CACHE = 'melo-prices-v1';

function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function storageDrop(key) {
  localStorage.removeItem(key);
}

export function emptyPricesDocument(base) {
  return {
    updated: (base && base.updated) || '',
    discount_pct: base && base.discount_pct != null ? base.discount_pct : 0,
    source: (base && base.source) || 'Booking.com',
    rooms: {},
    nights: {},
  };
}

function normaliseCell(cell) {
  if (cell == null) return null;
  const amount = Number(cell.ota_krw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  let left = null;
  if (cell.left != null && cell.left !== '') {
    const parsed = Number(cell.left);
    if (Number.isInteger(parsed) && parsed >= 0) left = parsed;
  }
  return { ota_krw: Math.round(amount), left };
}

/**
 * Rebuild a prices.json document in the shape the website and the
 * twice-daily job already use. Extra fields are dropped on purpose.
 */
export function toPricesDocument(source) {
  const doc = emptyPricesDocument(source);
  const rooms = (source && source.rooms) || {};
  Object.keys(rooms).forEach((code) => {
    if (rooms[code] && rooms[code].enquire_only) {
      doc.rooms[code] = { enquire_only: true };
    }
  });
  const nights = (source && source.nights) || {};
  Object.keys(nights).sort().forEach((date) => {
    const row = {};
    ROOM_CODES.forEach((code) => {
      row[code] = normaliseCell(nights[date] ? nights[date][code] : null);
    });
    doc.nights[date] = row;
  });
  return doc;
}

export function clonePrices(doc) {
  return toPricesDocument(doc);
}

function mergeCopy(base, override) {
  if (!override) return { ...base };
  const next = { ...base };
  Object.keys(override).forEach((key) => {
    if (typeof override[key] === 'string') next[key] = override[key];
  });
  return next;
}

export function applyRoomOverrides(rooms, overrides) {
  const byId = (overrides && overrides.roomTypes) || {};
  return rooms.map((room) => {
    const patch = byId[room.id];
    if (!patch) return { ...room, enquireOnly: false, copy: { ...room.copy } };
    let capacity = room.capacity;
    if (Number.isInteger(patch.capacity) && patch.capacity >= 1 && patch.capacity <= 8) {
      capacity = patch.capacity;
    }
    const copy = {};
    for (const lang of Object.keys(room.copy)) {
      copy[lang] = mergeCopy(room.copy[lang], patch.copy && patch.copy[lang]);
    }
    return { ...room, capacity, copy };
  });
}

export function roomOverridesDocument(draft) {
  return {
    schema: 'melo.room-overrides',
    schemaVersion: SCHEMA_VERSION,
    updated: new Date().toISOString(),
    roomTypes: (draft && draft.roomTypes) || {},
  };
}

async function fetchPricesDocument() {
  const url = '/prices.json';
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('prices ' + response.status);
    const data = await response.json();
    try {
      const cache = await caches.open(PRICE_CACHE);
      await cache.put(url, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch (err) {
      /* Cache Storage can be unavailable in a private window. The network copy still stands. */
    }
    return data;
  } catch (err) {
    try {
      const cache = await caches.open(PRICE_CACHE);
      const cached = await cache.match(url);
      if (cached) return cached.json();
    } catch (cacheErr) {
      /* fall through */
    }
    throw err;
  }
}

async function fetchRoomOverrides() {
  try {
    const response = await fetch('/app/data/room-overrides.json', { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    return null;
  }
}

export class StaticDataSource extends DataSource {
  constructor() {
    super();
    this.prices = null;
    this.remoteOverrides = null;
    this.loaded = false;
    this.sessionEnquiries = [];
  }

  async load() {
    this.prices = toPricesDocument(await fetchPricesDocument());
    this.remoteOverrides = await fetchRoomOverrides();
    this.loaded = true;
    return this;
  }

  publishedPrices() {
    return this.prices;
  }

  async getProperty() {
    return PROPERTY;
  }

  async listRoomTypes() {
    const rooms = applyRoomOverrides(ROOM_LIST, this.remoteOverrides).map((room) => ({
      ...room,
      enquireOnly: !!(this.prices && this.prices.rooms && this.prices.rooms[room.code] && this.prices.rooms[room.code].enquire_only),
    }));
    return rooms;
  }

  /**
   * Rates from the published prices.json.
   * Pass `document` to quote a draft instead.
   */
  ratesFrom(document, query) {
    const doc = document || this.prices;
    if (!doc || !doc.nights) return [];
    const rooms = applyRoomOverrides(ROOM_LIST, this.remoteOverrides);
    const from = query && query.from;
    const to = query && query.to;
    const onlyId = query && query.roomTypeId;
    const dates = Object.keys(doc.nights).sort().filter((date) => {
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
    const rates = [];
    dates.forEach((date) => {
      rooms.forEach((room) => {
        if (onlyId && room.id !== onlyId) return;
        const cell = doc.nights[date] ? doc.nights[date][room.code] : undefined;
        const known = Object.prototype.hasOwnProperty.call(doc.nights, date);
        const amount = cell && cell.ota_krw != null ? cell.ota_krw : null;
        rates.push({
          roomTypeId: room.id,
          roomCode: room.code,
          date,
          currency: 'KRW',
          amount,
          unitsLeft: cell && cell.left != null ? cell.left : null,
          known,
          available: amount != null,
          enquireOnly: !!(doc.rooms && doc.rooms[room.code] && doc.rooms[room.code].enquire_only),
          source: doc.source || 'Booking.com',
        });
      });
    });
    return rates;
  }

  async getRates(query) {
    return this.ratesFrom(this.prices, query);
  }

  async listBookings() {
    return [];
  }

  async listEnquiries() {
    return this.sessionEnquiries.slice();
  }

  async recordEnquiry(enquiry) {
    this.sessionEnquiries.push(enquiry);
    return enquiry;
  }

  async describeConnection() {
    return {
      connected: false,
      mode: 'static',
      detail: 'Reading /prices.json and the room catalogue shipped with the website.',
    };
  }

  readRateDraft() {
    const draft = storageGet(RATE_DRAFT_KEY);
    if (!draft || !draft.document) return null;
    return {
      basedOnUpdated: draft.basedOnUpdated || '',
      savedAt: draft.savedAt || '',
      document: toPricesDocument(draft.document),
    };
  }

  writeRateDraft(document) {
    const wrapper = {
      basedOnUpdated: this.prices ? this.prices.updated : '',
      savedAt: new Date().toISOString(),
      document: toPricesDocument(document),
    };
    const existing = storageGet(RATE_DRAFT_KEY);
    if (existing && existing.basedOnUpdated) wrapper.basedOnUpdated = existing.basedOnUpdated;
    storageSet(RATE_DRAFT_KEY, wrapper);
    return wrapper;
  }

  beginRateDraft() {
    const existing = this.readRateDraft();
    if (existing) return existing;
    const wrapper = {
      basedOnUpdated: this.prices ? this.prices.updated : '',
      savedAt: new Date().toISOString(),
      document: clonePrices(this.prices || emptyPricesDocument()),
    };
    storageSet(RATE_DRAFT_KEY, wrapper);
    return wrapper;
  }

  clearRateDraft() {
    storageDrop(RATE_DRAFT_KEY);
  }

  readRoomDraft() {
    return storageGet(ROOM_DRAFT_KEY);
  }

  writeRoomDraft(roomTypes) {
    const wrapper = {
      savedAt: new Date().toISOString(),
      roomTypes: roomTypes || {},
    };
    storageSet(ROOM_DRAFT_KEY, wrapper);
    return wrapper;
  }

  clearRoomDraft() {
    storageDrop(ROOM_DRAFT_KEY);
  }

  /** Nights between two dates, used by enquiry prefill. */
  stayNights(checkin, checkout) {
    return enumerateNights(checkin, checkout);
  }
}
