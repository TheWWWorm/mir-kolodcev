import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * What stands at each mapped place, taken from the articles' «Тип» field and the map legend.
 * Lands and rivers get no model, only a label in their own style.
 */
export type Settlement =
  | 'capital' | 'city' | 'stronghold' | 'castle' | 'town' | 'camp' | 'industrial'
  | 'nature' | 'water' | 'land';

/** Places with no pin of their own in data/map.json (or a different label): their title and article. */
export const EXTRA: Record<string, { title: string; link?: string }> = {
  'posledniaya-zima': { title: 'Последняя Зима', link: 'posledniaya-zima' },
  brega: { title: 'Брега', link: 'brega' },
  khursla: { title: 'р. Хурсла', link: 'khursla' },
  ortiyar: { title: 'Ортияр', link: 'ortiyar' },
  solanta: { title: 'к Соланте ↓', link: 'solanta' },
};

/** Relief features from map3d/features.json. */
export interface Features {
  /** Lakes above sea level: their water level and outline in scene x/z. */
  tarns: { kind: string; y: number; pts: [number, number][] }[];
  roads: { kind: 'rail' | 'road'; name: string; pts: [number, number][] }[];
  /** Where a road or railway crosses a river: x, z and the direction of the way. */
  bridges: [number, number, number][];
  /** Works and chimneys scattered over the Брега coalfield. */
  works: [number, number][];
}

export const SETTLEMENT: Record<string, Settlement> = {
  // capitals: Хофштадт of the kaiser's Дангар, Баргот of Мергана, Лаэрта of Каталия (a sea port)
  khofshtadt: 'capital', bargot: 'capital', laerta: 'capital',
  latsen: 'city', plyutva: 'city', gerona: 'city', ginarva: 'city',
  // «город-крепость», «пограничная крепость», «крепость, железнодорожный узел»
  mershants: 'stronghold', indra: 'stronghold', ortiyar: 'stronghold',
  // the seat of the von Eyrings and the ruined feudal castle above Трес Молинос
  ejring: 'castle', 'posledniaya-zima': 'castle',
  'tres-molinos': 'town',
  dunkvald: 'camp',
  brega: 'industrial',
  khursla: 'water', solanta: 'water',
};

export function settlementOf(key: string, kind: string): Settlement {
  return SETTLEMENT[key] ?? (kind === 'land' ? 'land' : kind === 'city' ? 'town' : 'nature');
}

/** Terrain height lookup from heights.bin (uint16 grid over the whole map). */
export class HeightField {
  /** Set by the page: true where a lake above sea level covers the ground. */
  wet: (x: number, z: number) => boolean = () => false;
  constructor(private readonly d: Uint16Array, private readonly w: number, private readonly h: number,
              private readonly min: number, private readonly max: number,
              private readonly W: number, private readonly D: number) {}
  at(x: number, z: number): number {
    const u = (x / this.W + 0.5) * (this.w - 1), v = (z / this.D + 0.5) * (this.h - 1);
    const x0 = Math.max(0, Math.min(this.w - 2, Math.floor(u))), y0 = Math.max(0, Math.min(this.h - 2, Math.floor(v)));
    const fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0));
    const g = (xx: number, yy: number) => this.d[yy * this.w + xx];
    const val = (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
    return this.min + (val / 65535) * (this.max - this.min);
  }
  /** Direction (unit x/z) toward the nearest open water within `r`, or null. */
  seaward(x: number, z: number, r = 0.35): [number, number] | null {
    let best: [number, number] | null = null, bestH = Infinity;
    for (let a = 0; a < 16; a++) {
      const dx = Math.cos((a / 16) * Math.PI * 2), dz = Math.sin((a / 16) * Math.PI * 2);
      const hh = this.at(x + dx * r, z + dz * r);
      if (hh < bestH) { bestH = hh; best = [dx, dz]; }
    }
    return bestH < 0 ? best : null;
  }
}

/* ------------------------------------------------------------- parts ---- */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function paint(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), n = ng.attributes['position'].count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  ng.setAttribute('color', new THREE.BufferAttribute(a, 3));
  ng.deleteAttribute('uv');
  return ng;
}

/** Gable-roofed house: walls box + triangular prism roof. */
function house(w: number, d: number, h: number, wall: number, roof: number): THREE.BufferGeometry {
  const body = paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), wall);
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - .0012, 0), new THREE.Vector2(w / 2 + .0012, 0), new THREE.Vector2(0, h * .75)]);
  const r = paint(new THREE.ExtrudeGeometry(shape, { depth: d + .002, bevelEnabled: false }).translate(0, h, -d / 2 - .001), roof);
  return mergeGeometries([body, r])!;
}

