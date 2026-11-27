// Static property and room catalogue. Copy is the same text as index.html.
import { ROOM_CODES } from './schema.js';

export const PROPERTY = {
  id: 'melo-stay-seoul',
  name: 'melo stay',
  timezone: 'Asia/Seoul',
  currency: 'KRW',
  roomCount: 24,
  checkIn: '15:00',
  checkInUntil: '22:00',
  checkOut: '11:00',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Melo%20Stay%20325%20Jong-ro%20Jongno-gu%20Seoul',
  contact: {
    email: 'melostayseoul@gmail.com',
    phone: '+82-10-4093-8977',
    phoneHref: 'tel:+821040938977',
  },
  channels: [
    { id: 'booking', name: 'Booking.com', url: 'https://www.booking.com/Share-TuDoV9h' },
    { id: 'trip', name: 'Trip.com', url: 'https://www.trip.com/w/1slD11jXSW2' },
    { id: 'agoda', name: 'Agoda', url: 'https://www.agoda.com/melo-stay-seoul-h96011950/hotel/seoul-kr.html' },
  ],
  enquiry: {
    action: 'https://api.web3forms.com/submit',
    accessKey: '472101d0-52b1-4194-8914-5f1c5a3aef70',
    subject: 'New enquiry from melo stay website',
  },
};

export const GROUPS = [
  { id: 'twin', titleKey: 'group_twin_h', subKey: 'group_twin_s', ids: ['str', 'suptr', 'dctr'] },
  { id: 'double', titleKey: 'group_double_h', subKey: 'group_double_s', ids: ['edr', 'sdr', 'supdr'] },
  { id: 'family', titleKey: 'group_family_h', subKey: 'group_family_s', ids: ['ftr', 'dftr'] },
];

