export const CATEGORIES = {
  food: 'food',
  transport: 'transport',
  entertainment: 'entertainment',
  subscriptions: 'subscriptions',
  shopping: 'shopping',
  bigPurchases: 'bigPurchases',
  savings: 'savings',
  studentLoans: 'studentLoans',
  other: 'other',
}

export const CATEGORY_META = {
  food: { label: 'Food', color: '#fb923c', icon: '🍔' },
  transport: { label: 'Transport', color: '#38bdf8', icon: '🚗' },
  entertainment: { label: 'Entertainment', color: '#c084fc', icon: '🎬' },
  subscriptions: { label: 'Subscriptions', color: '#818cf8', icon: '📱' },
  shopping: { label: 'Shopping', color: '#f472b6', icon: '🛍️' },
  bigPurchases: { label: 'Big Purchases', color: '#fbbf24', icon: '✈️' },
  savings: { label: 'Savings', color: '#34d399', icon: '💰' },
  studentLoans: { label: 'Student Loans', color: '#60a5fa', icon: '🎓' },
  other: { label: 'Other', color: '#94a3b8', icon: '📝' },
}

const KEYWORD_MAP = {
  food: [
    'restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonalds', 'chipotle', 'subway',
    'pizza', 'sushi', 'thai', 'burger', 'doordash', 'ubereats', 'grubhub', 'instacart',
    'whole foods', 'trader joe', 'safeway', 'kroger', 'publix', 'wegmans', 'aldi',
    'walmart grocery', 'costco food', 'bakery', 'deli', 'taco', 'panda', 'kfc',
    'chick-fil-a', 'wendy', 'dunkin', 'tim horton', 'panera', 'domino', 'papa john',
    'food', 'dining', 'eat', 'lunch', 'dinner', 'breakfast', 'brunch',
    'supermarket', 'supermar', 'supercenter', 'grocery', 'market',
    'indian', 'desi', 'ethnic grocery',
  ],
  transport: [
    'uber', 'lyft', 'taxi', 'metro', 'mta', 'bart', 'cta', 'amtrak',
    'greyhound', 'gas station', 'shell', 'chevron', 'bp', 'exxon', 'mobil', 'citgo',
    'sunoco', 'marathon', 'speedway', 'pilot', 'flying j', 'parking', 'toll', 'e-zpass',
    'fastrak', 'autozone', 'advance auto', 'jiffy lube', 'midas', 'firestone', 'ntb',
    'enterprise', 'hertz', 'avis', 'budget car', 'zipcar', 'bird', 'lime scooter',
    'transit', 'train', 'bus', 'airline',
  ],
  entertainment: [
    'cinema', 'movie', 'theater', 'concert', 'ticketmaster', 'stubhub', 'eventbrite',
    'bar ', 'nightclub', 'club ', 'bowling', 'mini golf', 'arcade',
    'steam', 'playstation', 'xbox', 'nintendo', 'epic games',
    'twitch', 'book', 'kindle', 'audible', 'masterclass', 'coursera', 'udemy',
    'gym', 'fitness', 'planet fitness', 'anytime fitness', 'crossfit', 'yoga', 'peloton',
  ],
  subscriptions: [
    'netflix', 'spotify', 'hulu', 'disney+', 'disney plus', 'apple tv', 'apple one',
    'hbo', 'max ', 'amazon prime', 'youtube premium', 'youtube music',
    'paramount', 'peacock', 'crunchyroll', 'funimation', 'showtime',
    'adobe', 'microsoft 365', 'office 365', 'google one', 'icloud',
    'dropbox', 'notion', 'figma', 'github', 'chatgpt', 'openai',
    'subscription', 'monthly plan', 'annual plan', 'membership',
    'ovh', 'digitalocean', 'linode', 'vultr', 'cloudflare', 'hosting',
    'active n fit', 'activefit', 'silver sneakers', 'fit direct',
    'anthropic', 'claude',
  ],
  shopping: [
    'amazon', 'target', 'walmart', 'best buy', 'apple store', 'ikea', 'h&m', 'zara',
    'gap', 'old navy', 'uniqlo', 'nordstrom', 'macy', 'kohls', 'tj maxx', 'marshalls',
    'ross', 'homegoods', 'bed bath', 'home depot', 'lowes', 'wayfair', 'etsy',
    'ebay', 'shein', 'fashion', 'clothing', 'shoes', 'sneaker', 'nike', 'adidas',
    'pharmacy', 'cvs', 'walgreens', 'rite aid', 'dollar', 'five below',
  ],
  bigPurchases: [
    'hotel', 'airbnb', 'vrbo', 'marriott', 'hilton', 'hyatt', 'expedia', 'booking.com',
    'kayak', 'flight', 'delta', 'united', 'american airlines', 'southwest', 'jetblue',
    'carnival', 'royal caribbean', 'norwegian', 'disney resort', 'vacation', 'resort',
    'furniture', 'appliance', 'electronics', 'laptop', 'iphone', 'tv ', 'television',
    'car dealer', 'mechanic', 'repair', 'medical', 'dentist', 'doctor', 'hospital',
    'insurance', 'rent', 'mortgage', 'tuition', 'university',
  ],
  savings: [
    'transfer to savings', 'savings deposit', 'investment', 'fidelity', 'vanguard',
    'schwab', 'robinhood', 'coinbase', 'sofi', 'marcus', 'ally bank', 'high yield',
    'roth ira', '401k', 'brokerage',
  ],
  studentLoans: [
    'sallie mae', 'navient', 'fedloan', 'great lakes', 'mohela', 'aidvantage',
    'edfinancial', 'nelnet', 'student loan', 'dept of ed', 'dept. of ed',
    'studentaid', 'studentloans',
  ],
}

export function categorize(merchantName) {
  const lower = (merchantName || '').toLowerCase()
  for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return cat
  }
  return 'other'
}