const WALLS = [0xe6dcc6, 0xd9ccb0, 0xcfc4ad, 0xb9a98c, 0xe9e2d2];
const ROOFS_N = [0x5b4b45, 0x6e5a4c, 0x4f4a48, 0x3f4a52];  // slate and shingle in Дангар and Олландия
const ROOFS = [0x9a3e2c, 0xa5502f, 0x8c3a2a, 0x7a4b34];    // tile in Мергана
const ROOFS_S = [0xc0683e, 0xb5562f, 0xd18a52];            // bright tile in Каталия
const WALLS_S = [0xf1ebdc, 0xeee2c4, 0xe8d6b0, 0xf4efe6];  // whitewash and ochre in the south
const STONE = 0xa49a88;
const BRICK = 0x7d3b2a;

function church(s: number, tall = 1): THREE.BufferGeometry {
  return mergeGeometries([
    house(.016 * s, .03 * s, .018 * s, 0xded5c2, 0x6a5a52),
    paint(new THREE.BoxGeometry(.011 * s, .05 * s * tall, .011 * s).translate(0, .025 * s * tall, -.018 * s), 0xded5c2),
    paint(new THREE.ConeGeometry(.009 * s, .03 * s * tall, 4).rotateY(Math.PI / 4).translate(0, .065 * s * tall, -.018 * s), 0x55606a),
  ])!;
}

function tower(r: number, h: number, roof: number): THREE.BufferGeometry {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(r, r * 1.08, h, 8).translate(0, h / 2, 0), STONE),
    paint(new THREE.ConeGeometry(r * 1.35, h * .45, 8).translate(0, h + h * .22, 0), roof),
  ])!;
}

function wallRing(radius: number, h: number, towers: number, roof: number, gap = -1): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < towers; i++) {
    if (i === gap) continue;
    const a0 = (i / towers) * Math.PI * 2, a1 = ((i + 1) / towers) * Math.PI * 2;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius, x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    const len = Math.hypot(x1 - x0, z1 - z0);
    out.push(paint(new THREE.BoxGeometry(len, h, h * .35).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2), STONE));
    out.push(tower(h * .32, h * 1.5, roof).translate(x0, 0, z0));
  }
  return out;
}

/** A Каталийская windmill pumping water: a whitewashed tower with four sails. */
export function windmill(s = 1, sail = 0x6b5236, wall = 0xd8cdb6): THREE.BufferGeometry {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(.004 * s, .0062 * s, .022 * s, 6).translate(0, .011 * s, 0), wall),
    paint(new THREE.ConeGeometry(.0052 * s, .006 * s, 6).translate(0, .025 * s, 0), 0x6e5a4c),
    paint(new THREE.BoxGeometry(.0012 * s, .032 * s, .0015 * s).rotateZ(.5).translate(0, .021 * s, .0062 * s), sail),
    paint(new THREE.BoxGeometry(.0012 * s, .032 * s, .0015 * s).rotateZ(.5 + Math.PI / 2).translate(0, .021 * s, .0062 * s), sail),
  ])!;
}

/** A works of Брега: a long brick shed with a saw-tooth roof and a tall chimney. */
export function works(s = 1, chimneys = 1): THREE.BufferGeometry {
  const parts = [
    paint(new THREE.BoxGeometry(.034 * s, .01 * s, .016 * s).translate(0, .005 * s, 0), BRICK),
    ...[-1, 0, 1].map((i) => paint(new THREE.BoxGeometry(.011 * s, .004 * s, .016 * s).rotateZ(.5).translate(i * .011 * s, .011 * s, 0), 0x3e3a38)),
  ];
  for (let i = 0; i < chimneys; i++) {
    const h = (.05 + .012 * i) * s;
    parts.push(paint(new THREE.CylinderGeometry(.0018 * s, .0028 * s, h, 6).translate(.02 * s + i * .007 * s, h / 2, -.004 * s + i * .006 * s), 0x5a3328));
  }
  return mergeGeometries(parts)!;
}

/** A stone bridge across a river, `angle` being the direction of the way (radians, x toward z). */
export function bridge(angle: number, deck: number, bed: number): THREE.BufferGeometry {
  const half = .045;
  return mergeGeometries([
    paint(new THREE.BoxGeometry(half * 2, .005, .014).translate(0, deck, 0), STONE),
    ...[-.45, .45].map((t) => paint(new THREE.BoxGeometry(.007, deck - bed + .008, .012).translate(t * half, (deck + bed) / 2 - .004, 0), 0x8f8676)),
    paint(new THREE.BoxGeometry(half * 2, .003, .0014).translate(0, deck + .004, .0064), 0x7d7466),
    paint(new THREE.BoxGeometry(half * 2, .003, .0014).translate(0, deck + .004, -.0064), 0x7d7466),
  ])!.rotateY(-angle);
}

