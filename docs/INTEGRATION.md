# Channel manager integration

melo stay’s public site stays a static GitHub Pages site: `index.html`, `prices.json`, `images/`, and `CNAME`. The guest and owner app lives at `/app/` and does not replace that site.

An outside job overwrites `prices.json` twice a day. The app reads that file. It does not change the file’s shape.

## What v1 does

- Guests look at rooms, prices, an enquiry form, and practical info. Enquiry mail goes through the same Web3Forms form as the website (`melostayseoul@gmail.com`, `+82-10-4093-8977`).
- Prices use the same rules as `index.html`. With `discount_pct` at 0, the guest sees the Booking.com amount and no strikethrough. A `null` room is unavailable. Dates outside the file are not treated as sold; the guest is asked to enquire.
- The owner screens (`/app/#owner` or `/app/owner/`) can edit room text, nightly prices, and availability in this browser. Nothing is published until he downloads a JSON file or commits it with a GitHub token he types in himself.
- There is no channel manager yet. `ChannelManagerAdapter` forwards reads to `StaticDataSource` and leaves the write paths unimplemented.

## What the light gate does not do

The owner passphrase is `melo-owner`. It is written in `app/js/owner.js` and on the gate screen.

That only keeps the guest tabs and the owner screens apart. It is not a login. Anyone who can read the repository, the app’s JavaScript, or this document can open the owner screens. It does not hide prices, block a request, or protect bookings. There is no server checking it.

A GitHub token typed into the export screen is sent only to `api.github.com` for that commit. It is not written into the repository, `localStorage`, or `prices.json`. Closing the page drops it. The token can change `main` with whatever rights it has, so it should not be entered on a shared computer. Publishing `prices.json` this way also loses to the twice-daily overwrite.

## prices.json, left alone

The outside job should keep writing this shape. The website and the app both understand it. Do not add required fields, and do not rename the room keys.

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

- `null` means that room is unavailable that night. A missing night (no key for the date) means the feed does not cover it.
- `ota_krw` is the Booking.com price in won. `left` is how many rooms the feed says are left, or `null` if the count is unknown. A count of 0 does not by itself close the night; an empty price does.
- `rooms.<name>.enquire_only` makes the guest app ask for a rate even when a number is present. ECO Double is marked that way today. The app does not hard-code that room.
- `discount_pct` is the direct-booking reduction. At 0 the price is shown as-is. The website’s formula, which the app copies, is: no discount means `Math.round(ota)`; a discount means `Math.floor(ota * (1 - pct/100) / 1000) * 1000`, and only then is the Booking.com figure struck through.
- Every night should list all eight names: Standard Twin, Superior Twin, Deluxe Corner Twin, ECO Double, Standard Double, Superior Double, Family Twin, Deluxe Family Twin.

Room descriptions are not in this file. Owner edits to the words are a separate document, `app/data/room-overrides.json`, which the twice-daily job does not touch. The app loads it when it is present and ignores a 404.

## Normalised schema

`app/js/schema.js` is the shape the screens and a future channel manager share. `prices.json` is only the current feed.

| Thing | Meaning |
| --- | --- |
| Property | The hostel: timezone `Asia/Seoul`, currency KRW, 24 private rooms, check-in 15:00–22:00, check-out 11:00, contact and OTA links. |
| RoomType | One of the eight types. `id` is the short website id (`str`, `suptr`, …). `code` is the `prices.json` name. `capacity` is 4 for the two family types and 2 for the others, matching the website. |
| NightRate | One type on one stay-night. `amount` is the Booking.com figure or `null`. `known: false` means the date is outside the feed. `available` is true only when `known` and `amount` is a number. `unitsLeft` is the `left` count. `enquireOnly` is the room-level flag. |
| Enquiry | A direct question from the app. v1 sends it by email. It is not a booking. |
| Booking | A reservation from a channel manager: channel, external id, room type, stay, guests, status (`confirmed`, `cancelled`, `pending`), amount. v1 has none. |

## DataSource

`app/js/data-source.js` describes the methods:

- `getProperty()`
- `listRoomTypes()`
- `getRates({ from, to, roomTypeId })` returns `NightRate[]`
- `listBookings()`
- `listEnquiries()`
- `recordEnquiry(enquiry)`
- `describeConnection()`

`StaticDataSource` (`app/js/static-source.js`) implements them from `/prices.json` and `app/js/catalog.js`. The service worker fetches `prices.json` network-first and falls back to the last copy if the network fails.

`ChannelManagerAdapter` (`app/js/channel-manager.js`) is what the guest app actually calls. Every read falls through to `StaticDataSource`. The methods marked `TODO(channel-manager)` are the plug-in points:

