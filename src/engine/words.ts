/** Word effects: a word that means something visual gets acted out on stage. */
export const FX: Record<string, { mood: string; words: string }> = {
  big: { mood: '#ffd400', words: 'big bigger biggest huge massive giant gigantic enormous large mega billion billions millions trillion' },
  tiny: { mood: '#6c6480', words: 'tiny small smaller smallest little mini micro minimal' },
  fast: { mood: '#1d6f8c', words: 'fast faster fastest quick quickly speed rapid rapidly instant instantly rocket zoom seconds' },
  slow: { mood: '#4a3f7a', words: 'slow slowly slower wait waiting delay delayed lazy' },
  ice: { mood: '#1b6b8f', words: 'cold ice icy freeze frozen chill chilling winter' },
  fire: { mood: '#a83300', words: 'hot fire heat burn burning hottest flame flames' },
  up: { mood: '#0f7a4a', words: 'grow grew growth growing grows rise rising rose increase increased increasing boost scale scaling higher climb' },
  down: { mood: '#7a1f2b', words: 'fall fell falling drop dropped dropping decrease decreased decline crash crashed lower sink' },
  scary: { mood: '#6b0000', words: 'problem problems danger dangerous scary fear risk risky threat crisis pain unsafe struggle' },
  love: { mood: '#8a1f55', words: 'love loved loves heart care caring' },
  money: { mood: '#7a5a00', words: 'money cash rupees dollars revenue profit cheap cheaper price prices cost costs expensive funding invest investment pay rich' },
  boom: { mood: '#9a7a00', words: 'boom bang wow amazing incredible explode explosion launch launched launching impact' },
  break: { mood: '#3a3540', words: 'break broken breaks fail failed failure crack broke' },
  wave: { mood: '#0b4f8a', words: 'water flow flows wave waves ocean river sea rain liquid' },
  loud: { mood: '#8a2410', words: 'loud shout scream noise attention' },
  quiet: { mood: '#2b2834', words: 'quiet whisper silent silence softly' },
  idea: { mood: '#7a6a00', words: 'idea ideas think imagine brain smart genius insight vision' },
  happy: { mood: '#8a3a7a', words: 'happy fun joy smile excited celebrate' },
  sad: { mood: '#2e3440', words: 'sad alone lonely tired lost sorry' },
  tech: { mood: '#123a5a', words: 'ai tech technology digital future data code software algorithm machine robot app' },
  secret: { mood: '#2b2834', words: 'secret hidden hide mystery truth reveal' },
  long: { mood: '#4a3f7a', words: 'long longer forever distance lasts' },
  spin: { mood: '#8a4a00', words: 'spin turn turning circle cycle around revolution' },
  together: { mood: '#0f6a4a', words: 'together team connect connected community unite everyone people families' },
};

const MAP: Record<string, string> = {};
for (const k in FX) for (const w of FX[k].words.split(' ')) MAP[w] = k;

export const STOP = new Set(
  ("a an the and or but if so of to in on at by for with from into onto is are was were be been being am i we you they he she it its our your their my me us them this that these those there here than then as not no just very really also can could will would should may might do does did done have has had get got make made let lets let's what which who whom whose when where why how all any some each every more most much many such only own same other about over under again further once both few nor too s t don now one two three it's we're i'm that's they're isn't don't can't going want like well okay yeah").split(' '),
);

export function lookupFx(word: string): string | null {
  const l = word.toLowerCase();
  if (MAP[l]) return MAP[l];
  for (const suf of ['ing', 'ed', 'es', 's', 'er', 'est', 'ly']) {
    const stem = l.slice(0, -suf.length);
    if (l.endsWith(suf) && stem.length >= 3 && MAP[stem]) return MAP[stem];
  }
  return null;
}

export const clean = (raw: string) => raw.replace(/^[^\w₹$]+|[^\w%]+$/g, '');

/** Content words (lower-case, 4+ letters, not stop words). */
export function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-zऀ-ॿ][a-z0-9'ऀ-ॿ]*/g) || []).filter((w) => w.length >= 4 && !STOP.has(w));
}
