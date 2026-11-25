import type { Pin } from '../shared/types';

/** A small offline gazetteer, so "we're live in Lucknow and Jaipur" drops pins on a real globe instantly. */
const PLACES: [string, number, number][] = [
  // India — cities
  ['Aligarh', 27.88, 78.08], ['Agra', 27.18, 78.01], ['Mathura', 27.49, 77.67], ['Delhi', 28.61, 77.21], ['New Delhi', 28.61, 77.21],
  ['Noida', 28.54, 77.39], ['Gurugram', 28.46, 77.03], ['Gurgaon', 28.46, 77.03], ['Lucknow', 26.85, 80.95], ['Kanpur', 26.45, 80.33],
  ['Varanasi', 25.32, 82.97], ['Prayagraj', 25.44, 81.85], ['Jaipur', 26.91, 75.79], ['Mumbai', 19.08, 72.88], ['Pune', 18.52, 73.86],
  ['Bengaluru', 12.97, 77.59], ['Bangalore', 12.97, 77.59], ['Chennai', 13.08, 80.27], ['Hyderabad', 17.39, 78.49], ['Kolkata', 22.57, 88.36],
  ['Ahmedabad', 23.02, 72.57], ['Surat', 21.17, 72.83], ['Chandigarh', 30.73, 76.78], ['Bhopal', 23.26, 77.41], ['Indore', 22.72, 75.86],
  ['Patna', 25.59, 85.14], ['Dehradun', 30.32, 78.03], ['Kochi', 9.93, 76.27], ['Goa', 15.49, 73.83], ['Farrukhabad', 27.39, 79.58],
  ['Guwahati', 26.14, 91.74], ['Nagpur', 21.15, 79.09], ['Amritsar', 31.63, 74.87],
  // India — states and the country
  ['Uttar Pradesh', 26.85, 80.95], ['UP', 26.85, 80.95], ['Rajasthan', 26.91, 75.79], ['Maharashtra', 19.75, 75.71], ['Karnataka', 15.32, 75.71],
  ['Kerala', 10.85, 76.27], ['Gujarat', 22.26, 71.19], ['Bihar', 25.10, 85.31], ['Punjab', 31.15, 75.34], ['Tamil Nadu', 11.13, 78.66],
  ['India', 22.0, 79.0],
  // World
  ['Dubai', 25.20, 55.27], ['Singapore', 1.35, 103.82], ['London', 51.51, -0.13], ['Paris', 48.86, 2.35], ['Berlin', 52.52, 13.40],
  ['New York', 40.71, -74.01], ['San Francisco', 37.77, -122.42], ['Silicon Valley', 37.39, -122.08], ['Los Angeles', 34.05, -118.24],
  ['Toronto', 43.65, -79.38], ['Tokyo', 35.68, 139.69], ['Beijing', 39.90, 116.40], ['Shanghai', 31.23, 121.47], ['Seoul', 37.57, 126.98],
  ['Sydney', -33.87, 151.21], ['Nairobi', -1.29, 36.82], ['Lagos', 6.52, 3.38], ['Cairo', 30.04, 31.24], ['Sao Paulo', -23.55, -46.63],
  ['Mexico City', 19.43, -99.13], ['Kathmandu', 27.72, 85.32], ['Dhaka', 23.81, 90.41], ['Colombo', 6.93, 79.86], ['Karachi', 24.86, 67.01],
  ['USA', 39.8, -98.6], ['America', 39.8, -98.6], ['United States', 39.8, -98.6], ['UK', 54.0, -2.0], ['China', 35.0, 103.0], ['Japan', 36.2, 138.3],
  ['Africa', 2.0, 21.0], ['Europe', 50.0, 10.0], ['Southeast Asia', 10.0, 106.0],
];

const BY = new Map(PLACES.map(([n, la, lo]) => [n.toLowerCase(), { name: n, lat: la, lon: lo }]));

export function findPlaces(sentence: string): Pin[] {
  const s = ' ' + sentence.replace(/[^\w\s]/g, ' ') + ' ';
  const out: Pin[] = [];
  for (const [n] of PLACES) {
    const re = new RegExp(`\\s${n.replace(/ /g, '\\s+')}\\s`, n === 'UP' ? '' : 'i');
    if (re.test(s)) {
      const p = BY.get(n.toLowerCase())!;
      if (!out.some((o) => o.lat === p.lat && o.lon === p.lon)) out.push(p);
    }
  }
  return out;
}

export const WORLDISH = /\b(world|global|globe|globally|worldwide|countries|international|planet|earth)\b/i;
