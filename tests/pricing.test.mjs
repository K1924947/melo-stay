import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOM_CODES, validateNightRate } from '../app/js/schema.js';
import { ROOM_LIST } from '../app/js/catalog.js';
import {
  directFromOta,
  quoteRoom,
} from '../app/js/pricing.js';
import { StaticDataSource, toPricesDocument } from '../app/js/static-source.js';
import { ChannelManagerAdapter } from '../app/js/channel-manager.js';
import { summarise } from '../app/js/stats.js';
import { DemoBookingsSource } from '../app/js/bookings-source.js';

const prices = JSON.parse(fs.readFileSync(new URL('../prices.json', import.meta.url), 'utf8'));

test('catalogue codes match the prices.json room order', () => {
  assert.deepEqual(ROOM_LIST.map((room) => room.code), ROOM_CODES);
  for (const room of ROOM_LIST) {
    for (let index = 1; index <= room.photos; index += 1) {
      assert.equal(fs.existsSync('images/rooms/' + room.folder + '/' + index + '.jpg'), true, room.folder + '/' + index);
    }
  }
});

test('discount 0 keeps the Booking.com amount with no rounding surprise', () => {
  assert.equal(directFromOta(112683, 0), 112683);
  assert.equal(directFromOta(112683.4, 0), 112683);
});

test('a discount uses the website floor-to-thousands rule', () => {
  assert.equal(directFromOta(112683, 10), 101000);
});

test('one open night quotes the nightly price and a one-night total', () => {
  const quote = quoteRoom({
    prices,
    roomCode: 'Superior Twin',
    nights: ['2026-11-29'],
    guests: 2,
    capacity: 2,
  });
  assert.equal(quote.status, 'priced');
  assert.equal(quote.totalDirect, 112683);
  assert.equal(quote.avgDirect, 112683);
  assert.equal(quote.fewLeft, true);
  assert.equal(quote.minLeft, 1);
  assert.equal(quote.pct, 0);
});

test('two nights sum and average the way the website does', () => {
  const quote = quoteRoom({
    prices,
    roomCode: 'Superior Twin',
    nights: ['2026-11-29', '2026-11-30'],
    guests: 2,
    capacity: 2,
  });
  assert.equal(quote.status, 'priced');
  assert.equal(quote.totalDirect, 112683 + 71609);
  assert.equal(quote.avgDirect, Math.round((112683 + 71609) / 2));
});

test('a null room is sold, a missing date is an enquiry, enquire-only ignores the number', () => {
  assert.equal(quoteRoom({
    prices,
    roomCode: 'Standard Twin',
    nights: ['2026-11-29'],
    guests: 2,
    capacity: 2,
  }).status, 'sold');
  assert.equal(quoteRoom({
    prices,
    roomCode: 'Family Twin',
    nights: ['2026-12-11', '2026-12-12'],
    guests: 2,
    capacity: 4,
  }).status, 'enquire-dates');
  assert.equal(quoteRoom({
    prices,
    roomCode: 'ECO Double',
    nights: ['2026-12-02'],
    guests: 2,
    capacity: 2,
  }).status, 'enquire');
});

test('family rooms take 4 guests and other rooms do not', () => {
  assert.equal(quoteRoom({
    prices,
    roomCode: 'Family Twin',
    nights: ['2026-11-29'],
    guests: 4,
    capacity: 4,
  }).status, 'priced');
  const standard = quoteRoom({
    prices,
    roomCode: 'Standard Twin',
    nights: ['2026-12-01'],
    guests: 3,
    capacity: 2,
  });
  assert.equal(standard.status, 'capacity');
  assert.equal(standard.capacity, 2);
});

test('three rooms left is not marked limited; from-price is the cheapest open night', () => {
  const quote = quoteRoom({
    prices,
    roomCode: 'Superior Double',
    nights: ['2026-12-06'],
    guests: 2,
    capacity: 2,
  });
  assert.equal(quote.status, 'priced');
  assert.equal(quote.fewLeft, false);
  assert.equal(quote.totalDirect, 78121);
  const from = quoteRoom({
    prices,
    roomCode: 'Standard Twin',
    nights: [],
    guests: 2,
    capacity: 2,
  });
  assert.equal(from.status, 'from');
  assert.equal(from.fromDirect, 61377);
});

