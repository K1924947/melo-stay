// DataSource is the only way the screens read inventory.
// StaticDataSource implements it from prices.json and the room catalogue.
// ChannelManagerAdapter implements it by delegating, until a real
// channel manager is plugged into the methods marked TODO.

export class DataSource {
  /** @returns {Promise<import('./schema.js').Property>} */
  async getProperty() {
    throw new Error('DataSource.getProperty is not implemented');
  }

  /** @returns {Promise<import('./schema.js').RoomType[]>} */
  async listRoomTypes() {
    throw new Error('DataSource.listRoomTypes is not implemented');
  }

  /**
   * @param {{from?: string, to?: string, roomTypeId?: string}} [_query]
   * @returns {Promise<import('./schema.js').NightRate[]>}
   */
  async getRates(_query) {
    throw new Error('DataSource.getRates is not implemented');
  }

  /** @returns {Promise<import('./schema.js').Booking[]>} */
  async listBookings() {
    throw new Error('DataSource.listBookings is not implemented');
  }

  /** @returns {Promise<import('./schema.js').Enquiry[]>} */
  async listEnquiries() {
    throw new Error('DataSource.listEnquiries is not implemented');
  }

  /**
   * @param {import('./schema.js').Enquiry} _enquiry
   * @returns {Promise<import('./schema.js').Enquiry>}
   */
  async recordEnquiry(_enquiry) {
    throw new Error('DataSource.recordEnquiry is not implemented');
  }

  /**
   * What is actually feeding this source. The owner screen shows this in words.
   * @returns {Promise<{connected: boolean, mode: string, detail: string}>}
   */
  async describeConnection() {
    return { connected: false, mode: 'none', detail: 'No data source is connected.' };
  }
}
