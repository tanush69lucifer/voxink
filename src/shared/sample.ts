import type { BrainSource, Talk } from './store';

/** Sample pitch for trying VoxInk. AquaSun is a made-up company. */
const DAY = 864e5;
export const SAMPLE_BRAIN = (): BrainSource[] => [
  { id: 'about', kind: 'about', name: 'About me', addedAt: Date.now() - 3 * DAY,
    text: 'I am the founder of AquaSun. I study computer science and build hardware and software products. AquaSun started in Aligarh.' },
  { id: 'deck', kind: 'doc', name: 'AquaSun deck v4', addedAt: Date.now() - 2 * DAY,
    text: 'AquaSun makes a tiny solar water purifier for villages. It costs 92% less than bottled water. Each unit cleans 40 litres a day. The unit price is ₹4,500. We are live in 3 districts of Uttar Pradesh: Aligarh, Mathura and Agra. We raised ₹25 lakh in grants.' },
  { id: 'traction', kind: 'doc', name: 'Traction sheet, Oct 2026', addedAt: Date.now() - 41 * DAY,
    text: 'AquaSun serves 5,000 families. Monthly revenue is ₹6 lakh. Repeat filter orders are 68%.' },
  { id: 'site', kind: 'doc', name: 'aquasun website', addedAt: Date.now() - 6 * DAY,
    text: 'The AquaSun unit price is ₹4,900 including installation. Launched in 2025.' },
];

export const SAMPLE_TALK = (): Talk => ({
  title: 'AquaSun pitch', audience: 'Demo Day judges, about 300 people', style: 'zine',
  chapters: [
    { title: 'Problem', text: 'Imagine a world where every village has clean water. Millions of people drink unsafe water. Old filters are slow, expensive and break in the heat.' },
    { title: 'Solution', text: 'We built a tiny solar purifier that is fast and cheap. Unlike plastic bottles, our filter lasts for years.' },
    { title: 'Traction', text: 'We grew from 200 to 5,000 families. We are live in Aligarh, Mathura and Agra. Revenue and repeat orders.' },
    { title: 'Vision', text: 'We launched in 2025. By 2027 we want to reach 1 million homes across India. Together, boom.' },
  ],
});

export const DEMO_LINES = [
  'Imagine a world where every village has clean water.',
  'Today the problem is huge: millions of people drink unsafe water.',
  'Old filters are slow, expensive and they break in the heat.',
  'We built a tiny solar purifier that is fast and cheap.',
  'Unlike plastic bottles, our filter lasts for years.',
  'Last year we grew from 200 to 5,000 families.',
  'We are live in Aligarh, Mathura and Agra.',
  'And our monthly revenue keeps climbing.',
  'It costs 92 percent less than bottled water.',
  'We launched AquaSun in 2025.',
  'By 2027 we want to reach 1 million homes across India.',
  "Together, let's make it happen. Boom!",
];
