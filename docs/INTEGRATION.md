# Channel manager integration

melo stay’s public site stays a static GitHub Pages site: `index.html`, `prices.json`, `images/`, and `CNAME`. Nothing on that homepage links to the apps.

There are two separate web apps in this repo:

| App | URL | What it is |
| --- | --- | --- |
| Guest | `/app/` | Rooms, prices, enquiry, info. Its own manifest, icons, and service worker (`/app/sw.js`, scope `/app/`, start URL `/app/`). |
| Owner | `/owner/` | Read-only calendar and stats for Ed’s brother. Its own manifest, icons, and service worker (`/owner/sw.js`, scope `/owner/`, start URL `/owner/`). |

An outside job overwrites `prices.json` twice a day. Both apps read that file through the same data layer in `app/js/` (`StaticDataSource`, `ChannelManagerAdapter`). They do not change the file.

A service worker cannot see URLs outside its own folder on GitHub Pages. `prices.json` lives at the site root, so each worker only caches its own shell. `StaticDataSource` fetches `/prices.json` network-first and keeps the last copy in Cache Storage.

## What v1 does

- Guests look at rooms, prices, an enquiry form, and practical info. Enquiry mail goes through the same Web3Forms form as the website (`melostayseoul@gmail.com`, `+82-10-4093-8977`).
- Prices use the same rules as `index.html`. With `discount_pct` at 0, the guest sees the Booking.com amount and no strikethrough. A `null` room is unavailable. Dates outside the file are not treated as sold; the guest is asked to enquire.
- The owner app only reads. It shows a month calendar (price and availability per night, then each room type on tap) and a stats page (sold-out nights, average / min / max, price by room type, weekday vs weekend, cheapest and dearest dates, room types open per night). It does not edit rooms, download JSON, or commit to GitHub.
- The guest app has a Stay tab and a Chat tab. Chat is only for a logged-in booking. Before login the tab is locked (a padlock and the word “Locked”, plus a button to log in and a link to Enquire). Until a channel manager is connected, stays are the fake rows in `app/data/demo-bookings.json` (booking `TEST1234`, surname `Kim`). There is one thread per booking and no pre-booking thread. A cancelled stay (`TEST9012`) can be read, and the guest cannot send. A banner says it is test mode. Login stays in `sessionStorage`. Messages for the test are in `localStorage` (`melo_demo_mail_v1`) so the guest app and the owner Inbox on the same browser can see each other. A guest message is also emailed through Web3Forms, with the booking number in the subject. Demo mode adds an automatic property reply. This is not live chat: two phones, or a cleared browser, will not share the thread.
- The owner Inbox is a tab of its own. Later still only holds placeholders for bookings, occupancy, revenue, and enquiries.
- There is no channel manager yet. The adapter forwards reads to `StaticDataSource` and leaves the write paths unimplemented.

## What the light gate does not do

The owner passphrase is `melo-owner`. It is written in `owner/js/i18n.js` and on the gate screen.

That only keeps a casual visitor out of the owner screens. It is not a login. Anyone who can read the repository, the app’s JavaScript, or this document can open it. It does not hide prices, block a request, or protect bookings. There is no server checking it.

## prices.json, left alone

The outside job should keep writing this shape. The website and both apps understand it. Do not add required fields, and do not rename the room keys.

```json
{
  "updated": "2026-11-27",
  "discount_pct": 0,
  "source": "Booking.com",
  "rooms": {
    "ECO Double": { "enquire_only": true }
  },
  "nights": {
    "2026-11-28": {
      "Standard Twin": null,
      "Superior Twin": { "ota_krw": 112683, "left": 1 },
      "Deluxe Corner Twin": null,
      "ECO Double": null,
      "Standard Double": null,
      "Superior Double": null,
      "Family Twin": { "ota_krw": 120000, "left": 2 },
      "Deluxe Family Twin": { "ota_krw": 132000, "left": 3 }
    }
  }
}
```

- `null` means that room is unavailable that night. A missing night (no key for the date) means the feed does not cover it. The owner calendar shows those days as “no data”, not as sold out.
- `ota_krw` is the Booking.com price in won. `left` is how many rooms the feed says are left, or `null` if the count is unknown. A count of 0 does not by itself close the night; an empty price does.
- `rooms.<name>.enquire_only` makes the guest app ask for a rate even when a number is present. The owner calendar labels that room “enquire only” and does not count it as bookable. ECO Double is marked that way today. The app does not hard-code that room.
- `discount_pct` is the direct-booking reduction. At 0 the price is shown as-is. The website’s formula, which the apps copy, is: no discount means `Math.round(ota)`; a discount means `Math.floor(ota * (1 - pct/100) / 1000) * 1000`, and only then is the Booking.com figure struck through.
- `updated` is a calendar date. The file does not include a clock time. The owner screen says so.
- Every night should list all eight names: Standard Twin, Superior Twin, Deluxe Corner Twin, ECO Double, Standard Double, Superior Double, Family Twin, Deluxe Family Twin.

