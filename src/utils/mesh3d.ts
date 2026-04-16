// Port of Python 3D mesh generation functions from app.py
// Exact same geometry logic for box, ring, polygon, split-ring, etc.

export interface MeshData {
  x: number[];
  y: number[];
  z: number[];
  i: number[];
  j: number[];
  k: number[];
}

export function boxMesh(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): MeshData {
  const x = [x0, x1, x1, x0, x0, x1, x1, x0];
  const y = [y0, y0, y1, y1, y0, y0, y1, y1];
  const z = [z0, z0, z0, z0, z1, z1, z1, z1];
  const i = [0, 0, 0, 1, 1, 2, 4, 4, 4, 5, 5, 6];
  const j = [1, 2, 3, 2, 5, 6, 5, 6, 7, 6, 1, 2];
  const k = [2, 3, 0, 5, 6, 7, 6, 7, 4, 1, 2, 3];
  return { x, y, z, i, j, k };
}

export function ringPrismMesh(rOut: number, rIn: number, z0: number, z1: number, n = 72): MeshData {
  const th = Array.from({ length: n }, (_, idx) => (2 * Math.PI * idx) / n);
  const xo = th.map(t => rOut * Math.cos(t));
  const yo = th.map(t => rOut * Math.sin(t));
  const xi = th.map(t => rIn * Math.cos(t));
  const yi = th.map(t => rIn * Math.sin(t));

  const x = [...xo, ...xo, ...xi, ...xi];
  const y = [...yo, ...yo, ...yi, ...yi];
  const z = [
    ...Array(n).fill(z0), ...Array(n).fill(z1),
    ...Array(n).fill(z0), ...Array(n).fill(z1),
  ];
  const ob0 = 0, ot0 = n, ib0 = 2 * n, it0 = 3 * n;
  const I: number[] = [], J: number[] = [], K: number[] = [];

  for (let idx = 0; idx < n; idx++) {
    const a = idx, b = (idx + 1) % n;
    // outer wall
    I.push(ob0 + a, ob0 + a); J.push(ob0 + b, ot0 + b); K.push(ot0 + b, ot0 + a);
    // inner wall
    I.push(ib0 + a, ib0 + a); J.push(it0 + b, ib0 + b); K.push(ib0 + b, it0 + a);
    // top
    I.push(ot0 + a, ot0 + a); J.push(ot0 + b, it0 + b); K.push(it0 + b, it0 + a);
    // bottom
    I.push(ob0 + a, ib0 + b); J.push(ib0 + b, ob0 + b); K.push(ib0 + a, ib0 + a);
  }
  return { x, y, z, i: I, j: J, k: K };
}

export function polygonPrismMesh(r: number, z0: number, z1: number, n = 8): MeshData {
  const th = Array.from({ length: n }, (_, idx) => (2 * Math.PI * idx) / n);
  const xb = th.map(t => r * Math.cos(t));
  const yb = th.map(t => r * Math.sin(t));
  const x = [...xb, ...xb, 0.0, 0.0];
  const y = [...yb, ...yb, 0.0, 0.0];
  const z = [...Array(n).fill(z0), ...Array(n).fill(z1), z0, z1];
  const cb = 2 * n, ct = 2 * n + 1;
  const I: number[] = [], J: number[] = [], K: number[] = [];
  for (let idx = 0; idx < n; idx++) {
    const b0 = idx, b1 = (idx + 1) % n, t0 = n + idx, t1 = n + ((idx + 1) % n);
    I.push(b0, b0); J.push(b1, t1); K.push(t1, t0);
    I.push(ct); J.push(t0); K.push(t1);
    I.push(cb); J.push(b1); K.push(b0);
  }
  return { x, y, z, i: I, j: J, k: K };
}

export function polyVerticesPrismMesh(vertices: [number, number][], z0: number, z1: number): MeshData {
  const n = vertices.length;
  if (n < 3) return { x: [], y: [], z: [], i: [], j: [], k: [] };
  const xb = vertices.map(v => v[0]);
  const yb = vertices.map(v => v[1]);
  const x = [...xb, ...xb];
  const y = [...yb, ...yb];
  const z = [...Array(n).fill(z0), ...Array(n).fill(z1)];
  const I: number[] = [], J: number[] = [], K: number[] = [];
  // bottom fan
  for (let idx = 1; idx < n - 1; idx++) { I.push(0); J.push(idx); K.push(idx + 1); }
  // top fan (reversed)
  const off = n;
  for (let idx = 1; idx < n - 1; idx++) { I.push(off); J.push(off + idx + 1); K.push(off + idx); }
  // sides
  for (let idx = 0; idx < n; idx++) {
    const j = (idx + 1) % n;
    I.push(idx, idx); J.push(j, off + j); K.push(off + j, off + idx);
  }
  return { x, y, z, i: I, j: J, k: K };
}

