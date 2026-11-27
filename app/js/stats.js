// Read-only figures for the owner app. Built only from a prices.json document.
// A night is sold out when every room type is null. Enquire-only rooms keep
// their price in the room-type averages, and are not counted as bookable.

import { ROOM_CODES } from './schema.js';
import { directFromOta, discountPct, isEnquireOnly } from './pricing.js';
import { parseISODate } from './format.js';

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function windowDays(prices) {
  if (!prices || !prices.nights) return [];
  const pct = discountPct(prices);
  return Object.keys(prices.nights).sort().map((date) => {
    const parsed = parseISODate(date);
    const dow = parsed ? parsed.getDay() : 0;
    const rooms = ROOM_CODES.map((code) => {
      const cell = prices.nights[date][code];
      const enquireOnly = isEnquireOnly(prices, code);
      const amount = cell && cell.ota_krw != null ? directFromOta(cell.ota_krw, pct) : null;
      const left = cell && cell.left != null ? cell.left : null;
      let status = 'closed';
      if (amount != null && enquireOnly) status = 'enquire';
      else if (amount != null && left != null && left <= 2) status = 'few';
      else if (amount != null) status = 'open';
      return { code, amount, left, enquireOnly, status };
    });
    const bookable = rooms.filter((room) => room.status === 'open' || room.status === 'few');
    const amounts = bookable.map((room) => room.amount);
    const knownLeft = bookable.filter((room) => room.left != null);
    return {
      date,
      dow,
      weekend: dow === 5 || dow === 6,
      rooms,
      openCount: bookable.length,
      enquireCount: rooms.filter((room) => room.status === 'enquire').length,
      closedCount: rooms.filter((room) => room.status === 'closed').length,
      soldOut: rooms.every((room) => room.amount == null),
      unitsLeft: knownLeft.length ? knownLeft.reduce((sum, room) => sum + room.left, 0) : null,
      unitsComplete: bookable.length > 0 && knownLeft.length === bookable.length,
      minPrice: amounts.length ? Math.min(...amounts) : null,
      maxPrice: amounts.length ? Math.max(...amounts) : null,
      avgPrice: average(amounts),
    };
  });
}

export function summarise(prices) {
  const days = windowDays(prices);
  const bookable = [];
  const byType = {};
  ROOM_CODES.forEach((code) => { byType[code] = []; });
  days.forEach((day) => {
    day.rooms.forEach((room) => {
      if (room.amount == null) return;
      byType[room.code].push(room.amount);
      if (room.status !== 'enquire') {
        bookable.push({ date: day.date, weekend: day.weekend, amount: room.amount, code: room.code });
      }
    });
  });
  const bookableAmounts = bookable.map((row) => row.amount);
  const weekday = bookable.filter((row) => !row.weekend).map((row) => row.amount);
  const weekend = bookable.filter((row) => row.weekend).map((row) => row.amount);
  const pricedDays = days.filter((day) => day.minPrice != null);
  const cheapest = pricedDays.reduce((best, day) => (best == null || day.minPrice < best.minPrice ? day : best), null);
  const dearest = pricedDays.reduce((best, day) => (best == null || day.maxPrice > best.maxPrice ? day : best), null);
  return {
    updated: prices && prices.updated ? prices.updated : '',
    source: prices && prices.source ? prices.source : 'Booking.com',
    discountPct: discountPct(prices),
    nights: days.length,
    soldOutNights: days.filter((day) => day.soldOut).length,
    openNights: days.filter((day) => day.openCount > 0).length,
    average: average(bookableAmounts),
    min: bookableAmounts.length ? Math.min(...bookableAmounts) : null,
    max: bookableAmounts.length ? Math.max(...bookableAmounts) : null,
    weekdayAverage: average(weekday),
    weekendAverage: average(weekend),
    cheapestDate: cheapest ? cheapest.date : null,
    cheapestPrice: cheapest ? cheapest.minPrice : null,
    dearestDate: dearest ? dearest.date : null,
    dearestPrice: dearest ? dearest.maxPrice : null,
    byType: ROOM_CODES.map((code) => ({
      code,
      nights: byType[code].length,
      average: average(byType[code]),
      min: byType[code].length ? Math.min(...byType[code]) : null,
      max: byType[code].length ? Math.max(...byType[code]) : null,
    })),
    perNight: days.map((day) => ({
      date: day.date,
      openCount: day.openCount,
      soldOut: day.soldOut,
      minPrice: day.minPrice,
    })),
    days,
  };
}