export const ROOM_LIST = [
  {
    "id": "str",
    "code": "Standard Twin",
    "folder": "str",
    "group": "twin",
    "capacity": 2,
    "photos": 7,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Standard Twin",
        "tier": "Standard",
        "sub": "Two beds · Private bathroom",
        "card": "Two beds and a private bathroom.",
        "description": "Two single beds and a private ensuite bathroom, in a compact room.",
        "description2": "Wall-mounted air conditioning and TV, a small desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~10 m²",
        "beds": "2 single beds"
      },
      "zh": {
        "name": "标准双床房",
        "tier": "标准",
        "sub": "两张床 · 独立卫浴",
        "card": "两张床，独立卫浴。",
        "description": "两张单人床与独立卫浴，空间紧凑。",
        "description2": "壁挂式空调和电视、小书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约10平方米",
        "beds": "2张单人床"
      },
      "ko": {
        "name": "스탠다드 트윈",
        "tier": "스탠다드",
        "sub": "침대 2개 · 개인 욕실",
        "card": "침대 2개와 개인 욕실.",
        "description": "싱글 침대 2개와 전용 욕실을 갖춘, 아담한 객실입니다.",
        "description2": "벽걸이형 에어컨과 TV, 작은 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 10㎡",
        "beds": "싱글베드 2개"
      },
      "ja": {
        "name": "スタンダードツイン",
        "tier": "スタンダード",
        "sub": "ベッド2台 · 専用バスルーム",
        "card": "ベッド2台と専用バスルーム。",
        "description": "シングルベッド2台と専用バスルームを備えた、コンパクトな客室です。",
        "description2": "壁掛けのエアコンとテレビ、小さなデスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約10㎡",
        "beds": "シングルベッド2台"
      }
    }
  },
  {
    "id": "suptr",
    "code": "Superior Twin",
    "folder": "suptr",
    "group": "twin",
    "capacity": 2,
    "photos": 7,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Superior Twin",
        "tier": "Superior",
        "sub": "Two beds · Private bathroom",
        "card": "The same twin layout as Standard, with a finer finish.",
        "description": "The same twin layout as the Standard, with a finer finish.",
        "description2": "Wall-mounted air conditioning and TV, a small desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~12 m²",
        "beds": "2 single beds"
      },
      "zh": {
        "name": "高级双床房",
        "tier": "高级",
        "sub": "两张床 · 独立卫浴",
        "card": "与标准双床房布局相同，细节更为细致。",
        "description": "与标准双床房布局相同，细节更为细致。",
        "description2": "壁挂式空调和电视、小书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约12平方米",
        "beds": "2张单人床"
      },
      "ko": {
        "name": "슈페리어 트윈",
        "tier": "슈페리어",
        "sub": "침대 2개 · 개인 욕실",
        "card": "스탠다드 트윈과 같은 구조에, 마감을 조금 더 신경 쓴 객실입니다.",
        "description": "스탠다드 트윈과 같은 구조에, 마감을 조금 더 신경 쓴 객실입니다.",
        "description2": "벽걸이형 에어컨과 TV, 작은 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 12㎡",
        "beds": "싱글베드 2개"
      },
      "ja": {
        "name": "スーペリアツイン",
        "tier": "スーペリア",
        "sub": "ベッド2台 · 専用バスルーム",
        "card": "スタンダードツインと同じ間取りで、仕上げをより丁寧にしています。",
        "description": "スタンダードツインと同じ間取りで、仕上げをより丁寧にしています。",
        "description2": "壁掛けのエアコンとテレビ、小さなデスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約12㎡",
        "beds": "シングルベッド2台"
      }
    }
  },
  {
    "id": "dctr",
    "code": "Deluxe Corner Twin",
    "folder": "dctr",
    "group": "twin",
    "capacity": 2,
    "photos": 11,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Deluxe Corner Twin",
        "tier": "Deluxe",
        "sub": "Two beds · Corner position · Private bathroom",
        "card": "A corner twin room, with more natural light.",
        "description": "A corner twin room, arranged for more natural light.",
        "description2": "Wall-mounted air conditioning and TV, a small desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~10 m²",
        "beds": "2 single beds"
      },
      "zh": {
        "name": "豪华转角双床房",
        "tier": "豪华",
        "sub": "两张床 · 转角位置 · 独立卫浴",
        "card": "转角双床房，自然光线更充足。",
        "description": "转角位置的双床房，自然光线更充足。",
        "description2": "壁挂式空调和电视、小书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约10平方米",
        "beds": "2张单人床"
      },
      "ko": {
        "name": "디럭스 코너 트윈",
        "tier": "디럭스",
        "sub": "침대 2개 · 코너 위치 · 개인 욕실",
        "card": "코너에 자리한 트윈룸으로, 자연광이 잘 들어옵니다.",
        "description": "코너에 자리한 트윈룸으로, 자연광이 잘 들어옵니다.",
        "description2": "벽걸이형 에어컨과 TV, 작은 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 10㎡",
        "beds": "싱글베드 2개"
      },
      "ja": {
        "name": "デラックスコーナーツイン",
        "tier": "デラックス",
        "sub": "ベッド2台 · 角部屋 · 専用バスルーム",
        "card": "角部屋のツインルームで、自然光が入りやすい位置です。",
        "description": "角部屋のツインルームで、自然光が入りやすい位置にあります。",
        "description2": "壁掛けのエアコンとテレビ、小さなデスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約10㎡",
        "beds": "シングルベッド2台"
      }
    }
  },
  {
    "id": "edr",
    "code": "ECO Double",
    "folder": "edr",
    "group": "double",
    "capacity": 2,
    "photos": 4,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "ECO Double",
        "tier": "Economy",
        "sub": "One bed · Private bathroom",
        "card": "The most compact room, with one bed and a private bathroom.",
        "description": "The most compact room, with one double bed and a private ensuite bathroom.",
        "description2": "Wall-mounted air conditioning and TV, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~9 m²",
        "beds": "1 double bed"
      },
      "zh": {
        "name": "经济大床房",
        "tier": "经济",
        "sub": "一张床 · 独立卫浴",
        "card": "最紧凑的房型，一张床，独立卫浴。",
        "description": "最紧凑的房型，一张双人床与独立卫浴。",
        "description2": "壁挂式空调和电视、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约9平方米",
        "beds": "1张大床"
      },
      "ko": {
        "name": "이코노미 더블",
        "tier": "이코노미",
        "sub": "침대 1개 · 개인 욕실",
        "card": "가장 작은 객실로, 침대 1개와 개인 욕실이 있습니다.",
        "description": "가장 작은 객실로, 더블베드 1개와 전용 욕실이 있습니다.",
        "description2": "벽걸이형 에어컨과 TV, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 9㎡",
        "beds": "더블베드 1개"
      },
      "ja": {
        "name": "エコノミーダブル",
        "tier": "エコノミー",
        "sub": "ベッド1台 · 専用バスルーム",
        "card": "もっともコンパクトな客室です。ベッド1台と専用バスルーム。",
        "description": "もっともコンパクトな客室です。ダブルベッド1台と専用バスルームを備えています。",
        "description2": "壁掛けのエアコンとテレビ、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約9㎡",
        "beds": "ダブルベッド1台"
      }
    }
  },
  {
    "id": "sdr",
    "code": "Standard Double",
    "folder": "sdr",
    "group": "double",
    "capacity": 2,
    "photos": 10,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Standard Double",
        "tier": "Standard",
        "sub": "One bed · Private bathroom",
        "card": "One bed and a private bathroom.",
        "description": "One double bed and a private ensuite bathroom, for one or two guests.",
        "description2": "Wall-mounted air conditioning and TV, a small desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~12 m²",
        "beds": "1 double bed"
      },
      "zh": {
        "name": "标准大床房",
        "tier": "标准",
        "sub": "一张床 · 独立卫浴",
        "card": "一张床，独立卫浴。",
        "description": "一张双人床与独立卫浴，可供一位或两位客人入住。",
        "description2": "壁挂式空调和电视、小书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约12平方米",
        "beds": "1张大床"
      },
      "ko": {
        "name": "스탠다드 더블",
        "tier": "스탠다드",
        "sub": "침대 1개 · 개인 욕실",
        "card": "침대 1개와 개인 욕실.",
        "description": "더블베드 1개와 전용 욕실을 갖춘 객실로, 1인 또는 2인 투숙에 적합합니다.",
        "description2": "벽걸이형 에어컨과 TV, 작은 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 12㎡",
        "beds": "더블베드 1개"
      },
      "ja": {
        "name": "スタンダードダブル",
        "tier": "スタンダード",
        "sub": "ベッド1台 · 専用バスルーム",
        "card": "ベッド1台と専用バスルーム。",
        "description": "ダブルベッド1台と専用バスルームを備えた客室です。お一人またはお二人でのご滞在に。",
        "description2": "壁掛けのエアコンとテレビ、小さなデスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約12㎡",
        "beds": "ダブルベッド1台"
      }
    }
  },
  {
    "id": "supdr",
    "code": "Superior Double",
    "folder": "supdr",
    "group": "double",
    "capacity": 2,
    "photos": 8,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Superior Double",
        "tier": "Superior",
        "sub": "One bed · Private bathroom",
        "card": "The same layout as the Standard Double, with a finer finish.",
        "description": "The same layout as the Standard Double, with a finer finish.",
        "description2": "Wall-mounted air conditioning and TV, a small desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~12 m²",
        "beds": "1 double bed"
      },
      "zh": {
        "name": "高级大床房",
        "tier": "高级",
        "sub": "一张床 · 独立卫浴",
        "card": "与标准大床房布局相同，细节更为细致。",
        "description": "与标准大床房布局相同，细节更为细致。",
        "description2": "壁挂式空调和电视、小书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约12平方米",
        "beds": "1张大床"
      },
      "ko": {
        "name": "슈페리어 더블",
        "tier": "슈페리어",
        "sub": "침대 1개 · 개인 욕실",
        "card": "스탠다드 더블과 같은 구조에, 마감을 조금 더 신경 쓴 객실입니다.",
        "description": "스탠다드 더블과 같은 구조에, 마감을 조금 더 신경 쓴 객실입니다.",
        "description2": "벽걸이형 에어컨과 TV, 작은 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 12㎡",
        "beds": "더블베드 1개"
      },
      "ja": {
        "name": "スーペリアダブル",
        "tier": "スーペリア",
        "sub": "ベッド1台 · 専用バスルーム",
        "card": "スタンダードダブルと同じ間取りで、仕上げをより丁寧にしています。",
        "description": "スタンダードダブルと同じ間取りで、仕上げをより丁寧にしています。",
        "description2": "壁掛けのエアコンとテレビ、小さなデスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約12㎡",
        "beds": "ダブルベッド1台"
      }
    }
  },
  {
    "id": "ftr",
    "code": "Family Twin",
    "folder": "ftr",
    "group": "family",
    "capacity": 4,
    "photos": 12,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Family Twin",
        "tier": "Family",
        "sub": "Two double beds · Private bathroom",
        "card": "Two double beds, for families or small groups.",
        "description": "Two double beds, with more space for families or small groups.",
        "description2": "Wall-mounted air conditioning and TV, a desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~17 m²",
        "beds": "2 double beds"
      },
      "zh": {
        "name": "家庭双床房",
        "tier": "家庭",
        "sub": "两张双人床 · 独立卫浴",
        "card": "两张双人床，适合家庭或同行小团体。",
        "description": "两张双人床，为家庭或同行小团体提供更宽敞的空间。",
        "description2": "壁挂式空调和电视、书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约17平方米",
        "beds": "2张大床"
      },
      "ko": {
        "name": "패밀리 트윈",
        "tier": "패밀리",
        "sub": "더블베드 2개 · 개인 욕실",
        "card": "더블베드 2개. 가족이나 소규모 그룹에 적합합니다.",
        "description": "더블베드 2개를 갖춘 객실로, 가족이나 소규모 그룹이 머물기에 공간이 더 여유롭습니다.",
        "description2": "벽걸이형 에어컨과 TV, 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 17㎡",
        "beds": "더블베드 2개"
      },
      "ja": {
        "name": "ファミリーツイン",
        "tier": "ファミリー",
        "sub": "ダブルベッド2台 · 専用バスルーム",
        "card": "ダブルベッド2台。ご家族や少人数のグループ向けです。",
        "description": "ダブルベッド2台を備え、ご家族や少人数のグループに適した広さです。",
        "description2": "壁掛けのエアコンとテレビ、デスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約17㎡",
        "beds": "ダブルベッド2台"
      }
    }
  },
  {
    "id": "dftr",
    "code": "Deluxe Family Twin",
    "folder": "dftr",
    "group": "family",
    "capacity": 4,
    "photos": 13,
    "amenities": [
      "fact_desk",
      "fact_fridge",
      "fact_ac",
      "fact_tv"
    ],
    "copy": {
      "en": {
        "name": "Deluxe Family Twin",
        "tier": "Deluxe",
        "sub": "Two double beds · Private bathroom",
        "card": "The largest room, with two double beds.",
        "description": "The largest room, with two double beds.",
        "description2": "Wall-mounted air conditioning and TV, a desk and stool, a mini-fridge, and a frosted-glass bathroom door.",
        "size": "~18 m²",
        "beds": "2 double beds"
      },
      "zh": {
        "name": "豪华家庭双床房",
        "tier": "豪华",
        "sub": "两张双人床 · 独立卫浴",
        "card": "最大房型，两张双人床。",
        "description": "最大的房型，配有两张双人床。",
        "description2": "壁挂式空调和电视、书桌与凳子、迷你冰箱，以及磨砂玻璃卫浴门。",
        "size": "约18平方米",
        "beds": "2张大床"
      },
      "ko": {
        "name": "디럭스 패밀리 트윈",
        "tier": "디럭스",
        "sub": "더블베드 2개 · 개인 욕실",
        "card": "가장 넓은 객실로, 더블베드가 2개 있습니다.",
        "description": "가장 넓은 객실로, 더블베드가 2개 있습니다.",
        "description2": "벽걸이형 에어컨과 TV, 책상과 스툴, 미니냉장고, 간유리 처리된 욕실 문.",
        "size": "약 18㎡",
        "beds": "더블베드 2개"
      },
      "ja": {
        "name": "デラックスファミリーツイン",
        "tier": "デラックス",
        "sub": "ダブルベッド2台 · 専用バスルーム",
        "card": "最も広い客室で、ダブルベッドが2台あります。",
        "description": "最も広い客室で、ダブルベッドが2台あります。",
        "description2": "壁掛けのエアコンとテレビ、デスクとスツール、ミニ冷蔵庫、フロストガラスのバスルームドア。",
        "size": "約18㎡",
        "beds": "ダブルベッド2台"
      }
    }
  }
];

export const ROOMS_BY_ID = Object.fromEntries(ROOM_LIST.map((room) => [room.id, room]));

export function roomPhotos(room) {
  const urls = [];
  for (let i = 1; i <= room.photos; i += 1) {
    urls.push('/images/rooms/' + room.folder + '/' + i + '.jpg');
  }
  return urls;
}

const codes = ROOM_LIST.map((room) => room.code);
if (codes.join('|') !== ROOM_CODES.join('|')) {
  throw new Error('Room codes drifted from schema.js');
}
