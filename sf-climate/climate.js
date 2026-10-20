(function () {
  const t = I18n.t;
  const $ = (id) => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, text) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
    return el;
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, f) => a + (b - a) * f;
  const smooth = (f) => f * f * (3 - 2 * f);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Units ----------
  const UNIT_KEY = 'knowing-the-how:unit';
  let unit = null;
  try { unit = localStorage.getItem(UNIT_KEY); } catch (e) { /* storage blocked */ }
  if (unit !== 'C' && unit !== 'F') unit = navigator.language === 'en-US' ? 'F' : 'C';

  const toUnit = (c) => (unit === 'F' ? c * 9 / 5 + 32 : c);
  const fmtT = (c) => `${Math.round(toUnit(c))}°${unit}`;
  const fmtDT = (c) => `${Math.round(unit === 'F' ? c * 9 / 5 : c)}°${unit}`;

  function fillTemps(root = document) {
    root.querySelectorAll('[data-temp]').forEach((el) => { el.textContent = fmtT(+el.dataset.temp); });
    root.querySelectorAll('.tv').forEach((el) => {
      el.textContent = el.dataset.c != null ? fmtT(+el.dataset.c) : fmtDT(+el.dataset.dc);
    });
    const btn = $('unit-toggle');
    btn.textContent = unit === 'F' ? '°C' : '°F';
    btn.setAttribute('aria-label', t(unit === 'F' ? 'unit.toC' : 'unit.toF'));
  }

  $('unit-toggle').addEventListener('click', () => {
    unit = unit === 'F' ? 'C' : 'F';
    try { localStorage.setItem(UNIT_KEY, unit); } catch (e) { /* storage blocked */ }
    renderAll();
  });

  // ---------- Map projection ----------
  // Simple equirectangular projection around 37.8°N. Coastlines are hand-traced
  // and simplified: good for explaining, not for navigating.
  const W = 860, H = 750;
  const LON0 = -123.10, LAT1 = 38.32, KY = 700, KX = KY * Math.cos(37.8 * Math.PI / 180);
  const px = ([lon, lat]) => [(lon - LON0) * KX, (LAT1 - lat) * KY];
  const GATE = [-122.4775, 37.8185];

  const OCEAN = [
    [-123.10, 38.32], [-123.04, 38.32], [-123.06, 38.30], [-123.00, 38.24], [-122.98, 38.16],
    [-122.97, 38.10], [-123.00, 38.04], [-123.02, 37.995], [-122.98, 37.99], [-122.93, 38.02],
    [-122.88, 38.03], [-122.82, 38.00], [-122.75, 37.94], [-122.69, 37.905], [-122.64, 37.89],
    [-122.58, 37.86], [-122.53, 37.82], [-122.50, 37.826], [-122.476, 37.829], [-122.476, 37.809],
    [-122.49, 37.80], [-122.512, 37.788], [-122.511, 37.77], [-122.508, 37.74], [-122.504, 37.71],
    [-122.495, 37.66], [-122.497, 37.62], [-122.515, 37.59], [-122.52, 37.54], [-122.50, 37.495],
    [-122.46, 37.46], [-122.43, 37.40], [-122.41, 37.30], [-122.405, 37.24], [-123.10, 37.24],
  ];
  const BAY = [
    [-122.48, 37.810], [-122.465, 37.806], [-122.445, 37.806], [-122.43, 37.808], [-122.41, 37.810],
    [-122.395, 37.80], [-122.388, 37.79], [-122.385, 37.775], [-122.383, 37.76], [-122.375, 37.745],
    [-122.36, 37.73], [-122.375, 37.715], [-122.385, 37.705], [-122.39, 37.68], [-122.385, 37.655],
    [-122.375, 37.635], [-122.355, 37.615], [-122.345, 37.60], [-122.30, 37.58], [-122.26, 37.56],
    [-122.22, 37.53], [-122.18, 37.505], [-122.13, 37.49], [-122.08, 37.46], [-122.03, 37.44],
    [-121.97, 37.44], [-121.98, 37.47], [-122.03, 37.50], [-122.07, 37.54], [-122.12, 37.58],
    [-122.15, 37.62], [-122.18, 37.66], [-122.20, 37.70], [-122.24, 37.73], [-122.30, 37.765],
    [-122.30, 37.79], [-122.315, 37.815], [-122.305, 37.835], [-122.31, 37.86], [-122.32, 37.89],
    [-122.35, 37.91], [-122.39, 37.91], [-122.425, 37.935], [-122.43, 37.96], [-122.40, 37.985],
    [-122.34, 38.00], [-122.29, 38.02], [-122.25, 38.04], [-122.23, 38.055], [-122.18, 38.05],
    [-122.13, 38.035], [-122.08, 38.05], [-122.02, 38.06], [-121.96, 38.05], [-121.90, 38.04],
    [-121.85, 38.02], [-121.80, 38.02], [-121.70, 38.03], [-121.54, 38.06], [-121.54, 38.09],
    [-121.70, 38.07], [-121.82, 38.06], [-121.90, 38.08], [-122.00, 38.10], [-122.06, 38.08],
    [-122.12, 38.05], [-122.16, 38.055], [-122.21, 38.065], [-122.24, 38.075], [-122.26, 38.10],
    [-122.27, 38.12], [-122.31, 38.13], [-122.36, 38.14], [-122.42, 38.13], [-122.48, 38.12],
    [-122.51, 38.08], [-122.505, 38.03], [-122.48, 37.99], [-122.46, 37.965], [-122.475, 37.94],
    [-122.50, 37.925], [-122.51, 37.895], [-122.49, 37.87], [-122.48, 37.86], [-122.475, 37.845],
    [-122.476, 37.829],
  ];
  const ISLANDS = [
    [[-122.445, 37.865], [-122.425, 37.872], [-122.415, 37.862], [-122.43, 37.852], [-122.445, 37.857]],
  ];
  // Ridges higher than the summer marine layer, drawn as soft shaded bands.
  const RIDGES = [
    [[-122.78, 37.98], [-122.66, 37.94], [-122.58, 37.91], [-122.52, 37.86]],
    [[-122.47, 37.765], [-122.445, 37.752]],
    [[-122.45, 37.69], [-122.41, 37.688]],
    [[-122.47, 37.60], [-122.40, 37.52], [-122.30, 37.42], [-122.18, 37.32], [-122.06, 37.25]],
    [[-122.31, 37.98], [-122.24, 37.89], [-122.15, 37.79], [-122.05, 37.67], [-121.93, 37.53]],
    [[-122.00, 37.94], [-121.91, 37.88], [-121.83, 37.82]],
    [[-121.86, 37.74], [-121.74, 37.58], [-121.62, 37.42]],
    [[-122.58, 38.32], [-122.48, 38.22], [-122.43, 38.17]],
    [[-122.17, 38.32], [-122.09, 38.20]],
  ];
  // Where the sea air flows on a summer afternoon. `coast` = index of the
  // point where the stream reaches land.
  const STREAMS = [
    { id: 'sf', w: 0.6, fog: 1, coast: 2, pts: [[-122.82, 37.76], [-122.62, 37.763], [-122.51, 37.765], [-122.45, 37.772], [-122.40, 37.786]] },
    { id: 'east', w: 1, fog: 0.75, coast: 2, pts: [[-122.86, 37.80], [-122.66, 37.814], GATE, [-122.42, 37.835], [-122.36, 37.85], [-122.29, 37.87], [-122.22, 37.885]] },
    { id: 'delta', w: 1.3, fog: 0.45, coast: 2, pts: [[-122.86, 37.83], [-122.66, 37.83], GATE, [-122.44, 37.86], [-122.40, 37.93], [-122.33, 38.01], [-122.23, 38.055], [-122.12, 38.04], [-121.98, 38.06], [-121.80, 38.04], [-121.56, 38.08]] },
    { id: 'south', w: 1, fog: 0.45, coast: 2, pts: [[-122.86, 37.79], [-122.66, 37.81], GATE, [-122.41, 37.80], [-122.37, 37.74], [-122.33, 37.64], [-122.26, 37.565], [-122.15, 37.50], [-122.02, 37.44], [-121.90, 37.36]] },
    { id: 'se', w: 0.8, fog: 0.55, coast: 2, pts: [[-122.86, 37.80], [-122.66, 37.812], GATE, [-122.40, 37.815], [-122.32, 37.79], [-122.24, 37.74], [-122.17, 37.67], [-122.08, 37.62]] },
    { id: 'north', w: 0.6, fog: 0.5, coast: 2, pts: [[-122.86, 37.82], [-122.66, 37.825], GATE, [-122.45, 37.86], [-122.46, 37.92], [-122.49, 37.98], [-122.50, 38.05]] },
    { id: 'petaluma', w: 0.5, fog: 0.5, coast: 1, pts: [[-123.10, 38.27], [-122.98, 38.27], [-122.82, 38.26], [-122.66, 38.23], [-122.55, 38.17], [-122.45, 38.13], [-122.35, 38.12]] },
    { id: 'sanbruno', w: 0.5, fog: 0.9, coast: 2, pts: [[-122.80, 37.63], [-122.60, 37.632], [-122.495, 37.632], [-122.44, 37.635], [-122.38, 37.625], [-122.30, 37.60]] },
  ];

  // ---------- Climate model ----------
  // Rounded normals (high, low °C) and an illustrative daily cycle.
  const STATIONS = [
    { id: 'ocean', at: [-122.505, 37.76], dx: -9, dy: 10, anchor: 'end', peak: 13, coast: true },
    { id: 'dt', at: [-122.405, 37.787], dx: 0, dy: 20, anchor: 'middle', peak: 14 },
    { id: 'saus', at: [-122.485, 37.857], dx: -9, dy: -12, anchor: 'end', peak: 14 },
    { id: 'hmb', at: [-122.43, 37.463], dx: 9, anchor: 'start', peak: 13, coast: true },
    { id: 'berk', at: [-122.27, 37.871], dx: 9, anchor: 'start', peak: 14.5 },
    { id: 'oak', at: [-122.27, 37.805], dx: 9, dy: 8, anchor: 'start', peak: 14.5 },
    { id: 'rich', at: [-122.345, 37.937], dx: -9, dy: -6, anchor: 'end', peak: 14.5 },
    { id: 'sr', at: [-122.53, 37.974], dx: -9, anchor: 'end', peak: 15.5 },
    { id: 'napa', at: [-122.29, 38.30], dx: 9, dy: 10, anchor: 'start', peak: 16 },
    { id: 'wc', at: [-122.065, 37.905], dx: 9, dy: 10, anchor: 'start', peak: 16 },
    { id: 'conc', at: [-122.03, 37.978], dx: 9, dy: -8, anchor: 'start', peak: 16 },
    { id: 'liv', at: [-121.77, 37.682], dx: 9, anchor: 'start', peak: 16 },
    { id: 'sj', at: [-121.89, 37.338], dx: 9, anchor: 'start', peak: 15.5 },
    { id: 'sm', at: [-122.325, 37.563], dx: -9, anchor: 'end', peak: 15 },
    { id: 'fre', at: [-121.99, 37.548], dx: 9, anchor: 'start', peak: 15.5 },
    { id: 'hay', at: [-122.08, 37.669], dx: 9, anchor: 'start', peak: 15 },
  ];
  const SAC = { id: 'sac', peak: 16.5 };
  const SEASONS = {
    jul: {
      temps: { ocean: [18, 12], dt: [20, 13], saus: [21, 12], hmb: [18, 11], berk: [21, 12], oak: [22, 13], rich: [22, 12],
        sr: [28, 12], napa: [28, 11], wc: [31, 13], conc: [32, 14], liv: [32, 13], sj: [28, 14], sm: [24, 12],
        fre: [27, 13], hay: [24, 13], sac: [34, 15] },
      sst: 12, inv: 420, fog: 1, aloft: 26,
    },
    sep: {
      temps: { ocean: [20, 12], dt: [22, 13.5], saus: [23, 12], hmb: [20, 11], berk: [23, 12], oak: [24, 13], rich: [24, 12],
        sr: [29, 11], napa: [29, 10], wc: [30, 12], conc: [31, 13], liv: [30, 12], sj: [28, 14], sm: [25, 12],
        fre: [27, 12], hay: [25, 12], sac: [32, 14] },
      sst: 14.5, inv: 300, fog: 0.55, aloft: 28,
    },
    jan: {
      temps: { ocean: [14, 8], dt: [14.5, 8], saus: [14, 7], hmb: [15, 6], berk: [14, 7], oak: [14, 7], rich: [14, 7],
        sr: [14, 5], napa: [14, 3], wc: [13.5, 3.5], conc: [14, 4], liv: [14, 3], sj: [15.5, 6], sm: [15, 6],
        fre: [15, 6], hay: [14.5, 6], sac: [13.5, 3.5] },
      sst: 12, inv: 0, fog: 0, aloft: 0,
    },
  };

  // How far inland the fog reaches over a July day: < 0.35 offshore, 1 = deepest.
  const FOG_KNOTS = [[0, 0.86], [4, 0.95], [7, 1], [9, 0.82], [11, 0.5], [13, 0.37], [15, 0.42],
    [17, 0.62], [19, 0.8], [21, 0.86], [24, 0.86]];

  function interp(knots, x) {
    for (let i = 1; i < knots.length; i++) {
      if (x <= knots[i][0]) {
        const [x0, y0] = knots[i - 1];
        const [x1, y1] = knots[i];
        return lerp(y0, y1, smooth((x - x0) / (x1 - x0)));
      }
    }
    return knots[knots.length - 1][1];
  }

  function diurnal(h, peak) {
    if (h >= 6 && h <= peak) return 0.5 - 0.5 * Math.cos(Math.PI * (h - 6) / (peak - 6));
    const tt = h < 6 ? h + 24 : h;
    return 0.5 + 0.5 * Math.cos(Math.PI * (tt - peak) / (30 - peak));
  }

  const fogReach = (season, h) => {
    if (!SEASONS[season].fog) return -1;
    const f = interp(FOG_KNOTS, h);
    return season === 'jul' ? f : Math.max(0, f * 0.85 - 0.15);
  };
  const invHeight = (season, h) => {
    const s = SEASONS[season];
    return s.inv ? s.inv + 110 * Math.cos(2 * Math.PI * (h - 5) / 24) : 0;
  };
  const stationTemp = (season, st, h) => {
    const [hi, lo] = SEASONS[season].temps[st.id];
    return lo + (hi - lo) * diurnal(h, st.peak);
  };

  let season = 'jul';
  let hour = 16;
  let focus = 0;

  function sunAlt(h) {
    const [rise, set] = season === 'jan' ? [7.4, 17.2] : season === 'sep' ? [6.9, 19.2] : [5.9, 20.5];
    if (h < rise || h > set) return -Math.min(h < rise ? rise - h : h - set, 1.5) / 1.5;
    return Math.sin(Math.PI * (h - rise) / (set - rise));
  }

  // ---------- Map drawing ----------
  const ptsAttr = (list) => list.map((p) => px(p).map((v) => v.toFixed(1)).join(',')).join(' ');

  // Catmull-Rom through the points, as a cubic Bézier path.
  function smoothPath(list) {
    const P = list.map(px);
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function buildMap() {
    const water = $('water');
    water.appendChild(svgEl('polygon', { points: ptsAttr(OCEAN), class: 'ocean' }));
    water.appendChild(svgEl('polygon', { points: ptsAttr(BAY), class: 'bay' }));
    for (const isl of ISLANDS) water.appendChild(svgEl('polygon', { points: ptsAttr(isl), class: 'island' }));
    // Golden Gate Bridge
    const [a, b] = [px([-122.4785, 37.8325]), px([-122.4775, 37.8065])];
    water.appendChild(svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'bridge' }));

    const up = $('upwell');
    up.appendChild(svgEl('path', { d: smoothPath(OCEAN.slice(3, 33).map(([lo, la]) => [lo - 0.035, la])), class: 'upwell-band' }));

    const ridges = $('ridges');
    for (const r of RIDGES) {
      ridges.appendChild(svgEl('path', { d: smoothPath(r), class: 'ridge-shade', filter: 'url(#ridge-blur)' }));
      ridges.appendChild(svgEl('path', { d: smoothPath(r), class: 'ridge-line' }));
    }

    // streams: hidden paths used for fog and particles
    const fogG = $('fog-g');
    fogG.appendChild(svgEl('path', { id: 'fog-bank', d: smoothPath(OCEAN.slice(2, 34).map(([lo, la]) => [lo - 0.09, la])), class: 'fog-bank' }));
    for (const s of STREAMS) {
      const path = svgEl('path', { d: smoothPath(s.pts), class: 'fog-stream' });
      fogG.appendChild(path);
      s.path = path;
      s.len = path.getTotalLength();
      const off = svgEl('path', { d: smoothPath(s.pts.slice(0, s.coast + 1)) });
      fogG.appendChild(off);
      s.offFrac = off.getTotalLength() / s.len;
      off.remove();
      s.samples = [];
      for (let i = 0; i <= 200; i++) {
        const p = path.getPointAtLength(s.len * i / 200);
        s.samples.push([p.x, p.y]);
      }
      s.parts = [];
    }

    const cur = $('current');
    const [c0, c1] = [px([-123.07, 38.12]), px([-122.98, 37.30])];
    cur.appendChild(svgEl('path', { d: `M${c0[0]},${c0[1]} L${c1[0]},${c1[1]}`, class: 'arrow cold big', 'marker-end': 'url(#arr-cold)' }));

    const valley = $('valley');
    const v0 = px([-121.80, 37.86]);
    valley.appendChild(svgEl('rect', { x: v0[0] - 6, y: 0, width: W - v0[0] + 6, height: H, class: 'valley-glow' }));
    for (const [lon, lat] of [[-121.62, 37.95], [-121.62, 37.62], [-121.75, 38.22]]) {
      const [x, y] = px([lon, lat]);
      valley.appendChild(svgEl('path', { d: `M${x - 60},${y} L${x + 30},${y}`, class: 'arrow hot', 'marker-end': 'url(#arr-hot)' }));
    }

    const comp = $('compass-g');
    comp.appendChild(svgEl('path', { d: 'M30,40 l8,-22 l8,22 l-8,-6 z', class: 'compass' }));
    comp.appendChild(svgEl('text', { x: 38, y: 58, class: 'map-label', 'text-anchor': 'middle' }, 'N'));
  }

  // Labels that change with language.
  const WATER_LABELS = [
    ['map.pacific', [-122.95, 37.55], 'water-label big'],
    ['map.bay', [-122.25, 37.63], 'water-label'],
    ['map.sanpablo', [-122.38, 38.07], 'water-label'],
    ['map.carquinez', [-122.08, 38.085], 'water-label small'],
    ['map.delta', [-121.72, 38.11], 'water-label small'],
  ];
  const VENTS = [
    ['map.gate', GATE, 1],
    ['map.petaluma', [-122.72, 38.245], 0.6],
    ['map.sanbruno', [-122.47, 37.632], 0.6],
  ];

  function buildLabels() {
    const wl = $('water-labels');
    wl.textContent = '';
    for (const [key, at, cls] of WATER_LABELS) {
      const [x, y] = px(at);
      wl.appendChild(svgEl('text', { x, y, class: cls, 'text-anchor': 'middle' }, t(key)));
    }
    const up = $('upwell');
    up.querySelectorAll('text').forEach((n) => n.remove());
    const [ux, uy] = px([-122.62, 37.40]);
    up.appendChild(svgEl('text', { x: ux, y: uy, class: 'map-label cold-text', 'text-anchor': 'middle' }, t('map.upwell')));

    const ridges = $('ridges');
    ridges.querySelectorAll('text').forEach((n) => n.remove());
    for (const [key, at] of [['map.scm', [-122.20, 37.31]], ['map.ebh', [-122.03, 37.80]], ['map.tam', [-122.74, 37.935]]]) {
      const [x, y] = px(at);
      ridges.appendChild(svgEl('text', { x, y, class: 'map-label ridge-text', 'text-anchor': 'middle' }, t(key)));
    }

    const cur = $('current');
    cur.querySelectorAll('text').forEach((n) => n.remove());
    const [cx, cy] = px([-123.02, 37.70]);
    cur.appendChild(svgEl('text', { x: cx, y: cy, class: 'map-label cold-text' }, t('map.current')));
    cur.appendChild(svgEl('text', { x: cx, y: cy + 16, class: 'map-label small cold-text' }, t('map.currentSub')));

    const valley = $('valley');
    valley.querySelectorAll('text').forEach((n) => n.remove());
    const vy = px([0, 37.80])[1];
    valley.appendChild(svgEl('text', { x: W - 12, y: vy, class: 'map-label hot-text', 'text-anchor': 'end' }, t('map.valley')));
    valley.appendChild(svgEl('text', { x: W - 12, y: vy + 16, class: 'map-label small hot-text', 'text-anchor': 'end' }, t('map.valleySub')));

    const vents = $('vents');
    vents.textContent = '';
    for (const [key, at, size] of VENTS) {
      const [x, y] = px(at);
      vents.appendChild(svgEl('circle', { cx: x, cy: y, r: 16 * size, class: 'vent-ring' }));
      vents.appendChild(svgEl('circle', { cx: x, cy: y, r: 16 * size, class: 'vent-ring pulse' }));
      const big = size === 1;
      vents.appendChild(svgEl('text', { x: big ? x - 22 : x, y: big ? y - 2 : y - 20 * size - 4, class: `map-label vent-text${big ? '' : ' small'}`, 'text-anchor': big ? 'end' : 'middle' }, t(key)));
    }

    const places = $('places');
    places.textContent = '';
    for (const st of STATIONS) {
      const [x, y] = px(st.at);
      const g = svgEl('g', { class: 'place' });
      g.appendChild(svgEl('circle', { cx: x, cy: y, r: 4, class: 'place-dot' }));
      const tx = x + st.dx, ty = y + (st.dy || 0);
      g.appendChild(svgEl('text', { x: tx, y: ty - 3, class: 'place-name', 'text-anchor': st.anchor }, t('place.' + st.id)));
      g.appendChild(svgEl('text', { x: tx, y: ty + 14, class: 'place-temp', 'text-anchor': st.anchor, id: 'temp-' + st.id }));
      places.appendChild(g);
    }
    // Sacramento is off the map to the north-east.
    const g = svgEl('g', { class: 'place' });
    g.appendChild(svgEl('rect', { x: W - 150, y: 12, width: 138, height: 46, rx: 8, class: 'sac-box' }));
    g.appendChild(svgEl('text', { x: W - 81, y: 31, class: 'place-name', 'text-anchor': 'middle' }, t('place.sacOff')));
    g.appendChild(svgEl('text', { x: W - 81, y: 50, class: 'place-temp', 'text-anchor': 'middle', id: 'temp-sac' }));
    places.appendChild(g);
  }

  // ---------- Heat map (inverse-distance weighting between stations) ----------
  const GRID = 4;
  const GW = Math.ceil(W / GRID), GH = Math.ceil(H / GRID);
  // Every cell is coloured; the SVG water drawn on top hides the sea.
  const off = document.createElement('canvas');
  off.width = GW; off.height = GH;

  const SCALE = [[10, [59, 92, 170]], [14, [80, 150, 210]], [18, [120, 200, 205]], [22, [215, 215, 120]],
    [26, [245, 175, 80]], [30, [238, 110, 60]], [34, [200, 45, 55]], [38, [150, 20, 60]]];
  function heatColour(c) {
    if (c <= SCALE[0][0]) return SCALE[0][1];
    for (let i = 1; i < SCALE.length; i++) {
      if (c <= SCALE[i][0]) {
        const f = (c - SCALE[i - 1][0]) / (SCALE[i][0] - SCALE[i - 1][0]);
        return SCALE[i][1].map((v, k) => lerp(SCALE[i - 1][1][k], v, f));
      }
    }
    return SCALE[SCALE.length - 1][1];
  }

  const COAST_ANCHORS = [[-122.99, 38.20], [-122.92, 38.06], [-122.72, 37.92], [-122.55, 37.85], [-122.50, 37.70],
    [-122.50, 37.58], [-122.44, 37.42], [-122.40, 37.28]];
  let heatKey = '';
  function renderHeat() {
    const key = `${season}|${hour.toFixed(2)}|${focus}`;
    if (key === heatKey) return;
    heatKey = key;
    const pts = STATIONS.map((st) => [...px(st.at), stationTemp(season, st, hour)]);
    const coastT = stationTemp(season, STATIONS[0], hour);
    for (const a of COAST_ANCHORS) pts.push([...px(a), coastT - 0.5]);
    const sacT = stationTemp(season, SAC, hour);
    for (const a of [[-121.40, 38.30], [-121.40, 37.80], [-121.45, 37.45]]) pts.push([...px(a), sacT]);
    pts.push([...px([-121.45, 38.06]), sacT - 4]); // the Delta breeze keeps the Delta milder

    const ctx = off.getContext('2d');
    const img = ctx.createImageData(GW, GH);
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const idx = j * GW + i;
        const x = (i + 0.5) * GRID, y = (j + 0.5) * GRID;
        let num = 0, den = 0;
        for (const [sx, sy, st] of pts) {
          const d2 = (sx - x) ** 2 + (sy - y) ** 2 + 60;
          const w = 1 / (d2 * d2);
          num += w * st; den += w;
        }
        const [r, g, b] = heatColour(num / den);
        img.data[idx * 4] = r; img.data[idx * 4 + 1] = g; img.data[idx * 4 + 2] = b; img.data[idx * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const canvas = $('heat');
    const c2 = canvas.getContext('2d');
    c2.clearRect(0, 0, W, H);
    c2.fillStyle = '#2b2c26';
    c2.fillRect(0, 0, W, H);
    c2.imageSmoothingEnabled = true;
    c2.globalAlpha = 0.78;
    c2.drawImage(off, 0, 0, W, H);
    c2.globalAlpha = 1;
  }

  function renderHeatScale() {
    const stops = SCALE.map(([c, rgb], i) => `rgb(${rgb.map(Math.round).join(',')}) ${(i / (SCALE.length - 1) * 100).toFixed(0)}%`);
    $('heat-scale').innerHTML = `<div class="hs-bar" style="background:linear-gradient(90deg,${stops.join(',')})"></div>` +
      `<div class="hs-ticks">${SCALE.filter((_, i) => i % 2 === 0 || i === SCALE.length - 1).map(([c]) => `<span>${fmtT(c)}</span>`).join('')}</div>`;
  }

  // ---------- Fog + wind ----------
  function renderFog(reach, breezeStrength) {
    const bank = $('fog-bank');
    if (reach < 0) {
      bank.style.display = 'none';
      STREAMS.forEach((s) => { s.path.style.display = 'none'; });
      return;
    }
    bank.style.display = '';
    bank.style.strokeWidth = (40 + 90 * reach).toFixed(0);
    bank.style.opacity = (0.55 + 0.35 * reach).toFixed(2);
    for (const s of STREAMS) {
      const offshore = clamp(reach / 0.35, 0, 1);
      const land = clamp((reach - 0.35) / 0.65, 0, 1) * s.fog;
      const frac = reach < 0.35 ? s.offFrac * offshore : s.offFrac + (1 - s.offFrac) * land;
      s.path.style.display = '';
      s.path.style.strokeDasharray = `${(frac * s.len).toFixed(1)} ${s.len.toFixed(1)}`;
      s.path.style.strokeWidth = (26 + 30 * reach * Math.max(s.w, 0.6)).toFixed(0);
    }
  }

  let breeze = 0;
  function stepParticles(dt) {
    const g = $('particles');
    for (const s of STREAMS) {
      const want = Math.round(breeze * s.w * 14);
      while (s.parts.length < want) {
        const c = svgEl('circle', { r: 3, class: 'particle' });
        g.appendChild(c);
        s.parts.push({ t: Math.random(), el: c });
      }
      while (s.parts.length > want) s.parts.pop().el.remove();
      const speed = (0.05 + 0.12 * breeze) * (300 / s.len);
      for (const p of s.parts) {
        p.t += dt * speed;
        if (p.t > 1) p.t -= 1;
        const [x, y] = s.samples[Math.floor(p.t * 200)];
        p.el.setAttribute('cx', x.toFixed(1));
        p.el.setAttribute('cy', y.toFixed(1));
        // the air warms once it is over land
        const warm = clamp((p.t - s.offFrac) / (1 - s.offFrac), 0, 1);
        const [r, gg, b] = [lerp(150, 255, warm), lerp(215, 170, warm), lerp(255, 110, warm)];
        p.el.setAttribute('fill', `rgb(${r | 0},${gg | 0},${b | 0})`);
        p.el.setAttribute('opacity', (Math.min(p.t * 8, 1, (1 - p.t) * 8)).toFixed(2));
      }
    }
  }

  const fmtClock = (h) => {
    const d = new Date(2026, 6, 1, Math.floor(h), Math.round((h % 1) * 60));
    return d.toLocaleTimeString(I18n.locale, { hour: 'numeric', minute: '2-digit' });
  };

  function captionKey() {
    if (season !== 'jul') return 'cap.' + season;
    if (hour < 6 || hour >= 22) return 'cap.jul.night';
    if (hour < 10.5) return 'cap.jul.morning';
    if (hour < 14) return 'cap.jul.midday';
    if (hour < 18) return 'cap.jul.afternoon';
    return 'cap.jul.evening';
  }

  function renderSection() {
    const s = SEASONS[season];
    const alt = sunAlt(hour);
    $('night').style.opacity = (clamp(-alt, 0, 1) * 0.45 + (alt >= 0 && alt < 0.15 ? (0.15 - alt) : 0)).toFixed(2);

    renderHeat();
    const reach = fogReach(season, hour);
    const sacT = stationTemp(season, SAC, hour);
    breeze = season === 'jan' ? 0.12 : clamp((sacT - stationTemp(season, STATIONS[0], hour)) / 16, 0.1, 1);
    renderFog(reach, breeze);
    $('upwell').style.display = season === 'jan' ? 'none' : '';
    $('valley').style.opacity = focus === 4 ? '' : clamp((sacT - 20) / 12, 0.15, 1).toFixed(2);

    for (const st of [...STATIONS, SAC]) {
      const temp = stationTemp(season, st, hour);
      const el = $('temp-' + st.id);
      el.textContent = fmtT(temp);
    }
    $('map-clock').textContent = fmtClock(hour);
    $('map-season').textContent = t('season.' + season);
    $('xs-caption').textContent = t(captionKey());
    $('hour').value = hour;
    document.querySelectorAll('#season button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.season === season);
      btn.setAttribute('aria-pressed', btn.dataset.season === season);
    });
    if (reduceMotion || !animating) stepParticles(0);
    renderProfile(invHeight(season, hour));
  }

  // ---------- Steps ----------
  function renderSteps() {
    const svg = $('map');
    svg.classList.toggle('focusing', focus > 0);
    svg.querySelectorAll('.hl').forEach((g) => g.classList.toggle('on', +g.dataset.step === focus));
    document.querySelectorAll('#step-btns button').forEach((btn) => {
      btn.classList.toggle('active', +btn.dataset.step === focus);
      btn.setAttribute('aria-selected', +btn.dataset.step === focus);
    });
    $('step-h').textContent = t(`step.${focus}.h`);
    $('step-body').innerHTML = t(`step.${focus}.p`);
    fillTemps($('step-body'));
  }

  $('step-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    focus = +btn.dataset.step;
    // Show each ingredient at its clearest: a July afternoon.
    if (focus && season !== 'jul') season = 'jul';
    if ((focus === 4 || focus === 5) && (hour < 14 || hour > 19)) hour = 16;
    renderSection();
    renderSteps();
  });

  // ---------- Inversion profile ----------
  function renderProfile(inv) {
    const svg = $('profile');
    [...svg.querySelectorAll(':not(title)')].forEach((n) => n.remove());
    const X0 = 46, X1 = 300, Y0 = 262, Y1 = 20;
    const TMIN = 0, TMAX = 36, HMAX = 1500;
    const pxT = (c) => X0 + (c - TMIN) / (TMAX - TMIN) * (X1 - X0);
    const py = (m) => Y0 - m / HMAX * (Y0 - Y1);

    for (let m = 0; m <= HMAX; m += 500) {
      svg.appendChild(svgEl('line', { x1: X0, x2: X1, y1: py(m), y2: py(m), class: 'grid' }));
      svg.appendChild(svgEl('text', { x: X0 - 6, y: py(m) + 4, class: 'axis', 'text-anchor': 'end' }, `${m} m`));
    }
    for (let c = 0; c <= 30; c += 10) {
      svg.appendChild(svgEl('text', { x: pxT(c), y: Y0 + 18, class: 'axis', 'text-anchor': 'middle' }, fmtT(c)));
    }
    svg.appendChild(svgEl('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, class: 'axis-line' }));

    const s = SEASONS[season];
    const surf = stationTemp(season, STATIONS[0], hour);
    let pts;
    if (inv > 0) {
      const topT = surf - 6 * inv / 1000;
      const lidTop = inv + 120;
      pts = [[surf, 0], [topT, inv], [s.aloft, lidTop], [s.aloft - 6.5 * (HMAX - lidTop) / 1000, HMAX]];
      svg.appendChild(svgEl('rect', { x: X0, width: X1 - X0, y: py(inv), height: py(0) - py(inv), class: 'marine-band' }));
      svg.appendChild(svgEl('rect', { x: X0, width: X1 - X0, y: py(lidTop), height: py(inv) - py(lidTop), class: 'inv-band' }));
      svg.appendChild(svgEl('text', { x: X1 - 6, y: py(inv / 2) + 4, class: 'band-label cold-text', 'text-anchor': 'end' }, t('prof.marine')));
      svg.appendChild(svgEl('text', { x: X1 - 6, y: py(inv + 60) + 4, class: 'band-label warm-text', 'text-anchor': 'end' }, t('prof.inv')));
      svg.appendChild(svgEl('text', { x: pxT(s.aloft) + 8, y: py(1050), class: 'band-label warm-text' }, t('prof.warm')));
    } else {
      pts = [[surf, 0], [surf - 6.5 * HMAX / 1000, HMAX]];
      svg.appendChild(svgEl('text', { x: X1 - 6, y: py(1200), class: 'band-label', 'text-anchor': 'end' }, t('prof.normal')));
    }
    svg.appendChild(svgEl('polyline', { points: pts.map(([c, m]) => `${pxT(c).toFixed(1)},${py(m).toFixed(1)}`).join(' '), class: 'profile-line' }));
    svg.appendChild(svgEl('circle', { cx: pxT(surf), cy: py(0), r: 4, class: 'profile-dot' }));
  }

  // ---------- Animation: particles always drift; Play also advances the clock ----------
  let playing = false;
  let animating = false;
  let lastTs = 0;
  const HOURS_PER_SEC = 1.4;

  function frame(ts) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
    lastTs = ts;
    if (playing) {
      hour = (hour + dt * HOURS_PER_SEC) % 24;
      renderSection();
    }
    stepParticles(dt);
    requestAnimationFrame(frame);
  }
  function startAnimation() {
    if (reduceMotion || animating) return;
    animating = true;
    requestAnimationFrame(frame);
  }
  function setPlaying(on) {
    playing = on;
    const btn = $('day-play');
    btn.dataset.i18n = on ? 'pause' : 'play';
    btn.textContent = t(btn.dataset.i18n);
    if (on && reduceMotion) {
      // No animation: jump through the day in steps instead.
      const timer = setInterval(() => {
        if (!playing) return clearInterval(timer);
        hour = (hour + 1) % 24;
        renderSection();
      }, 600);
    }
  }
  $('day-play').addEventListener('click', () => setPlaying(!playing));
  $('hour').addEventListener('input', (e) => { setPlaying(false); hour = +e.target.value; renderSection(); });
  $('season').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    season = btn.dataset.season;
    renderSection();
  });

  // ---------- "AC vent" chart: July afternoon high vs distance from the Gate ----------
  const GROUPS = {
    south: ['dt', 'sm', 'hay', 'fre', 'sj'],
    east: ['berk', 'oak', 'wc', 'conc', 'liv'],
    north: ['saus', 'rich', 'sr', 'napa'],
    coast: ['ocean', 'hmb'],
  };
  // label offsets [dx, dy, anchor] so neighbouring points don't collide
  const VENT_LABELS = {
    dt: [7, 15, 'start'], saus: [-7, -7, 'end'], rich: [0, -10, 'middle'], berk: [8, 15, 'start'],
    oak: [10, 4, 'start'], sm: [0, -10, 'middle'], hay: [0, 18, 'middle'], wc: [-8, 4, 'end'],
    conc: [0, -10, 'middle'], liv: [0, -10, 'middle'], napa: [0, -10, 'middle'], fre: [0, 18, 'middle'],
    sr: [0, -10, 'middle'], sj: [0, -10, 'middle'], ocean: [0, 18, 'middle'], hmb: [0, 18, 'middle'],
  };
  const GROUP_COLOURS = { south: '#6cc6ff', east: '#ff9f6b', north: '#c9a0ff', coast: '#7fe0c0' };
  function kmFromGate([lon, lat]) {
    const dx = (lon - GATE[0]) * 111.32 * Math.cos(37.8 * Math.PI / 180);
    const dy = (lat - GATE[1]) * 110.57;
    return Math.hypot(dx, dy);
  }
  function renderVent() {
    const svg = $('vent-chart');
    [...svg.querySelectorAll(':not(title)')].forEach((n) => n.remove());
    const X0 = 44, X1 = 404, Y0 = 262, Y1 = 14;
    const KMAX = 80, TMIN = 16, TMAX = 34;
    const x = (km) => X0 + km / KMAX * (X1 - X0);
    const y = (c) => Y0 - (c - TMIN) / (TMAX - TMIN) * (Y0 - Y1);
    for (let c = 16; c <= 34; c += 4) {
      svg.appendChild(svgEl('line', { x1: X0, x2: X1, y1: y(c), y2: y(c), class: 'grid' }));
      svg.appendChild(svgEl('text', { x: X0 - 6, y: y(c) + 4, class: 'axis', 'text-anchor': 'end' }, fmtT(c)));
    }
    for (let km = 0; km <= KMAX; km += 20) {
      svg.appendChild(svgEl('text', { x: x(km), y: Y0 + 18, class: 'axis', 'text-anchor': 'middle' }, `${km} km`));
    }
    svg.appendChild(svgEl('line', { x1: X0, x2: X1, y1: Y0, y2: Y0, class: 'axis-line' }));
    const temps = SEASONS.jul.temps;
    for (const [grp, ids] of Object.entries(GROUPS)) {
      const pts = ids.map((id) => {
        const st = STATIONS.find((s) => s.id === id);
        return { id, km: kmFromGate(st.at), c: temps[id][0] };
      }).sort((a, b) => a.km - b.km);
      if (grp !== 'coast') {
        svg.appendChild(svgEl('polyline', { points: pts.map((p) => `${x(p.km).toFixed(1)},${y(p.c).toFixed(1)}`).join(' '), class: 'vent-line', stroke: GROUP_COLOURS[grp] }));
      }
      for (const p of pts) {
        const dot = svgEl('circle', { cx: x(p.km), cy: y(p.c), r: 5, fill: GROUP_COLOURS[grp], class: 'vent-dot' });
        dot.appendChild(svgEl('title', {}, `${t('place.' + p.id)}: ${Math.round(p.km)} km, ${fmtT(p.c)}`));
        svg.appendChild(dot);
        const [dx, dy, anchor] = VENT_LABELS[p.id];
        svg.appendChild(svgEl('text', { x: x(p.km) + dx, y: y(p.c) + dy, class: 'vent-name', 'text-anchor': anchor }, t('place.' + p.id)));
      }
    }
    $('vent-legend').innerHTML = Object.keys(GROUPS)
      .map((g) => `<span><i class="sw" style="background:${GROUP_COLOURS[g]}"></i>${t('vent.' + g)}</span>`).join('');
  }

  // ---------- Climate chart ----------
  // Rounded monthly normals: average high °C, average low °C, rain mm.
  const CITIES = {
    sf: { south: false, cur: 'cal',
      hi: [14.4, 16.1, 16.8, 17.6, 18.4, 19.7, 19.6, 20.1, 21.4, 21.1, 17.8, 14.6],
      lo: [8.0, 8.8, 9.3, 9.9, 11.0, 12.2, 13.0, 13.6, 13.5, 12.4, 10.1, 8.1],
      rain: [114, 114, 81, 36, 15, 4, 0, 1, 2, 26, 63, 111] },
    sac: { south: false, cur: 'none',
      hi: [13.6, 16.8, 19.6, 22.6, 27.4, 31.6, 34.3, 33.8, 31.6, 25.8, 18.4, 13.3],
      lo: [3.6, 5.0, 6.6, 8.2, 11.4, 14.0, 15.4, 15.0, 13.6, 10.2, 5.9, 3.2],
      rain: [93, 89, 70, 32, 15, 4, 0, 1, 4, 24, 55, 85] },
    valpo: { south: true, cur: 'hum',
      hi: [22.2, 22.2, 21.2, 19.4, 17.8, 16.5, 16.1, 16.3, 17.0, 18.3, 19.8, 21.4],
      lo: [13.3, 13.4, 12.5, 11.0, 9.9, 8.8, 8.3, 8.4, 9.1, 10.1, 11.4, 12.6],
      rain: [0, 0, 4, 16, 61, 85, 82, 52, 19, 8, 2, 1] },
    lima: { south: true, cur: 'hum',
      hi: [26.5, 27.2, 26.8, 25.0, 22.7, 20.6, 19.6, 19.3, 19.6, 20.8, 22.6, 24.6],
      lo: [20.3, 20.8, 20.4, 18.7, 17.3, 16.3, 15.8, 15.6, 15.6, 16.2, 17.4, 18.8],
      rain: [1, 0.5, 0.5, 0, 0.5, 1, 1.5, 1.5, 1, 0.5, 0.3, 0.5] },
    cpt: { south: true, cur: 'ben',
      hi: [26.1, 26.5, 25.4, 23.0, 20.7, 18.5, 18.0, 18.5, 19.6, 21.7, 23.6, 25.0],
      lo: [15.7, 15.6, 14.2, 11.9, 9.4, 7.7, 7.0, 7.5, 8.7, 10.6, 13.0, 14.9],
      rain: [15, 17, 20, 41, 69, 93, 82, 77, 40, 30, 14, 17] },
    ess: { south: false, cur: 'can',
      hi: [18.5, 19.0, 20.0, 20.5, 21.5, 22.5, 23.0, 23.0, 23.5, 23.0, 21.0, 19.0],
      lo: [10, 11, 12.5, 13.5, 15, 16.5, 17.5, 17.5, 17, 15.5, 13, 11],
      rain: [52, 45, 41, 20, 7, 1, 0, 1, 4, 32, 58, 61] },
    swk: { south: true, cur: 'ben',
      hi: [21, 21.5, 21, 21, 21.5, 21.5, 19.5, 18, 17.5, 18, 19, 20],
      lo: [15, 15.5, 15, 13.5, 12, 10.5, 9.5, 9.5, 10.5, 11.5, 13, 14.5],
      rain: [1, 2, 3, 1, 1, 0, 0, 0, 1, 0, 0, 0] },
  };
  const CARD_ORDER = ['sac', 'valpo', 'lima', 'cpt', 'ess', 'swk'];
  let compareId = 'valpo';

  function buildChips() {
    const box = $('cities');
    box.textContent = '';
    for (const id of [...CARD_ORDER, 'none']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.city = id;
      b.textContent = id === 'none' ? t('al.none') : t('city.' + id);
      box.appendChild(b);
    }
  }
  $('cities').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    compareId = btn.dataset.city;
    renderChart();
  });
  $('align').addEventListener('change', renderChart);

  const series = (city, key) => {
    const arr = CITIES[city][key];
    return CITIES[city].south && $('align').checked ? arr.map((_, i) => arr[(i + 6) % 12]) : arr;
  };

  function renderChart() {
    const svg = $('chart');
    [...svg.querySelectorAll(':not(title)')].forEach((n) => n.remove());
    const X0 = 50, X1 = 740, TY0 = 220, TY1 = 16, RY0 = 318, RY1 = 250;
    const TMIN = 0, TMAX = 36;
    const months = t('months').split(',');
    const cw = (X1 - X0) / 12;
    const mx = (i) => X0 + cw * (i + 0.5);
    const ty = (c) => TY0 - (c - TMIN) / (TMAX - TMIN) * (TY0 - TY1);
    const cmp = compareId !== 'none' ? compareId : null;
    const maxRain = 120;
    const ry = (mm) => RY0 - Math.min(mm, maxRain) / maxRain * (RY0 - RY1);

    for (let c = 0; c <= 35; c += 5) {
      svg.appendChild(svgEl('line', { x1: X0, x2: X1, y1: ty(c), y2: ty(c), class: 'grid' }));
      if (c % 10 === 0) svg.appendChild(svgEl('text', { x: X0 - 8, y: ty(c) + 4, class: 'axis', 'text-anchor': 'end' }, fmtT(c)));
    }
    months.forEach((m, i) => {
      svg.appendChild(svgEl('text', { x: mx(i), y: RY0 + 18, class: 'axis', 'text-anchor': 'middle' }, m));
    });
    svg.appendChild(svgEl('text', { x: X0 - 8, y: RY1 + 10, class: 'axis', 'text-anchor': 'end' }, t('al.rain')));
    svg.appendChild(svgEl('line', { x1: X0, x2: X1, y1: RY0, y2: RY0, class: 'axis-line' }));

    // rain bars
    const ids = cmp ? ['sf', cmp] : ['sf'];
    ids.forEach((id, k) => {
      const rain = series(id, 'rain');
      const bw = cmp ? cw * 0.34 : cw * 0.5;
      rain.forEach((mm, i) => {
        const x = mx(i) - (cmp ? (k === 0 ? bw + 1 : -1) : bw / 2);
        svg.appendChild(svgEl('rect', { x, y: ry(mm), width: bw, height: RY0 - ry(mm), class: k === 0 ? 'bar-sf' : 'bar-cmp' }));
      });
    });

    // temperature bands
    const band = (id, cls) => {
      const hi = series(id, 'hi'), lo = series(id, 'lo');
      const top = hi.map((c, i) => `${mx(i).toFixed(1)},${ty(c).toFixed(1)}`);
      const bot = lo.map((c, i) => `${mx(i).toFixed(1)},${ty(c).toFixed(1)}`).reverse();
      svg.appendChild(svgEl('polygon', { points: [...top, ...bot].join(' '), class: `band ${cls}` }));
      svg.appendChild(svgEl('polyline', { points: top.join(' '), class: `line ${cls}` }));
      svg.appendChild(svgEl('polyline', { points: bot.reverse().join(' '), class: `line thin ${cls}` }));
      hi.forEach((c, i) => {
        const dot = svgEl('circle', { cx: mx(i), cy: ty(c), r: 3.2, class: `dot ${cls}` });
        dot.appendChild(svgEl('title', {}, `${t('city.' + id)} · ${months[i]}: ${fmtT(c)} / ${fmtT(lo[i])}`));
        svg.appendChild(dot);
      });
    };
    if (cmp) band(cmp, 'cmp');
    band('sf', 'sf');

    // legend + stats
    const legend = $('chart-legend');
    legend.innerHTML = `<span><i class="sw sw-sf"></i>${t('city.sf')}</span>` +
      (cmp ? `<span><i class="sw sw-cmp"></i>${t('city.' + cmp)} · ${t('cur.' + CITIES[cmp].cur)}</span>` : '');

    const stats = (id) => {
      const c = CITIES[id];
      const mean = c.hi.map((h, i) => (h + c.lo[i]) / 2);
      return {
        warm: Math.max(...c.hi), cool: Math.min(...c.hi),
        range: Math.max(...mean) - Math.min(...mean),
        rain: c.rain.reduce((a, b) => a + b, 0),
      };
    };
    const rows = [['warm', fmtT], ['cool', fmtT], ['range', fmtDT], ['rain', (mm) => `${Math.round(mm)} mm`]];
    const cols = cmp ? ['sf', cmp] : ['sf'];
    const st = cols.map(stats);
    $('compare').innerHTML = `<table><thead><tr><th></th>${cols.map((id, k) => `<th class="${k ? 'c-cmp' : 'c-sf'}">${t('city.' + id)}</th>`).join('')}</tr></thead><tbody>` +
      rows.map(([key, f]) => `<tr><th${key === 'range' ? ` title="${t('cmp.rangeTip')}"` : ''}>${t('cmp.' + key)}</th>${st.map((s) => `<td>${f(s[key])}</td>`).join('')}</tr>`).join('') +
      '</tbody></table>';

    document.querySelectorAll('#cities button').forEach((b) => {
      b.classList.toggle('active', b.dataset.city === compareId);
      b.setAttribute('aria-pressed', b.dataset.city === compareId);
    });
    $('align').closest('label').classList.toggle('disabled', !(cmp && CITIES[cmp].south));
  }

  function buildCards() {
    const box = $('alike-cards');
    box.textContent = '';
    for (const id of CARD_ORDER) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card alike';
      card.dataset.city = id;
      card.innerHTML = `<h3>${t('city.' + id)}</h3><div class="cur">${t('cur.' + CITIES[id].cur)}</div><p>${t('card.' + id)}</p>`;
      box.appendChild(card);
    }
  }
  $('alike-cards').addEventListener('click', (e) => {
    const card = e.target.closest('.alike');
    if (!card) return;
    compareId = card.dataset.city;
    renderChart();
    $('cities').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---------- Same latitude ----------
  const LAT = [
    ['sf', 37.8, 21.4, 8], ['lis', 38.7, 28.5, 7], ['seo', 37.6, 30.2, 7], ['dc', 38.9, 31.6, 6],
    ['ath', 38.0, 33.7, 6], ['sac', 38.6, 34.3, 6], ['sev', 37.4, 36.0, 6],
  ];
  function renderLat() {
    const months = t('months').split(',');
    const box = $('lat-bars');
    box.innerHTML = LAT.map(([id, lat, c, m]) => `
      <div class="lat-row${id === 'sf' ? ' is-sf' : ''}">
        <div class="lat-name">${t('lc.' + id)} <span>${lat.toFixed(1)}°N</span></div>
        <div class="lat-track"><div class="lat-bar" style="width:${(c / 38 * 100).toFixed(1)}%"><span>${fmtT(c)}</span></div></div>
        <div class="lat-month">${t('lat.month', { m: months[m] })}</div>
      </div>`).join('');
  }

  // ---------- Microclimates ----------
  const MICRO = [
    ['outer', 17, 'fog'], ['inner', 18, 'fog'], ['twin', 17, 'windy'], ['haight', 19.5, ''],
    ['marina', 19, 'windy'], ['soma', 21, ''], ['mission', 22.5, 'sunny'],
  ];
  function renderMicro() {
    $('micro').innerHTML = MICRO.map(([id, c, tag]) => {
      const f = clamp((c - 16) / 7, 0, 1);
      const hue = lerp(205, 35, f);
      return `<div class="nb" style="--h:${hue.toFixed(0)};--f:${f.toFixed(2)}">
        <div class="nb-temp">${fmtT(c)}</div>
        <div class="nb-bar"><div style="height:${(30 + f * 70).toFixed(0)}%"></div></div>
        <div class="nb-name">${t('nb.' + id)}</div>
        <div class="nb-tag">${tag ? t('nb.' + tag) : ''}</div>
      </div>`;
    }).join('');
  }

  // ---------- Wire up ----------
  function renderAll() {
    fillTemps();
    heatKey = '';
    renderHeatScale();
    renderSection();
    renderSteps();
    renderVent();
    renderChart();
    renderLat();
    renderMicro();
  }
  function buildLang() {
    buildChips();
    buildCards();
    buildLabels();
    const btn = $('day-play');
    btn.textContent = t(playing ? 'pause' : 'play');
    renderAll();
  }

  buildMap();
  I18n.onChange(buildLang);
  I18n.apply();
  buildLang();
  startAnimation();
})();
