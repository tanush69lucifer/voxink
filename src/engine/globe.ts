import * as THREE from 'three';
import { feature } from 'topojson-client';
import land from 'world-atlas/land-110m.json';
import type { Pin } from '../shared/types';

/**
 * A real Earth, offline: Natural Earth land shapes (world-atlas) painted onto a canvas texture,
 * wrapped on a Three.js sphere, with glowing pins that the camera turns to face.
 */
export interface Globe { el: HTMLCanvasElement; setPins(p: Pin[]): void; dispose(): void }

function landTexture(ocean: string, ground: string, grid: string): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = ocean; g.fillRect(0, 0, W, H);
  g.strokeStyle = grid; g.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) { const x = ((lon + 180) / 360) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let lat = -60; lat <= 60; lat += 30) { const y = ((90 - lat) / 180) * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const geo: any = feature(land as any, (land as any).objects.land);
  g.fillStyle = ground;
  const ring = (coords: number[][]) => {
    g.beginPath();
    let prev: number | null = null;
    coords.forEach(([lo, la], i) => {
      const x = ((lo + 180) / 360) * W, y = ((90 - la) / 180) * H;
      if (i === 0 || (prev !== null && Math.abs(x - prev) > W / 2)) g.moveTo(x, y); else g.lineTo(x, y);
      prev = x;
    });
    g.closePath(); g.fill();
  };
  for (const f of geo.features) {
    const gm = f.geometry;
    const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.coordinates;
    for (const p of polys) for (const r of p) ring(r);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const toVec = (lat: number, lon: number, r: number) => {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

export function createGlobe(size: number, colors = { ocean: '#0b3a63', land: '#3dffa0', grid: 'rgba(255,255,255,0.12)', pin: '#ff4d2e' }): Globe {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(size, size);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  cam.position.set(0, 0, 4.2);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-3, 2, 4); scene.add(sun);

  const earth = new THREE.Group(); scene.add(earth);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.MeshStandardMaterial({ map: landTexture(colors.ocean, colors.land, colors.grid), roughness: 0.9, metalness: 0 }));
  earth.add(sphere);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 64), new THREE.MeshBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.08, side: THREE.BackSide }));
  scene.add(halo);

  const pinGroup = new THREE.Group(); earth.add(pinGroup);
  let target = new THREE.Quaternion(), rings: THREE.Mesh[] = [], spin = true, raf = 0, t = 0, last = performance.now(), fresh = true;

  const setPins = (pins: Pin[]) => {
    pinGroup.clear(); rings = [];
    for (const p of pins) {
      const pos = toVec(p.lat, p.lon, 1.0);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 16), new THREE.MeshBasicMaterial({ color: colors.pin }));
      dot.position.copy(pos); pinGroup.add(dot);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12), new THREE.MeshBasicMaterial({ color: colors.pin }));
      stick.position.copy(toVec(p.lat, p.lon, 1.06)); stick.lookAt(new THREE.Vector3(0, 0, 0)); stick.rotateX(Math.PI / 2); pinGroup.add(stick);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 32), new THREE.MeshBasicMaterial({ color: colors.pin, transparent: true, side: THREE.DoubleSide }));
      ring.position.copy(toVec(p.lat, p.lon, 1.002)); ring.lookAt(pos.clone().multiplyScalar(2)); pinGroup.add(ring); rings.push(ring);
    }
    if (pins.length) {
      const lat = pins.reduce((a, p) => a + p.lat, 0) / pins.length, lon = pins.reduce((a, p) => a + p.lon, 0) / pins.length;
      const from = toVec(lat, lon, 1).normalize();
      target = new THREE.Quaternion().setFromUnitVectors(from, new THREE.Vector3(0, 0.15, 1).normalize());
      if (fresh) earth.quaternion.copy(target); // a brand-new globe opens already facing the pins
      spin = false;
    } else spin = true;
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!renderer.domElement.isConnected) return; // off stage: costs nothing
    fresh = false;
    t += dt;
    // time-based easing: the same turn speed at 20 fps or 120 fps
    if (spin) earth.rotation.y += 0.25 * dt; else earth.quaternion.slerp(target, 1 - Math.exp(-dt * 4));
    rings.forEach((r, i) => { const k = ((t * 0.8 + i * 0.3) % 1); r.scale.setScalar(1 + k * 2.5); (r.material as THREE.MeshBasicMaterial).opacity = 1 - k; });
    renderer.render(scene, cam);
  };
  loop();
  return { el: renderer.domElement, setPins, dispose() { cancelAnimationFrame(raf); renderer.dispose(); } };
}