/**
 * Build the model for one place. Houses are scattered on land only (checked against the height field)
 * and each piece sits on the ground under it, so towns follow hills and shores.
 */
export function buildSettlement(type: Settlement, key: string, x: number, z: number, hf: HeightField, lat: number): THREE.BufferGeometry | null {
  if (type === 'nature' || type === 'water' || type === 'land') return null;
  let seed = 7;
  for (const c of key) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const r = rng(seed);
  const south = lat > 0.55 && x > 3;              // Каталия
  const roofs = south ? ROOFS_S : lat < 0.45 && x < 6 ? ROOFS_N : ROOFS;
  const walls = south ? WALLS_S : WALLS;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const parts: THREE.BufferGeometry[] = [];
  const K = 1.7;                                  // buildings read at the same scale as the trees
  const put = (g: THREE.BufferGeometry, dx: number, dz: number, rot = 0) => {
    dx *= K; dz *= K;
    g.scale(K, K, K);
    const y = hf.at(x + dx, z + dz);
    if (y < 0.004 || hf.wet(x + dx, z + dz)) return false;      // never build in the water
    parts.push(g.rotateY(rot).translate(dx, y - .002, dz));
    return true;
  };
  const houses = (n: number, radius: number, size: number, inner = 0) => {
    let placed = 0;
    for (let i = 0; i < n * 3 && placed < n; i++) {
      const a = r() * Math.PI * 2, d = inner + Math.sqrt(r()) * (radius - inner);
      const w = (.008 + r() * .006) * size, dd = (.01 + r() * .008) * size, h = (.007 + r() * .005) * size;
      if (put(house(w, dd, h, pick(walls), pick(roofs)), Math.cos(a) * d, Math.sin(a) * d, a + (r() - .5) * .6)) placed++;
    }
  };
  const piers = () => {
    const dir = hf.seaward(x, z);
    if (!dir) return;
    // piers stretch out over the water toward the open sea, a moored ship with a mast at each
    for (let i = -2; i <= 2; i++) {
      const px = (dir[0] * .09 - dir[1] * i * .035) * K, pz = (dir[1] * .09 + dir[0] * i * .035) * K;
      parts.push(paint(new THREE.BoxGeometry(.07 * K, .004, .008 * K), 0x6d5640).rotateY(-Math.atan2(dir[1], dir[0])).translate(px, .006, pz));
      const bx = (dir[0] * .135 - dir[1] * i * .035) * K, bz = (dir[1] * .135 + dir[0] * i * .035) * K;
      parts.push(paint(new THREE.BoxGeometry(.02 * K, .006 * K, .007 * K).rotateY(-Math.atan2(dir[1], dir[0])).translate(bx, .006, bz), 0x5a3d26));
      parts.push(paint(new THREE.CylinderGeometry(.0008, .0008, .026 * K, 4).translate(bx, .006 + .013 * K, bz), 0x3b2a1c));
    }
  };

  switch (type) {
    case 'capital': {
      houses(110, .2, 1.1, .05);
      put(mergeGeometries(wallRing(.05, .014, 8, 0xc9a04a))!, 0, 0);
      // the palace: a long block with corner towers and a dome
      put(mergeGeometries([
        paint(new THREE.BoxGeometry(.07, .03, .04).translate(0, .015, 0), 0xe8e2d4),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => tower(.008, .045, pick(roofs)).translate(sx * .035, 0, sz * .02)),
        paint(new THREE.SphereGeometry(.014, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, .03, 0), south ? 0xd3ad55 : 0x6d8a86),
      ])!, 0, 0);
      put(church(1.4, 1.3), .09, -.05); put(church(1.2), -.1, .04);
      if (key === 'laerta') piers();
      break;
    }
    case 'city': {
      houses(55, .13, 1, .02);
      put(church(1.3, 1.2), .02, -.02); put(tower(.012, .07, pick(roofs)), -.03, .03);
      if (key === 'ginarva') {
        // a river landing on the Хурсла: warehouses by the water
        for (let i = 0; i < 4; i++) put(house(.03, .014, .012, 0x8a7a64, 0x4f4a48), -.06 + i * .035, .09, 0);
      }
      break;
    }
    case 'stronghold': {
      if (key === 'ortiyar') {
        // not walls but a system of bastions and redoubts round a railway yard in a narrow valley
        const star = (rad: number, n: number) => {
          const pts: THREE.Vector2[] = [];
          for (let i = 0; i < n * 2; i++) {
            const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? rad * .62 : rad;
            pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
          }
          const outer = new THREE.Shape(pts);
          outer.holes.push(new THREE.Path(pts.map((p) => p.clone().multiplyScalar(.78)).reverse()));
          return paint(new THREE.ExtrudeGeometry(outer, { depth: .01, bevelEnabled: false }).rotateX(-Math.PI / 2), 0x8a8a6a);
        };
        put(star(.07, 5), 0, 0);
        for (const [dx, dz] of [[.12, .05], [-.11, .07], [.02, -.13]]) put(star(.03, 4), dx, dz, r() * 3);
        put(paint(new THREE.BoxGeometry(.045, .012, .014).translate(0, .006, 0), 0xb59a76), 0, 0);     // the station
        for (let i = 0; i < 6; i++) put(paint(new THREE.BoxGeometry(.014, .006, .005).translate(0, .003, 0), 0x3c3c3c), -.03 + i * .012, .02);
        houses(10, .05, .8, .02);
        break;
      }
      // a fortified town: walls with towers, the keep and a church
      houses(28, .1, .95, .02);
      put(mergeGeometries([...wallRing(.075, .018, 8, pick(roofs), 3), tower(.014, .085, pick(roofs))])!, 0, 0);
      put(church(1), .03, .035);
      break;
    }
    case 'castle': {
      const ruin = key === 'posledniaya-zima';
      const keep = mergeGeometries([...wallRing(.03, .016, ruin ? 6 : 5, ruin ? 0x4a4440 : pick(roofs), ruin ? 2 : -1),
        tower(.011, .06, ruin ? 0x4a4440 : pick(roofs)), paint(new THREE.BoxGeometry(.028, .026, .016).translate(.008, .013, .006), STONE)])!;
      put(keep, 0, 0);
      if (!ruin) houses(14, .07, .85, .035);
      break;
    }
    case 'town': {
      houses(18, .065, .9, .015);
      put(church(1), 0, 0);
      if (key === 'tres-molinos') {
        // «Три мельницы» pump water into the cistern of the water tower
        for (let i = 0; i < 3; i++) put(windmill(1.5, 0x6b5236, 0xf1ebdc), .075 * Math.cos(i * 2.1 + .4), .075 * Math.sin(i * 2.1 + .4), r() * 3);
        put(mergeGeometries([
          paint(new THREE.CylinderGeometry(.003, .004, .03, 6).translate(0, .015, 0), 0xcfc0a0),
          paint(new THREE.CylinderGeometry(.008, .008, .01, 10).translate(0, .034, 0), 0x7d6a55),
        ])!, -.03, .04);
      }
      break;
    }
    case 'camp': {
      // Дунквальд: a stockade in the forest; rows of dugouts, barracks, the chief's terem, a temple and the wells
      const side = .1;
      for (const [dx, dz, rot] of [[0, -side, 0], [0, side, 0], [-side, 0, Math.PI / 2], [side, 0, Math.PI / 2]] as const)
        put(paint(new THREE.BoxGeometry(side * 2, .008, .002).translate(0, .004, 0), 0x5d4630), dx, dz, rot);
      for (const [dx, dz] of [[-side, -side], [side, -side], [-side, side], [side, side]])
        put(paint(new THREE.BoxGeometry(.008, .016, .008).translate(0, .008, 0), 0x6a5038), dx, dz);
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 7; i++) {
          // a dugout: a low turf mound with a dark doorway
          put(mergeGeometries([
            paint(new THREE.SphereGeometry(.007, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.4, .55, 1), 0x5a6b3c),
            paint(new THREE.BoxGeometry(.003, .003, .002).translate(0, .0015, .007), 0x1c1712),
          ])!, -.075 + i * .022, -.075 + row * .028);
        }
      }
      for (let i = 0; i < 2; i++) put(house(.04, .012, .01, 0x8b6c4a, 0x4a3a2c), -.035 + i * .06, .045);   // barracks
      put(house(.018, .016, .02, 0x9c7a52, 0x4a3a2c), .065, .075);                                         // the terem
      put(church(.8), -.065, .075);
      for (let i = 0; i < 9; i++) put(paint(new THREE.CylinderGeometry(.0035, .0035, .002, 8), 0x2b2620), .13 + (i % 3) * .02, -.04 + Math.floor(i / 3) * .02);   // wells
      break;
    }
    case 'industrial': {
      // Брега: «больше дымовых труб, чем деревьев в лесу»
      houses(45, .12, .9, .02);
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2, d = .03 + r() * .1;
        put(works(1.2, 1 + Math.floor(r() * 3)), Math.cos(a) * d, Math.sin(a) * d, r() * 3);
      }
      break;
    }
  }
  return parts.length ? mergeGeometries(parts) : null;
}
