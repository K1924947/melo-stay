// Stub for the hostel's channel manager.
// Ed will learn which product it is on his next trip to Korea.
// Until then every read falls through to StaticDataSource (prices.json).
//
// Plug-in points:
//   connect()             API key, OAuth, or a secret iCal URL
//   listRoomTypes()       map the vendor's room ids onto RoomType.id
//   getRates()            nightly rate + availability, API or parsed iCal
//   pushRates()           send owner edits back so the OTAs match
//   listBookings()        poll, or receive a webhook and store Booking[]
//   lookupBooking()       confirmation code + surname or email
//   listMessages()        thread on one booking
//   sendMessage()         guest message or a change request
//   listInbox()           messages the property can see
//   recordEnquiry()       optional: write a direct lead back into the vendor

import { DataSource } from './data-source.js';
import { DemoBookingsSource } from './bookings-source.js';

export class ChannelManagerAdapter extends DataSource {
  /**
   * @param {DataSource} fallback current implementation, used while nothing is connected
   */
  constructor(fallback) {
    super();
    this.fallback = fallback;
    this.connected = false;
    this.vendor = null;
    this.bookings = new DemoBookingsSource();
  }

  /**
   * TODO(channel-manager): when connected, say mode "channel-manager" and demo false.
   * Until then the guest app is on the fake TEST bookings.
   */
  async describeBookings() {
    if (this.connected) return { mode: 'channel-manager', demo: false };
    return this.bookings.describeBookings();
  }

  /**
   * TODO(channel-manager): look up a reservation by confirmation code plus
   * surname or email. Return the GuestBooking shape, or null.
   */
  async lookupBooking(query) {
    if (this.connected) throw new Error('Channel manager booking lookup is not connected.');
    return this.bookings.lookupBooking(query);
  }

  /**
   * TODO(channel-manager): conversation list. Guest passes their booking
   * reference; the property passes role "owner" and sees every thread.
   */
  async listThreads(query) {
    if (this.connected) return [];
    return this.bookings.listThreads(query);
  }

  /** TODO(channel-manager): one thread, including timestamps and read state. */
  async getThread(id, lang) {
    if (this.connected) throw new Error('Channel manager messages are not connected.');
    return this.bookings.getThread(id, lang);
  }

  async listMessages(reference, lang) {
    if (this.connected) throw new Error('Channel manager messages are not connected.');
    return this.bookings.listMessages(reference, lang);
  }

  /**
   * TODO(channel-manager): post the guest message into the reservation thread
   * and push it to the property in real time. Demo mode stores it in
   * localStorage, adds an automatic test reply, and emails Web3Forms.
   */
  async sendMessage(input) {
    if (this.connected) throw new Error('Channel manager messages are not connected.');
    return this.bookings.sendMessage(input);
  }

  /** TODO(channel-manager): property reply on a thread. */
  async reply(input) {
    if (this.connected) throw new Error('Channel manager messages are not connected.');
    return this.bookings.reply(input);
  }

  /** TODO(channel-manager): mark the other side's messages read. role is guest or owner. */
  async markRead(id, role) {
    if (this.connected) return null;
    return this.bookings.markRead(id, role);
  }

  /** TODO(channel-manager): inbox of threads for the owner app. */
  async listInbox() {
    if (this.connected) return [];
    return this.bookings.listInbox();
  }

  /**
   * TODO(channel-manager): authenticate.
   * API: store the key in the operator's session only, never in the repo,
   *      never in localStorage, and never in prices.json.
   * iCal: a secret https URL per room type is enough for availability,
   *       and usually carries no prices.
   * The GitHub Pages site cannot hide this secret. A real connection
   * needs the backend described in docs/INTEGRATION.md.
   */
  async connect(_credentials) {
    throw new Error('No channel manager is connected yet.');
  }

  async getProperty() {
    return this.fallback.getProperty();
  }

  async listRoomTypes() {
    // TODO(channel-manager): when connected, overlay the vendor's room ids
    // and stop-sell flags onto the catalogue. Keep our eight ids stable.
    return this.fallback.listRoomTypes();
  }

  async getRates(query) {
    // TODO(channel-manager): when connected, return NightRate[] from the
    // vendor instead of prices.json. Prefer a webhook-triggered refresh
    // over polling. iCal can fill `available` but not `amount`.
    return this.fallback.getRates(query);
  }

  /**
   * TODO(channel-manager): push rate and availability edits.
   * Expected shape is NightRate[]. The vendor call is whatever their
   * API documents (often PUT /rates and PUT /availability, or one
   * ARI message). Do not commit those edits to prices.json once this
   * works: the twice-daily job would overwrite them.
   */
  async pushRates(_rates) {
    throw new Error('Channel manager rate push is not connected.');
  }

  async listBookings() {
    // TODO(channel-manager): return Booking[] from a webhook inbox or a
    // reservations poll. Map cancellations to status "cancelled".
    // GitHub Pages cannot receive the webhook; the future backend can.
    return [];
  }

  async listEnquiries() {
    return this.fallback.listEnquiries();
  }

  async recordEnquiry(enquiry) {
    // TODO(channel-manager): after the email send succeeds, optionally
    // create a lead or a pencil booking in the channel manager so the
    // room is held. Direct mail must keep working if this call fails.
    return this.fallback.recordEnquiry(enquiry);
  }

  async describeConnection() {
    if (!this.connected) {
      return {
        connected: false,
        mode: 'static',
        detail: 'Channel manager not connected. Rates come from /prices.json.',
      };
    }
    return {
      connected: true,
      mode: 'channel-manager',
      detail: this.vendor || 'Connected',
    };
  }
}

export function createGuestSource(staticSource) {
  return new ChannelManagerAdapter(staticSource);
}
