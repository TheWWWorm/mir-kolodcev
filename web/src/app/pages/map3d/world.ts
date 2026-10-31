import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Features, HeightField } from './settlements';

/** Scene size in model units, matching map3d/terrain.py. */
export const W_UNITS = 32, D_UNITS = 24;

export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, -0.56).normalize();

/* ------------------------------------------------------------ sky ------ */
export function makeSky(): Sky {
  const sky = new Sky();
  sky.scale.setScalar(400);
  const u = sky.material.uniforms;
  u['turbidity'].value = 4;
  u['rayleigh'].value = 1.4;
  u['mieCoefficient'].value = 0.004;
  u['mieDirectionalG'].value = 0.82;
  u['sunPosition'].value.copy(SUN_DIR).multiplyScalar(100);
  return sky;
}

/* ---------------------------------------------------------- water ------ */
/**
 * The sea and the lake: the shader reads the seabed depth texture and fades out wherever the
 * ground is above the waterline, so the coast follows the real shoreline instead of mesh facets.
 * Colour runs from turquoise shallows to deep blue, foam laps the shore, and the ripples are
 * value-noise normals that fade with distance so they never band into stripes.
 */
export function makeWater(seabed: THREE.Texture): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSeabed: { value: seabed },
      uSize: { value: new THREE.Vector2(W_UNITS, D_UNITS) },
      uSun: { value: SUN_DIR.clone() },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vFogDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uSeabed; uniform vec2 uSize; uniform vec3 uSun;
      uniform vec3 fogColor; uniform float fogNear, fogFar;
      varying vec3 vWorld; varying float vFogDepth;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float waves(vec2 p, float detail) {
        float t = uTime * .35, s = 0.0, a = .5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) {
          if (float(i) > detail) break;
          s += a * noise(p + vec2(t, t * .7));
          p = m * p; a *= .5; t *= 1.3;
        }
        return s;
      }
      void main() {
        vec2 uv = vWorld.xz / uSize + .5;
        // beyond the map the seabed keeps its edge value and eases into open ocean, with no seam
        float ground = texture2D(uSeabed, clamp(uv, .001, .999)).r * .8 - .6;   // seabed height, scene units
        float far = smoothstep(.47, .75, max(abs(uv.x - .5), abs(uv.y - .5)));
        float depth = mix(-ground, max(-ground, .5), far);
        if (depth < -0.002) discard;

        float detail = 4.0 - 3.0 * smoothstep(2.0, 16.0, vFogDepth);
        vec2 p = vWorld.xz * 6.0;
        float e = .08;
        float h0 = waves(p, detail);
        vec3 n = normalize(vec3(h0 - waves(p + vec2(e, 0), detail), e * 2.2, h0 - waves(p + vec2(0, e), detail)));
        n = normalize(mix(vec3(0, 1, 0), n, .55 / (1.0 + vFogDepth * .06)));

        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 shallow = vec3(.22, .60, .62), mid = vec3(.10, .40, .52), deep = vec3(.04, .19, .33);
        vec3 col = mix(shallow, mid, smoothstep(.0, .08, depth));
        col = mix(col, deep, smoothstep(.06, .45, depth));
        vec3 r = reflect(-v, n);
        vec3 sky = mix(vec3(.72, .82, .9), vec3(.36, .55, .78), clamp(r.y * 1.6, 0.0, 1.0));
        col = mix(col, sky, .12 + .55 * fres);
        float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 120.0);
        col += vec3(1.0, .96, .88) * spec * .9;

        // foam: a soft broken band where the water meets the shore
        float shore = 1.0 - smoothstep(.0, .009, depth);
        float foam = shore * smoothstep(.5, .8, noise(vWorld.xz * 55.0 + uTime * .6) * .55 + .25 * sin(depth * 700.0 - uTime * 2.2) + .35);
        col = mix(col, vec3(.95, .97, .98), foam * .75);

        // deep water is opaque, so the edge of the terrain mesh under it never shows
        float alpha = mix(.35, 1.0, smoothstep(.0, .2, depth));
        alpha = max(max(alpha, far), foam * .8) * smoothstep(-.002, .006, depth);
        float f = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(col, fogColor, f), alpha);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W_UNITS * 9, D_UNITS * 9, 1, 1), mat);
  water.rotation.x = -Math.PI / 2;
  water.renderOrder = 2;
  // open-ocean floor beyond the terrain, the colour of the deep seabed inside it, so the map edge has nothing pale behind it
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W_UNITS * 9, D_UNITS * 9, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0b1a2a }));
  floor.position.z = -0.3;            // a child of the water plane, whose local z points up
  water.add(floor);
  return water;
}

/* ---------------------------------------------------------- trees ------ */
function colored(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.attributes['position'].count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g.index ? g.toNonIndexed() : g;
}

function at(g: THREE.BufferGeometry, y: number, sy = 1): THREE.BufferGeometry {
  g.scale(1, sy, 1);
  g.translate(0, y, 0);
  return g;
}

