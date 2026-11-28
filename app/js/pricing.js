// The same price rules as index.html.
// discount_pct 0: show the Booking.com amount, with no strikethrough.
// A null room, or a room without ota_krw, is unavailable.
// A date missing from the feed is not "sold"; the guest is asked to enquire.

export function discountPct(prices) {
  const pct = prices && prices.discount_pct;
  return pct != null ? Number(pct) : 0;
}

export function directFromOta(ota, pct) {
  if (!pct) return Math.round(Number(ota));
  return Math.floor((Number(ota) * (1 - pct / 100)) / 1000) * 1000;
}

export function isEnquireOnly(prices, roomCode) {
  const record = prices && prices.rooms && prices.rooms[roomCode];
  return !!(record && record.enquire_only);
}

export function roomNight(prices, date, roomCode) {
  if (!prices || !prices.nights) return { missing: true };
  if (!Object.prototype.hasOwnProperty.call(prices.nights, date)) return { missing: true };
  const record = prices.nights[date][roomCode];
  if (record == null || record.ota_krw == null) return { soldOut: true };
  return { ota: record.ota_krw, left: record.left };
}

export function lowestDirectPrice(prices, roomCode) {
  if (!prices || !prices.nights) return null;
  let low = null;
  Object.keys(prices.nights).forEach((date) => {
    const night = roomNight(prices, date, roomCode);
    if (night.ota == null) return;
    const direct = directFromOta(night.ota, discountPct(prices));
    if (low == null || direct < low) low = direct;
  });
  return low;
}

export function defaultCheckinISO(prices, today) {
  const dates = prices && prices.nights ? Object.keys(prices.nights).sort() : [];
  if (!dates.length) return today;
  if (dates.indexOf(today) !== -1) return today;
  return dates.find((date) => date >= today) || dates[dates.length - 1];
}

/**
 * Guest-facing quote for one room type.
 * `guests` outside 1–4 is ignored and treated as 2, matching the website's select.
 *
 * @returns {{
 *   status: 'soon'|'enquire'|'capacity'|'from'|'enquire-dates'|'sold'|'priced',
 *   pct: number,
 *   capacity: number,
 *   fromDirect: number|null,
 *   fromOta: number|null,
 *   totalDirect: number|null,
 *   totalOta: number|null,
 *   avgDirect: number|null,
 *   avgOta: number|null,
 *   fewLeft: boolean,
 *   minLeft: number|null,
 *   nights: {date: string, ota: number, direct: number, left: number|null}[],
 * }}
 */
export function quoteRoom({ prices, roomCode, nights, guests, capacity }) {
  const pct = discountPct(prices);
  const cap = capacity || 2;
  const guestCount = guests >= 1 && guests <= 4 ? guests : 2;
  const empty = {
    status: 'soon',
    pct,
    capacity: cap,
    fromDirect: null,
    fromOta: null,
    totalDirect: null,
    totalOta: null,
    avgDirect: null,
    avgOta: null,
    fewLeft: false,
    minLeft: null,
    nights: [],
  };

  if (!prices || !prices.nights) return empty;
  if (isEnquireOnly(prices, roomCode)) return { ...empty, status: 'enquire' };
  if (guestCount > cap) return { ...empty, status: 'capacity' };

  const stay = nights || [];
  if (!stay.length) {
    const fromDirect = lowestDirectPrice(prices, roomCode);
    if (fromDirect == null) return { ...empty, status: 'enquire' };
    return { ...empty, status: 'from', fromDirect, fromOta: fromDirect };
  }

  const reads = stay.map((date) => ({ date, ...roomNight(prices, date, roomCode) }));
  if (reads.some((night) => night.missing)) return { ...empty, status: 'enquire-dates' };
  if (reads.some((night) => night.soldOut)) return { ...empty, status: 'sold' };

  const detailed = reads.map((night) => ({
    date: night.date,
    ota: Number(night.ota),
    direct: directFromOta(night.ota, pct),
    left: night.left == null ? null : night.left,
  }));
  const totalDirect = detailed.reduce((sum, night) => sum + night.direct, 0);
  const totalOta = detailed.reduce((sum, night) => sum + night.ota, 0);
  const counted = detailed.map((night) => night.left).filter((left) => left != null);
  const minLeft = counted.length ? Math.min(...counted) : null;
  return {
    ...empty,
    status: 'priced',
    totalDirect,
    totalOta,
    avgDirect: Math.round(totalDirect / detailed.length),
    avgOta: Math.round(totalOta / detailed.length),
    fewLeft: detailed.some((night) => night.left != null && night.left <= 2),
    minLeft,
    nights: detailed,
  };
}

export function stayLeavesTheWindow(prices, nights) {
  if (!nights || !nights.length || !prices || !prices.nights) return false;
  return nights.some((date) => !Object.prototype.hasOwnProperty.call(prices.nights, date));
}
