// Reads the live site: /prices.json plus the static room catalogue.
// prices.json is fetched network-first. A service worker scoped to /app/
// or /owner/ cannot see that root file, so the cache lives here.

import { DataSource } from './data-source.js';
import { PROPERTY, ROOM_LIST } from './catalog.js';
import { ROOM_CODES } from './schema.js';

const PRICE_CACHE = 'melo-prices-v1';

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

/** Rebuild prices.json in the shape the website and the twice-daily job use. */
export function toPricesDocument(source) {
  const doc = emptyPricesDocument(source);
  const rooms = (source && source.rooms) || {};
  Object.keys(rooms).forEach((code) => {
    if (rooms[code] && rooms[code].enquire_only) doc.rooms[code] = { enquire_only: true };
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
      /* Cache Storage can be unavailable. The network copy still stands. */
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

export class StaticDataSource extends DataSource {
  constructor() {
    super();
    this.prices = null;
    this.loaded = false;
    this.sessionEnquiries = [];
  }

  async load() {
    this.prices = toPricesDocument(await fetchPricesDocument());
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
    return ROOM_LIST.map((room) => ({
      ...room,
      enquireOnly: !!(this.prices && this.prices.rooms && this.prices.rooms[room.code] && this.prices.rooms[room.code].enquire_only),
    }));
  }

  ratesFrom(document, query) {
    const doc = document || this.prices;
    if (!doc || !doc.nights) return [];
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
      ROOM_LIST.forEach((room) => {
        if (onlyId && room.id !== onlyId) return;
        const cell = doc.nights[date] ? doc.nights[date][room.code] : undefined;
        const amount = cell && cell.ota_krw != null ? cell.ota_krw : null;
        rates.push({
          roomTypeId: room.id,
          roomCode: room.code,
          date,
          currency: 'KRW',
          amount,
          unitsLeft: cell && cell.left != null ? cell.left : null,
          known: true,
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
}