The owner stats treat Friday and Saturday nights as the weekend. A night is sold out only when every room type is null.

## Normalised schema

`app/js/schema.js` is the shape both screens and a future channel manager share. `prices.json` is only the current feed. `app/js/stats.js` turns that feed into the calendar and the dashboard. It does not talk to the network.

| Thing | Meaning |
| --- | --- |
| Property | The hostel: timezone `Asia/Seoul`, currency KRW, 24 private rooms, check-in 15:00–22:00, check-out 11:00, contact and OTA links. |
| RoomType | One of the eight types. `id` is the short website id (`str`, `suptr`, …). `code` is the `prices.json` name. `capacity` is 4 for the two family types and 2 for the others, matching the website. |
| NightRate | One type on one stay-night. `amount` is the Booking.com figure or `null`. `known: false` means the date is outside the feed. `available` is true only when `known` and `amount` is a number. `unitsLeft` is the `left` count. `enquireOnly` is the room-level flag. |
| Enquiry | A direct question from the guest app. v1 sends it by email. It is not a booking. The owner Later tab does not list them yet. |
| GuestBooking | What a guest sees after login: `reference`, surname, room type, `checkIn`, `checkOut`, `nights`, `guests`, `status` (`confirmed`, `pending`, `cancelled`). Demo rows are fake. |
| BookingMessage | One line on a booking: `id`, `reference`, `from` (`guest` or `property`), `kind` (`message`, `note`, `early-checkin`, `late-checkout`, `change`), `at`, `body`. |

## DataSource

`app/js/data-source.js` describes the methods. The guest app and the owner app both call `createGuestSource(new StaticDataSource())`, which is a `ChannelManagerAdapter` wrapped around the static feed.

- `getProperty()`
- `listRoomTypes()`
- `getRates({ from, to, roomTypeId })` returns `NightRate[]`
- `listBookings()`
- `listEnquiries()`
- `recordEnquiry(enquiry)`
- `describeConnection()`

`StaticDataSource` (`app/js/static-source.js`) implements them from `/prices.json` and `app/js/catalog.js`.

`ChannelManagerAdapter` (`app/js/channel-manager.js`) is what both apps call. Every read falls through to `StaticDataSource`. The methods marked `TODO(channel-manager)` are the plug-in points:

| Method | What to connect |
| --- | --- |
| `connect(credentials)` | API key, OAuth, or a secret iCal URL. Keep the secret on a server, not in this repository. |
| `listRoomTypes()` | Map the vendor’s room ids onto our eight ids. Do not rename our ids; the photos and the website use them. |
| `getRates()` | Replace the `prices.json` read with nightly rate and availability. An iCal feed can usually fill `available` only, not `amount`. The owner calendar and stats read this method’s data, via `summarise()`. |
| `pushRates(rates)` | Not used by the owner app. v1 does not edit rates. A later backend can push them if the vendor allows it. |
| `lookupBooking({ reference, who })` | Find one reservation. `who` is the surname or the email on the booking, compared without case. Return a GuestBooking or `null`. Do not return other guests' stays. |
| `listThreads({ role, reference, lang })` | Conversation list. `role: "guest"` returns only the booking in `reference`, or nothing if there is no booking. `role: "owner"` returns every demo booking. There is no pre-booking thread. Each row has `unread`, preview, dates, surname, and `writable` (`false` when the stay is cancelled). |
| `getThread(id, lang)` | One booking thread, or `null` if that reference is not a booking. Messages include `at`, `from` (`guest` or `property`), and `status` (`sent` or `read`). `writable` is false for a cancelled stay. |
| `sendMessage({ threadId, body, kind, lang, captchaToken })` | Guest message on a booking that is not cancelled. `kind` is `message`, `early-checkin`, `late-checkout`, `directions`, `luggage`, or `change`. Demo mode stores it, emails Web3Forms (`Booking REFERENCE — kind`), then appends an automatic test reply. A missing booking or a cancelled stay is refused. |
| `reply({ threadId, body })` | Property reply. No email. |
| `markRead(id, role)` | `role` is `guest` or `owner`. Marks the other side's messages `read`. The tick is the status word plus a check mark, not a colour. |
| `listInbox()` | Owner conversation list. Same rows as `listThreads({ role: "owner" })`. |
| `listMessages(reference, lang)` | The messages inside one thread. Kept so older calls still work. |
| `listBookings()` | Poll reservations, or accept a webhook and store `Booking` records. The Later tab is waiting on this for occupancy and revenue. Map cancellations to `cancelled`. |
| `recordEnquiry()` | Optional. After the guest email succeeds, create a lead in the channel manager. Mail must still work if this call fails. The owner occupancy, revenue, and enquiry figures would come from here and from `listBookings()`. |

Until those are filled in, the adapter reports `connected: false` and `mode: 'static'`.

## What we need from the channel manager

Ed does not yet know which product his brother uses. These are the things that product has to provide before the stub can be replaced. The owner app is ready to show bookings, occupancy, revenue, and enquiries once `listBookings()` returns real rows. Occupancy and revenue are derived from those bookings; they are not separate feeds.