| Method | What to connect |
| --- | --- |
| `connect(credentials)` | API key, OAuth, or a secret iCal URL. Keep the secret in memory for the session. Do not commit it. |
| `listRoomTypes()` | Map the vendor’s room ids onto our eight ids. Do not rename our ids; the photos and the website use them. |
| `getRates()` | Replace the `prices.json` read with nightly rate and availability. An iCal feed can usually fill `available` only, not `amount`. |
| `pushRates(rates)` | Send owner edits back so Booking.com, Trip.com, and Agoda stay in step. Often this is a rates call plus an availability or stop-sell call. |
| `listBookings()` | Poll reservations, or accept a webhook and store `Booking` records. Map cancellations to `cancelled`. |
| `recordEnquiry()` | Optional. After the email succeeds, create a lead in the channel manager. Mail must still work if this fails. |

Until those are filled in, the adapter reports `connected: false` and `mode: 'static'`.

## What we need from the channel manager

Ed does not yet know which product his brother uses. These are the things that product has to provide before the stub can be replaced.

1. **Product name and property id** in that system.
2. **How updates leave the system.** A real API, an iCal URL, a webhook, or some mix. iCal alone is not enough for prices.
3. **Authentication.** API key, OAuth client, or a secret calendar URL. Who can create it, and can it be limited to this property.
4. **Room mapping.** The id, name, and occupancy of each of the eight types on their side, matched to Standard Twin, Superior Twin, Deluxe Corner Twin, ECO Double, Standard Double, Superior Double, Family Twin, and Deluxe Family Twin.
5. **Rates.** A way to read the nightly price in KRW for a date range. Whether the price depends on the number of guests (the website currently uses one Booking.com price for 1–4 guests and only the capacity changes). Taxes, and whether the figure is the sell rate or the net rate.
6. **Availability.** Rooms left, and a closed / stop-sell flag, per room type per night. Minimum stay, closed-to-arrival, and closed-to-departure if they use them. The app does not model those restrictions yet.
7. **Bookings.** A list or a webhook for new, modified, and cancelled reservations: external id, room type, check-in, check-out, guests, guest name, status, amount, currency.
8. **Webhook signing.** A secret and the signature header, plus retries. GitHub Pages cannot receive this. The endpoint has to live on the backend below.
9. **Write-back.** Whether we are allowed to push rates and availability, or the channel manager is the only place prices change. Whether a direct enquiry should be written back as a hold.
10. **Freshness.** How quickly a booking on Booking.com closes the room on their side, and whether the twice-daily `prices.json` job should stop once this is live.

### Questions to ask his brother

English, then the same questions in Korean so they can be asked in the room.

1. Which channel manager are you using, and what is the property called in it?
2. Can it give us an API key, or only an iCal link?
3. Does that feed include the nightly price in won, or only whether the room is open?
4. What are the eight room types called in that system?
5. When a room is booked, can it call a web address we give you, or do we have to ask it for new bookings?
6. Should an enquiry from this app be typed back into the channel manager, or is email enough?
7. Who should change prices: only the channel manager, or also this owner screen?
8. The website’s price file is replaced twice a day from Booking.com. Should that stop once the channel manager is connected?

1. 지금 쓰는 채널 매니저가 어떤 프로그램이고, 그 안에서 숙소 이름이 어떻게 되어 있나요?
2. API 키를 받을 수 있나요, 아니면 iCal 주소만 있나요?
3. 그 자료에 1박 요금(원)이 들어 있나요, 아니면 빈방인지 아닌지만 나오나요?
4. 여덟 가지 객실이 그 시스템에서는 각각 어떤 이름으로 되어 있나요?
5. 예약이 들어오면 우리가 알려 준 주소로 알려 주나요, 아니면 우리가 매번 조회해야 하나요?
6. 이 앱으로 온 문의를 채널 매니저에도 넣어야 하나요, 아니면 이메일이면 충분한가요?
7. 요금은 채널 매니저에서만 바꾸나요, 아니면 이 운영 화면에서도 바꾸나요?
8. 웹사이트 요금 파일은 지금 Booking.com 기준으로 하루 두 번 덮어씁니다. 채널 매니저를 연결하면 그 작업을 멈출까요?

## Why this cannot be the backend

GitHub Pages only serves files. It cannot keep a secret, sit on a webhook URL, or store bookings. A token in the browser can commit a file, but that commit is public in git history, and the price job will overwrite `prices.json` on its next run. Owner drafts in the browser disappear if he changes phones.

So v1’s publish step is a download, or a manual GitHub commit, not a live inventory.

## Next step, not built here

When the channel manager is known, add one small backend that the static app can call. Do not stand up a new paid host as part of this site. A free-tier Cloudflare Worker, or a small process on a machine Ed already has, is enough if it can do four things:

1. `GET /v1/inventory` returns the normalised property, room types, and `NightRate` list this app already understands. The guest app swaps `StaticDataSource` for an HTTP source and leaves the screens alone.
2. `POST /v1/webhooks/channel` checks the vendor’s signature and stores bookings and availability. Pages cannot do this.
3. Owner edits go to that service with a real session, replacing the public passphrase. Rate pushes go to the channel manager from the server, not from the browser.
4. Retire the twice-daily `prices.json` overwrite once rates come from the channel manager. Keep the file only as a fallback until that cut-over is checked against a real week of bookings.

Room copy can stay in git (`app/data/room-overrides.json`) even after that. It changes rarely and the price job does not touch it.
