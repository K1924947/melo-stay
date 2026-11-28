// Date helpers match index.html: calendar dates are local, not UTC,
// and money is grouped the same way as the website.

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

export function parseISODate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

export function addDays(date, count) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

export function addDaysISO(iso, count) {
  const date = parseISODate(iso);
  if (!date) return '';
  return toISODate(addDays(date, count));
}

export function todayISO() {
  return toISODate(new Date());
}

export function seoulTodayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Nights occupied: check-in inclusive, check-out exclusive. */
export function enumerateNights(checkin, checkout) {
  const start = parseISODate(checkin);
  const end = parseISODate(checkout);
  if (!start || !end || end <= start) return [];
  const nights = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
    nights.push(toISODate(cursor));
  }
  return nights;
}

export function formatDisplayDate(iso, lang) {
  const date = parseISODate(iso);
  if (!date) return iso || '';
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (lang === 'zh' || lang === 'ja') return year + '年' + month + '月' + day + '日';
  if (lang === 'ko') return year + '년 ' + month + '월 ' + day + '일';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return day + ' ' + months[date.getMonth()] + ' ' + year;
}

export function formatKrw(amount) {
  return '₩' + Math.round(Number(amount)).toLocaleString('en-US');
}

export function nightsLabel(count, t) {
  if (count === 1) return t('dates_1_night');
  if (count > 1) return t('dates_nights', { n: String(count) });
  return '';
}