/** Low-poly archetypes, ~0.07 units tall with the origin at the foot: conifer, broadleaf, palm, olive. */
function treeGeometries(): THREE.BufferGeometry[] {
  const bark = 0x4a3220;
  const conifer = mergeGeometries([
    colored(at(new THREE.CylinderGeometry(.004, .004, .02, 5), .01), bark),
    colored(at(new THREE.ConeGeometry(.022, .03, 7), .03), 0x1f3b26),
    colored(at(new THREE.ConeGeometry(.017, .03, 7), .047), 0x24452b),
    colored(at(new THREE.ConeGeometry(.011, .026, 7), .062), 0x2a4f31),
  ])!;
  const broad = mergeGeometries([
    colored(at(new THREE.CylinderGeometry(.004, .004, .026, 5), .013), bark),
    colored(at(new THREE.IcosahedronGeometry(.02, 1), .04, .85), 0x3d5e22),
  ])!;
  const palm = mergeGeometries([
    colored(at(new THREE.CylinderGeometry(.0025, .0035, .05, 5), .025), 0x6b5236),
    colored(at(new THREE.ConeGeometry(.026, .012, 6), .052), 0x3f6b24),
  ])!;
  // olive and orange trees of the Каталия groves: a short gnarled trunk under a wide grey-green crown
  const olive = mergeGeometries([
    colored(at(new THREE.CylinderGeometry(.0025, .0035, .014, 5), .007), 0x5a4632),
    colored(at(new THREE.IcosahedronGeometry(.014, 0), .02, .7), 0x6f7d4c),
  ])!;
  return [conifer, broad, palm, olive];
}

/** Forests from trees.bin: float32 records (x, z, y, type, scale); `keepOut` clears ground for towns. */
export function makeForests(buf: ArrayBuffer, keepOut: (x: number, z: number) => boolean): THREE.Group {
  const data = new Float32Array(buf);
  const geos = treeGeometries();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  const keep: number[] = [];
  const counts = geos.map(() => 0);
  for (let i = 0; i < data.length; i += 5) {
    if (keepOut(data[i], data[i + 1])) continue;
    keep.push(i);
    counts[data[i + 3]]++;
  }
  const meshes = geos.map((g, t) => {
    const m = new THREE.InstancedMesh(g, mat, counts[t]);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  });
  const fill = geos.map(() => 0);
  const o = new THREE.Object3D();
  const tint = new THREE.Color();
  for (const i of keep) {
    const t = data[i + 3], s = data[i + 4];
    o.position.set(data[i], data[i + 2] - 0.002, data[i + 1]);
    o.rotation.y = (i * 2.399) % (Math.PI * 2);
    o.scale.setScalar(s * 0.65);
    o.updateMatrix();
    meshes[t].setMatrixAt(fill[t], o.matrix);
    tint.setHSL(0, 0, 0.82 + ((i * 7.13) % 1) * 0.3);
    meshes[t].setColorAt(fill[t], tint);
    fill[t]++;
  }
  meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  return group;
}

/* ------------------------------------------------- roads and railways ---- */
/** A strip draped over the height field along a polyline, `lift` above the ground. */
export function ribbon(pts: [number, number][], width: number, lift: number, hf: HeightField): THREE.BufferGeometry {
  const dense: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / .015));
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  const pos: number[] = [], idx: number[] = [];
  dense.forEach(([x, z], i) => {
    const [px, pz] = dense[Math.max(0, i - 1)], [nx, nz] = dense[Math.min(dense.length - 1, i + 1)];
    const tl = Math.hypot(nx - px, nz - pz) || 1, ox = (-(nz - pz) / tl) * width / 2, oz = ((nx - px) / tl) * width / 2;
    for (const sgn of [1, -1]) {
      const vx = x + ox * sgn, vz = z + oz * sgn;
      pos.push(vx, Math.max(hf.at(vx, vz), hf.at(x, z), 0) + lift, vz);
    }
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Railways (dark rails on pale ballast) and the great roads (packed earth), from features.json. */
export function makeRoutes(roads: Features['roads'], hf: HeightField): THREE.Group {
  const group = new THREE.Group();
  const mat = (hex: number, off: number) => new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off * 2 });
  const add = (kind: 'rail' | 'road', width: number, lift: number, m: THREE.Material) => {
    const gs = roads.filter((r) => r.kind === kind).map((r) => ribbon(r.pts, width, lift, hf));
    if (!gs.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(gs)!, m);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    group.add(mesh);
  };
  add('road', .024, .004, mat(0xdcc596, -2));
  add('rail', .022, .005, mat(0xa89f92, -3));
  add('rail', .009, .0065, mat(0x2b2523, -4));
  return group;
}

/** Lakes that lie above sea level (the Дангар and Олландия lakes, the small lakes of Индра): flat water on their basins. */
export function makeTarns(tarns: Features['tarns']): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f6276, roughness: .45, metalness: 0, transparent: true, opacity: .92, side: THREE.DoubleSide });
  for (const t of tarns) {
    const shape = new THREE.Shape(t.pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2).translate(0, t.y + .002, 0);
    group.add(new THREE.Mesh(g, mat));
  }
  return group;
}