test('exported prices.json keeps nulls, enquire-only, and the eight keys', () => {
  const doc = toPricesDocument(prices);
  assert.equal(doc.discount_pct, 0);
  assert.equal(doc.source, 'Booking.com');
  assert.deepEqual(doc.rooms['ECO Double'], { enquire_only: true });
  assert.equal(doc.rooms['Standard Twin'], undefined);
  const night = doc.nights['2026-11-28'];
  assert.deepEqual(Object.keys(night), ROOM_CODES);
  assert.equal(night['Standard Twin'], null);
  assert.deepEqual(night['Family Twin'], { ota_krw: 424391, left: 1 });
  assert.equal(JSON.parse(JSON.stringify(doc)).nights['2026-12-01']['Standard Twin'].left, null);
});

test('StaticDataSource rates distinguish closed nights from priced ones', () => {
  const source = new StaticDataSource();
  source.prices = toPricesDocument(prices);
  const rates = source.ratesFrom(source.prices, { from: '2026-11-29', to: '2026-11-29', roomTypeId: 'str' });
  assert.equal(rates.length, 1);
  assert.equal(rates[0].available, false);
  assert.equal(rates[0].amount, null);
  assert.equal(validateNightRate(rates[0]), null);
  const open = source.ratesFrom(source.prices, { from: '2026-11-29', to: '2026-11-29', roomTypeId: 'suptr' });
  assert.equal(open[0].available, true);
  assert.equal(open[0].amount, 112683);
  assert.equal(open[0].unitsLeft, 1);
  assert.equal(validateNightRate(open[0]), null);
});

test('the channel manager stub does not pretend to be connected', async () => {
  const adapter = new ChannelManagerAdapter(new StaticDataSource());
  assert.deepEqual(await adapter.listBookings(), []);
  const described = await adapter.describeConnection();
  assert.equal(described.connected, false);
  await assert.rejects(() => adapter.pushRates([]), /not connected/i);
  await assert.rejects(() => adapter.connect({}), /No channel manager is connected/);
});

test('owner stats read the live price file without treating null as a price', () => {
  const report = summarise(prices);
  assert.equal(report.nights, 14);
  assert.equal(report.days.find((day) => day.date === '2026-11-28').minPrice, 424391);
  assert.equal(report.days.find((day) => day.date === '2026-11-28').openCount, 2);
  assert.equal(report.days.find((day) => day.date === '2026-11-28').soldOut, false);
  const eco = report.byType.find((row) => row.code === 'ECO Double');
  assert.ok(eco.nights > 0);
  assert.equal(report.days.find((day) => day.date === '2026-12-02').rooms.find((room) => room.code === 'ECO Double').status, 'enquire');
});

test('demo bookings match a test reference and refuse the wrong surname', async () => {
  const src = new DemoBookingsSource();
  src.data = JSON.parse(fs.readFileSync('app/data/demo-bookings.json', 'utf8'));
  const found = await src.lookupBooking({ reference: 'test1234', who: 'kim' });
  assert.equal(found.roomCode, 'Family Twin');
  assert.equal(found.nights, 3);
  assert.equal(found.status, 'confirmed');
  assert.equal(found.demo, true);
  const byEmail = await src.lookupBooking({ reference: 'TEST5678', who: 'guest.sato@example.com' });
  assert.equal(byEmail.status, 'pending');
  assert.equal(await src.lookupBooking({ reference: 'TEST1234', who: 'Park' }), null);
  const thread = await src.listMessages('TEST1234', 'ko');
  assert.match(thread[0].body, /테스트/);
  const doc = fs.readFileSync('docs/INTEGRATION.md', 'utf8');
  assert.match(doc, /lookupBooking/);
  assert.match(doc, /sendMessage/);
  assert.match(doc, /TEST1234/);
});

test('the integration note names the separate owner app and the gate', () => {
  const doc = fs.readFileSync('docs/INTEGRATION.md', 'utf8');
  const owner = fs.readFileSync('owner/js/i18n.js', 'utf8');
  const guest = fs.readFileSync('app/js/app.js', 'utf8');
  assert.match(doc, /melo-owner/);
  assert.match(doc, /\/owner\//);
  assert.match(doc, /prices\.json/);
  assert.match(doc, /webhook/i);
  assert.match(doc, /iCal/);
  assert.match(owner, /melo-owner/);
  assert.equal(guest.includes('renderOwner'), false);
  assert.equal(guest.includes("navigate('owner')"), false);
});
