// Shared Moon helpers: low-precision phase math + an SVG renderer.
//
// The math follows the short series in Jean Meeus, "Astronomical Algorithms".
// It's accurate to about half a degree of elongation, which puts new/full
// moon times within roughly an hour. That's plenty for a picture of the sky.
(function (global) {
  const RAD = Math.PI / 180;
  const SYNODIC_MONTH = 29.530588853; // days, new moon to new moon
  const DAY_MS = 86400000;

  const norm360 = (x) => ((x % 360) + 360) % 360;
  const wrap180 = (x) => { const v = norm360(x); return v > 180 ? v - 360 : v; };

  function daysSinceJ2000(date) {
    return date.getTime() / DAY_MS + 2440587.5 - 2451545.0;
  }

  // Ecliptic longitudes of the Sun and Moon, and the Moon's ecliptic latitude (degrees).
  function eclipticPositions(date) {
    const d = daysSinceJ2000(date);

    const M = (357.5291 + 0.98560028 * d) * RAD; // Sun's mean anomaly
    const sunLon = 280.4665 + 0.98564736 * d + 1.915 * Math.sin(M) + 0.020 * Math.sin(2 * M);

    const Lm = 218.3165 + 13.17639648 * d;        // Moon's mean longitude
    const Mm = (134.9634 + 13.06499295 * d) * RAD; // Moon's mean anomaly
    const D = (297.8502 + 12.19074912 * d) * RAD;  // mean elongation
    const F = (93.2721 + 13.22935024 * d) * RAD;   // argument of latitude
    const moonLon = Lm
      + 6.289 * Math.sin(Mm)
      + 1.274 * Math.sin(2 * D - Mm)
      + 0.658 * Math.sin(2 * D)
      + 0.214 * Math.sin(2 * Mm)
      - 0.186 * Math.sin(M)
      - 0.114 * Math.sin(2 * F);
    const moonLat = 5.128 * Math.sin(F)
      + 0.281 * Math.sin(Mm + F)
      + 0.278 * Math.sin(Mm - F)
      + 0.173 * Math.sin(2 * D - F);

    return { d, sunLon: norm360(sunLon), moonLon: norm360(moonLon), moonLat };
  }

  // Angle between the Moon and the Sun as seen from Earth, measured eastward
  // along the ecliptic (0 = new, 90 = first quarter, 180 = full, 270 = last quarter).
  function elongation(date) {
    const { sunLon, moonLon } = eclipticPositions(date);
    return norm360(moonLon - sunLon);
  }

  // Ecliptic -> horizon coordinates for an observer at (lat, lon) in degrees.
  // Returns altitude above the horizon and azimuth clockwise from north.
  function toHorizon(lon, lat, d, obsLat, obsLon) {
    const eps = (23.4393 - 0.0000004 * d) * RAD;
    const l = lon * RAD, b = lat * RAD;
    const ra = Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l));
    const dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l));
    const lst = (280.46061837 + 360.98564736629 * d + obsLon) * RAD; // local sidereal time
    const H = lst - ra;
    const phi = obsLat * RAD;
    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    return { alt: alt / RAD, az: norm360(az / RAD + 180) };
  }

  // Where the Sun and Moon are in the sky for an observer.
  function skyPositions(date, obsLat, obsLon) {
    const p = eclipticPositions(date);
    const sun = toHorizon(p.sunLon, 0, p.d, obsLat, obsLon);
    const moon = toHorizon(p.moonLon, p.moonLat, p.d, obsLat, obsLon);
    // The Moon is close enough that our spot on Earth's surface sees it about
    // 1° lower than Earth's centre does (parallax).
    moon.alt -= 0.95 * Math.cos(moon.alt * RAD);
    return { sun, moon };
  }

  // Rise and set times between start and end. The thresholds allow for
  // atmospheric refraction and the size of the disc, as almanacs do.
  function riseSet(body, start, end, obsLat, obsLon) {
    const h0 = -0.833;
    const alt = (t) => skyPositions(new Date(t), obsLat, obsLon)[body].alt - h0;
    const step = 10 * 60000;
    const out = { rise: null, set: null };
    let t0 = start.getTime(), a0 = alt(t0);
    for (let t1 = t0 + step; t1 <= end.getTime(); t1 += step) {
      const a1 = alt(t1);
      if ((a0 < 0) !== (a1 < 0)) {
        let lo = t0, hi = t1;
        for (let i = 0; i < 25; i++) {
          const mid = (lo + hi) / 2;
          if ((alt(mid) < 0) === (a0 < 0)) lo = mid; else hi = mid;
        }
        const key = a0 < 0 ? 'rise' : 'set';
        if (!out[key]) out[key] = new Date((lo + hi) / 2);
      }
      t0 = t1; a0 = a1;
    }
    return out;
  }

  const illumination = (E) => (1 - Math.cos(E * RAD)) / 2;
  const ageDays = (E) => (norm360(E) / 360) * SYNODIC_MONTH;
  const isWaxing = (E) => norm360(E) < 180;

  // Stable id for the named phase; pages translate it.
  function phaseKey(E) {
    const e = norm360(E);
    if (e < 10 || e >= 350) return 'new';
    if (e < 80) return 'waxingCrescent';
    if (e < 100) return 'firstQuarter';
    if (e < 170) return 'waxingGibbous';
    if (e < 190) return 'full';
    if (e < 260) return 'waningGibbous';
    if (e < 280) return 'lastQuarter';
    return 'waningCrescent';
  }

  const PHASE_NAMES = {
    new: 'New Moon', waxingCrescent: 'Waxing Crescent', firstQuarter: 'First Quarter',
    waxingGibbous: 'Waxing Gibbous', full: 'Full Moon', waningGibbous: 'Waning Gibbous',
    lastQuarter: 'Last Quarter', waningCrescent: 'Waning Crescent',
  };
  const phaseName = (E) => PHASE_NAMES[phaseKey(E)];

  const EVENTS = [
    { type: 'new', label: 'New Moon', target: 0 },
    { type: 'firstQuarter', label: 'First Quarter', target: 90 },
    { type: 'full', label: 'Full Moon', target: 180 },
    { type: 'lastQuarter', label: 'Last Quarter', target: 270 },
  ];

  // Exact moments of the four primary phases between two dates.
  function findEvents(start, end) {
    const step = DAY_MS / 4;
    const found = [];
    for (const ev of EVENTS) {
      const g = (t) => wrap180(elongation(new Date(t)) - ev.target);
      let t0 = start.getTime();
      let g0 = g(t0);
      for (let t1 = t0 + step; t1 <= end.getTime() + step; t1 += step) {
        const g1 = g(t1);
        // Elongation only increases, so a phase is a - to + crossing
        // (the +180 -> -180 jump on the far side is not one).
        if (g0 < 0 && g1 >= 0 && g1 - g0 < 90) {
          let lo = t0, hi = t1;
          for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if (g(mid) < 0) lo = mid; else hi = mid;
          }
          const when = new Date((lo + hi) / 2);
          if (when >= start && when <= end) found.push({ ...ev, date: when });
        }
        t0 = t1; g0 = g1;
      }
    }
    return found.sort((a, b) => a.date - b.date);
  }

  // Rough positions of the big dark "seas" (maria) on the near side, north up,
  // in units of the Moon's radius. Enough to make the disc read as the Moon.
  const MARIA = [
    [-0.30, -0.36, 0.27, 0.24], // Imbrium
    [0.13, -0.33, 0.17, 0.16],  // Serenitatis
    [0.30, -0.04, 0.21, 0.18],  // Tranquillitatis
    [0.64, -0.24, 0.12, 0.10],  // Crisium
    [0.50, 0.22, 0.12, 0.14],   // Fecunditatis
    [-0.56, 0.02, 0.24, 0.40],  // Procellarum
    [-0.16, 0.36, 0.18, 0.13],  // Nubium
    [0.22, 0.30, 0.12, 0.10],   // Nectaris
  ];

  let uid = 0;

  // SVG of the Moon as it looks from Earth.
  // rotate: degrees to turn the whole face (0 = northern hemisphere view).
  function moonSVG(E, { size, rotate = 0, label } = {}) {
    const r = 50;
    const id = 'moonclip' + ++uid;
    const e = norm360(E);
    const waxing = e < 180;
    // Draw a waxing moon (lit on the right) and mirror it for waning.
    const a = (waxing ? e : 360 - e) * RAD;
    const c = Math.cos(a);
    const rx = (Math.abs(c) * r).toFixed(2);
    // The terminator is half an ellipse: it bulges toward the lit edge for a
    // crescent (c > 0) and away from it for a gibbous moon (c < 0).
    const sweep = c > 0 ? 0 : 1;
    const lit = `M0,${-r} A${r},${r} 0 0 1 0,${r} A${rx},${r} 0 0 ${sweep} 0,${-r} Z`;
    const mirror = waxing ? '' : ' transform="scale(-1,1)"';
    const maria = MARIA.map(([x, y, w, h]) =>
      `<ellipse cx="${x * r}" cy="${y * r}" rx="${w * r}" ry="${h * r}"/>`).join('');
    const dims = size ? ` width="${size}" height="${size}"` : '';
    const aria = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';

    return `<svg class="moon-svg" viewBox="-56 -56 112 112"${dims}${aria}>
  <defs><clipPath id="${id}"><path d="${lit}"${mirror}/></clipPath></defs>
  <g transform="rotate(${rotate})">
    <circle r="${r}" fill="#222735"/>
    <g fill="#1f2330" opacity="0.35">${maria}</g>
    <g clip-path="url(#${id})">
      <circle r="${r}" fill="#efeadb"/>
      <g fill="#9d978a" opacity="0.45">${maria}</g>
      <circle cx="${-0.1 * r}" cy="${0.66 * r}" r="${0.04 * r}" fill="#fffbef"/>
    </g>
  </g>
</svg>`;
  }

  global.MoonKit = {
    SYNODIC_MONTH, DAY_MS,
    norm360, elongation, skyPositions, riseSet, illumination, ageDays, isWaxing, phaseKey, phaseName, findEvents, moonSVG,
  };
})(window);