export function ringSegmentMesh(rOut: number, rIn: number, th0: number, th1: number, z0: number, z1: number, n = 60): MeshData {
  const th = Array.from({ length: n }, (_, idx) => th0 + (th1 - th0) * idx / (n - 1));
  const xo = th.map(t => rOut * Math.cos(t));
  const yo = th.map(t => rOut * Math.sin(t));
  const xi = th.map(t => rIn * Math.cos(t));
  const yi = th.map(t => rIn * Math.sin(t));

  const x = [...xo, ...xo, ...xi, ...xi];
  const y = [...yo, ...yo, ...yi, ...yi];
  const z = [...Array(n).fill(z0), ...Array(n).fill(z1), ...Array(n).fill(z0), ...Array(n).fill(z1)];
  const ob0 = 0, ot0 = n, ib0 = 2 * n, it0 = 3 * n;
  const I: number[] = [], J: number[] = [], K: number[] = [];
  for (let idx = 0; idx < n - 1; idx++) {
    I.push(ob0 + idx, ob0 + idx); J.push(ob0 + idx + 1, ot0 + idx + 1); K.push(ot0 + idx + 1, ot0 + idx);
    I.push(ib0 + idx, ib0 + idx); J.push(it0 + idx + 1, ib0 + idx + 1); K.push(ib0 + idx + 1, it0 + idx);
    I.push(ot0 + idx, ot0 + idx); J.push(ot0 + idx + 1, it0 + idx + 1); K.push(it0 + idx + 1, it0 + idx);
    I.push(ob0 + idx + 1, ob0 + idx + 1); J.push(ob0 + idx, ib0 + idx); K.push(ib0 + idx, ib0 + idx + 1);
  }
  return { x, y, z, i: I, j: J, k: K };
}

export function splitRingMesh(rOut: number, rIn: number, z0: number, z1: number, gapCentersDeg: number[], gapWidthDeg: number): MeshData {
  const gw = (gapWidthDeg * Math.PI / 180) / 2.0;
  const forbidden: [number, number][] = [];
  for (const c of gapCentersDeg) {
    const a = ((c * Math.PI / 180) - gw + 2 * Math.PI) % (2 * Math.PI);
    const b = ((c * Math.PI / 180) + gw) % (2 * Math.PI);
    if (a < b) {
      forbidden.push([a, b]);
    } else {
      forbidden.push([a, 2 * Math.PI]);
      forbidden.push([0.0, b]);
    }
  }
  forbidden.sort((a, b) => a[0] - b[0]);
  const allowed: [number, number][] = [];
  let cur = 0.0;
  for (const [a, b] of forbidden) {
    if (a > cur) allowed.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < 2 * Math.PI) allowed.push([cur, 2 * Math.PI]);

  const X: number[] = [], Y: number[] = [], Z: number[] = [];
  const I: number[] = [], J: number[] = [], K: number[] = [];
  let base = 0;
  for (const [a, b] of allowed) {
    if (b - a < 1e-6) continue;
    const seg = ringSegmentMesh(rOut, rIn, a, b, z0, z1);
    X.push(...seg.x); Y.push(...seg.y); Z.push(...seg.z);
    I.push(...seg.i.map(t => t + base));
    J.push(...seg.j.map(t => t + base));
    K.push(...seg.k.map(t => t + base));
    base += seg.x.length;
  }
  return { x: X, y: Y, z: Z, i: I, j: J, k: K };
}

export function polygonSplitRingMesh(rOut: number, rIn: number, z0: number, z1: number, nSides: number, gapCentersDeg: number[], gapWidthDeg: number): MeshData {
  const th = Array.from({ length: nSides }, (_, idx) => (2 * Math.PI * idx) / nSides);
  const thNext = th.map((_, idx) => th[(idx + 1) % nSides]);
  const d = th.map((t, idx) => ((thNext[idx] - t) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
  const edgeMid = th.map((t, idx) => (t + d[idx] / 2.0) % (2 * Math.PI));
  const gcs = gapCentersDeg.map(c => ((c * Math.PI / 180) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
  const halfw = (gapWidthDeg * Math.PI / 180) / 2.0;

  const adist = (a: number, b: number) => Math.abs(((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
  const gapEdges = new Set<number>();
  edgeMid.forEach((mid, idx) => { if (gcs.some(gc => adist(mid, gc) <= halfw)) gapEdges.add(idx); });

  const xo = th.map(t => rOut * Math.cos(t));
  const yo = th.map(t => rOut * Math.sin(t));
  const xi = th.map(t => rIn * Math.cos(t));
  const yi = th.map(t => rIn * Math.sin(t));
  const x = [...xo, ...xo, ...xi, ...xi];
  const y = [...yo, ...yo, ...yi, ...yi];
  const z = [...Array(nSides).fill(z0), ...Array(nSides).fill(z1), ...Array(nSides).fill(z0), ...Array(nSides).fill(z1)];
  const ob0 = 0, ot0 = nSides, ib0 = 2 * nSides, it0 = 3 * nSides;
  const I: number[] = [], J: number[] = [], K: number[] = [];

  for (let idx = 0; idx < nSides; idx++) {
    if (gapEdges.has(idx)) continue;
    const j = (idx + 1) % nSides;
    I.push(ob0 + idx, ob0 + idx); J.push(ob0 + j, ot0 + j); K.push(ot0 + j, ot0 + idx);
    I.push(ib0 + idx, ib0 + idx); J.push(it0 + j, ib0 + j); K.push(ib0 + j, it0 + idx);
    I.push(ot0 + idx, ot0 + idx); J.push(ot0 + j, it0 + j); K.push(it0 + j, it0 + idx);
    I.push(ob0 + idx, ob0 + idx); J.push(ib0 + j, ob0 + j); K.push(ib0 + idx, ib0 + j);
  }
  return { x, y, z, i: I, j: J, k: K };
}

// Accumulator for combining multiple mesh parts (like the patch in app.py)
export function addBox(acc: MeshData, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const m = boxMesh(x0, x1, y0, y1, z0, z1);
  const base = acc.x.length;
  acc.x.push(...m.x); acc.y.push(...m.y); acc.z.push(...m.z);
  acc.i.push(...m.i.map(t => t + base));
  acc.j.push(...m.j.map(t => t + base));
  acc.k.push(...m.k.map(t => t + base));
}