1. **Product name and property id** in that system.
2. **How updates leave the system.** A real API, an iCal URL, a webhook, or some mix. iCal alone is not enough for prices.
3. **Authentication.** API key, OAuth client, or a secret calendar URL. Who can create it, and can it be limited to this property.
4. **Room mapping.** The id, name, and occupancy of each of the eight types on their side, matched to Standard Twin, Superior Twin, Deluxe Corner Twin, ECO Double, Standard Double, Superior Double, Family Twin, and Deluxe Family Twin.
5. **Rates.** A way to read the nightly price in KRW for a date range. Whether the price depends on the number of guests (the website currently uses one Booking.com price for 1–4 guests and only the capacity changes). Taxes, and whether the figure is the sell rate or the net rate.
6. **Availability.** Rooms left, and a closed / stop-sell flag, per room type per night. Minimum stay, closed-to-arrival, and closed-to-departure if they use them. The apps do not model those restrictions yet.
7. **Bookings.** A list or a webhook for new, modified, and cancelled reservations: external id, room type, check-in, check-out, guests, guest name, status, amount, currency. This is what fills occupancy and revenue.
8. **Webhook signing.** A secret and the signature header, plus retries. GitHub Pages cannot receive this. The endpoint has to live on the backend below.
9. **Write-back.** Whether anyone should push rates back. The owner app does not. v1 treats the channel manager, once connected, as the place prices change.
10. **Freshness.** How quickly a booking on Booking.com closes the room on their side, and whether the twice-daily `prices.json` job should stop once this is live.

### Questions to ask his brother

1. Which channel manager are you using, and what is the property called in it?
2. Can it give us an API key, or only an iCal link?
3. Does that feed include the nightly price in won, or only whether the room is open?
4. What are the eight room types called in that system?
5. When a room is booked, can it call a web address we give you, or do we have to ask it for new bookings?
6. Should an enquiry from the guest app be typed back into the channel manager, or is email enough?
7. Who should change prices: only the channel manager? This owner app does not edit them.
8. The website’s price file is replaced twice a day from Booking.com. Should that stop once the channel manager is connected?

1. 지금 쓰는 채널 매니저가 어떤 프로그램이고, 그 안에서 숙소 이름이 어떻게 되어 있나요?
2. API 키를 받을 수 있나요, 아니면 iCal 주소만 있나요?
3. 그 자료에 1박 요금(원)이 들어 있나요, 아니면 빈방인지 아닌지만 나오나요?
4. 여덟 가지 객실이 그 시스템에서는 각각 어떤 이름으로 되어 있나요?
5. 예약이 들어오면 우리가 알려 준 주소로 알려 주나요, 아니면 우리가 매번 조회해야 하나요?
6. 손님 앱으로 온 문의를 채널 매니저에도 넣어야 하나요, 아니면 이메일이면 충분한가요?
7. 요금은 채널 매니저에서만 바꾸나요? 운영 앱에서는 바꾸지 않습니다.
8. 웹사이트 요금 파일은 지금 Booking.com 기준으로 하루 두 번 덮어씁니다. 채널 매니저를 연결하면 그 작업을 멈출까요?

Real-time chat cannot live in these files. `localStorage` only shares the guest app and the owner app in one browser, and it is wiped if that browser clears site data. A live thread needs a backend both sides can reach: the channel manager’s messaging API, or a small store such as Supabase (or the Worker described below) with a row per message and a way to subscribe to new ones. GitHub Pages cannot hold that, and Web3Forms only sends email; it does not update the other screen.

## Why this cannot be the backend

GitHub Pages only serves files. It cannot keep a secret, sit on a webhook URL, or store bookings. The owner app is read-only for that reason.

## Next step, not built here

When the channel manager is known, add one small backend that both static apps can call. Do not stand up a new paid host as part of this site. A free-tier Cloudflare Worker, or a small process on a machine Ed already has, is enough if it can do four things:

1. `GET /v1/inventory` returns the normalised property, room types, and `NightRate` list these apps already understand. Swap `StaticDataSource` for an HTTP source and leave the screens alone. `summarise()` keeps working on that document.
2. `POST /v1/webhooks/channel` checks the vendor’s signature and stores bookings and availability. Pages cannot do this. The owner Later tab then fills bookings, occupancy, and revenue from `listBookings()`.
3. Replace the public passphrase with a real session if the figures become sensitive. Until then the gate only keeps the screens apart.
4. Retire the twice-daily `prices.json` overwrite once rates come from the channel manager. Keep the file only as a fallback until that cut-over is checked against a real week of bookings.

## Run both apps locally

From the folder that contains `index.html`, `app/`, and `owner/` (a downloaded branch zip is enough):

```powershell
python -m http.server 8099
```

Guest: http://localhost:8099/app/

Owner: http://localhost:8099/owner/

The passphrase is `melo-owner`. Do not open these from `file://`. The pages request `/prices.json` from the same host.
