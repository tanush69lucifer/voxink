import ICONS from './icon-data.json';

const DATA = ICONS as Record<string, string>;

/** Spoken word -> icon name. Everything else falls back to an exact icon-name match (1,531 Phosphor icons, bundled). */
const SYN: Record<string, string> = {
  water: 'drop', purifier: 'drop-half', purified: 'drop-half', filter: 'funnel', filters: 'funnel', bottle: 'drop', bottles: 'drop',
  family: 'users-three', families: 'users-three', people: 'users', users: 'users', customers: 'users-three', team: 'users-three', community: 'users-three',
  home: 'house', homes: 'house', house: 'house', houses: 'house', village: 'house-line', villages: 'house-line',
  school: 'graduation-cap', schools: 'graduation-cap', college: 'graduation-cap', students: 'student', student: 'student', education: 'book-open',
  rupees: 'currency-inr', rupee: 'currency-inr', revenue: 'chart-line-up', money: 'coins', funding: 'bank', investors: 'handshake', investment: 'bank',
  phone: 'device-mobile', mobile: 'device-mobile', app: 'device-mobile', solar: 'solar-panel', sunlight: 'sun', sun: 'sun', energy: 'lightning', electricity: 'lightning',
  idea: 'lightbulb', ideas: 'lightbulb', growth: 'trend-up', health: 'heartbeat', healthcare: 'heartbeat', doctor: 'stethoscope', doctors: 'stethoscope',
  hospital: 'hospital', hospitals: 'hospital', medicine: 'pill', food: 'bowl-food', farmers: 'plant', farmer: 'plant', farming: 'plant', agriculture: 'plant',
  city: 'buildings', cities: 'buildings', time: 'clock', hours: 'clock', data: 'database', security: 'shield-check', safety: 'shield-check', safe: 'shield-check',
  chat: 'chat-circle', message: 'chat-circle', delivery: 'truck', logistics: 'truck', travel: 'airplane', flight: 'airplane', shop: 'storefront', store: 'storefront',
  shopping: 'shopping-cart', environment: 'leaf', climate: 'leaf', green: 'leaf', trees: 'tree', factory: 'factory', manufacturing: 'factory', battery: 'battery-full',
  internet: 'wifi-high', code: 'code', coding: 'code', robot: 'robot', robots: 'robot', chip: 'cpu', chips: 'cpu', target: 'target', goal: 'target', goals: 'target',
  award: 'trophy', winner: 'trophy', partner: 'handshake', partners: 'handshake', partnership: 'handshake', marketing: 'megaphone', voice: 'microphone', speech: 'microphone',
  camera: 'camera', book: 'book-open', research: 'flask', science: 'atom', virus: 'virus', baby: 'baby', women: 'person', woman: 'person', cycle: 'bicycle',
  bus: 'bus', train: 'train', location: 'map-pin', mountains: 'mountains', rain: 'cloud-rain', weather: 'thermometer', recycle: 'recycle', recycling: 'recycle',
  gift: 'gift', star: 'star', launch: 'rocket-launch', startup: 'rocket-launch', product: 'cube', products: 'cube', settings: 'gear', privacy: 'lock', password: 'key',
  law: 'scales', legal: 'gavel', business: 'briefcase', calendar: 'calendar', video: 'video-camera', music: 'music-notes', game: 'game-controller', games: 'game-controller',
  design: 'palette', coffee: 'coffee', cafe: 'coffee', pizza: 'pizza', clothes: 't-shirt', fashion: 't-shirt', pets: 'dog', dog: 'dog', cat: 'cat', flowers: 'flower',
  brain: 'brain', ai: 'brain', world: 'globe-hemisphere-east', globe: 'globe-hemisphere-east', ocean: 'waves', heart: 'heart',
};

export function iconFor(word: string): string | null {
  const w = word.toLowerCase().replace(/[^a-z-]/g, '');
  if (!w || w.length < 3) return null;
  const n = SYN[w] || (DATA[w] ? w : null) || (w.endsWith('s') && DATA[w.slice(0, -1)] ? w.slice(0, -1) : null);
  return n && DATA[n] ? n : null;
}

export function iconSvg(name: string, attrs = ''): string {
  const body = DATA[name];
  return body ? `<svg viewBox="0 0 256 256" ${attrs} aria-hidden="true">${body.replace(/currentColor/g, 'currentColor')}</svg>` : '';
}
