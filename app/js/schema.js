// Normalised inventory for melo stay.
// prices.json stays the on-disk feed the twice-daily job overwrites.
// Everything else in the app speaks these shapes, so a channel manager
// can replace the feed without rewriting the screens.
//
// See docs/INTEGRATION.md.

export const SCHEMA_VERSION = 1;

/** prices.json room names, in the order that file uses. */
export const ROOM_CODES = [
  'Standard Twin',
  'Superior Twin',
  'Deluxe Corner Twin',
  'ECO Double',
  'Standard Double',
  'Superior Double',
  'Family Twin',
  'Deluxe Family Twin',
];

/**
 * @typedef {Object} Property
 * @property {string} id
 * @property {string} name
 * @property {string} timezone
 * @property {string} currency
 * @property {number} roomCount
 * @property {string} checkIn       "15:00"
 * @property {string} checkInUntil  "22:00"
 * @property {string} checkOut      "11:00"
 * @property {{email: string, phone: string, phoneHref: string}} contact
 * @property {{id: string, name: string, url: string}[]} channels
 */

/**
 * One sellable room type, not one physical key.
 * `code` is the prices.json key. `id` is the short id used on the website.
 *
 * @typedef {Object} RoomType
 * @property {string} id
 * @property {string} code
 * @property {string} group
 * @property {number} capacity
 * @property {number} photos
 * @property {string} folder
 * @property {string[]} amenities
 * @property {boolean} enquireOnly
 * @property {Record<string, RoomCopy>} copy
 */

/**
 * @typedef {Object} RoomCopy
 * @property {string} name
 * @property {string} tier
 * @property {string} sub
 * @property {string} card
 * @property {string} description
 * @property {string} description2
 * @property {string} size
 * @property {string} beds
 */

/**
 * One room type on one stay-night.
 * `known: false` means the feed does not cover that date (outside the 14-night window).
 * `available: false` with `known: true` means the feed says the room is closed (null).
 * `amount` is the Booking.com figure in KRW before the website's discount rule.
 *
 * @typedef {Object} NightRate
 * @property {string} roomTypeId
 * @property {string} roomCode
 * @property {string} date              YYYY-MM-DD, the night of the stay
 * @property {string} currency
 * @property {number|null} amount
 * @property {number|null} unitsLeft
 * @property {boolean} known
 * @property {boolean} available
 * @property {boolean} enquireOnly
 * @property {string} source
 */

/**
 * A direct question from the guest app. v1 delivers it by email.
 * It is not a confirmed booking.
 *
 * @typedef {Object} Enquiry
 * @property {string} id
 * @property {string} createdAt
 * @property {string} name
 * @property {string} email
 * @property {string} message
 * @property {string|null} roomTypeId
 * @property {string|null} checkIn
 * @property {string|null} checkOut
 * @property {number|null} guests
 * @property {'sent'|'failed'} status
 * @property {'direct'} channel
 */

/**
 * A reservation, once a channel manager is connected.
 * v1 has none of these.
 *
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} channel
 * @property {string|null} externalId
 * @property {string|null} roomTypeId
 * @property {string} checkIn
 * @property {string} checkOut
 * @property {number|null} guests
 * @property {'confirmed'|'cancelled'|'pending'} status
 * @property {number|null} amount
 * @property {string} currency
 * @property {string|null} guestName
 * @property {string|null} updatedAt
 */

/**
 * @param {NightRate} rate
 * @returns {string|null} problem, or null when the rate is usable
 */
export function validateNightRate(rate) {
  if (!rate || typeof rate.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rate.date)) {
    return 'date';
  }
  if (!rate.roomTypeId || !rate.roomCode) return 'room';
  if (rate.currency !== 'KRW') return 'currency';
  if (rate.amount != null && (!Number.isFinite(rate.amount) || rate.amount < 0)) return 'amount';
  if (rate.unitsLeft != null && (!Number.isInteger(rate.unitsLeft) || rate.unitsLeft < 0)) return 'unitsLeft';
  if (rate.known && rate.available && rate.amount == null) return 'available-without-amount';
  if (rate.known && !rate.available && rate.amount != null) return 'closed-with-amount';
  return null;
}
