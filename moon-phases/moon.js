(function () {
  const K = window.MoonKit;
  const { t } = window.I18n;
  const RAD = Math.PI / 180;
  const HOUR_MS = 3600000;
  const RANGE = 15;                              // days either side of tonight
  const ORBIT = { cx: 290, cy: 280, r: 190 };
  const EARTH_R = 32;
  const SF = { lat: 37.77, lon: -122.42, tz: 'America/Los_Angeles' };

  const $ = (id) => document.getElementById(id);
  const slider = $('slider');
  const playBtn = $('play');
  const speedSel = $('speed');
  const strip = $('strip');
  const skyPlayBtn = $('sky-play');
  const skyTime = $('sky-time');

  const phaseLabel = (E) => t('phase.' + K.phaseKey(E));

  // ---------- San Francisco wall-clock time ----------
  // Everything on the page is "seen from San Francisco", so days, 9 PM and
  // clock times all follow San Francisco time wherever the reader is.
  const partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SF.tz, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  function sfParts(ms) {
    const o = {};
    for (const p of partsFmt.formatToParts(new Date(ms))) o[p.type] = +p.value;
    return o;
  }
  // The instant when San Francisco clocks read y-m-d h:00 (day may overflow).
  function sfInstant(y, m, d, h) {
    const target = Date.UTC(y, m - 1, d, h);
    let guess = target;
    for (let i = 0; i < 2; i++) {
      const p = sfParts(guess);
      guess += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    }
    return guess;
  }

  const today = sfParts(Date.now());
  const nineCache = new Map();
  // 9 PM San Francisco time, k days from today.
  function ninePm(k) {
    if (!nineCache.has(k)) nineCache.set(k, sfInstant(today.year, today.month, today.day + k, 21));
    return nineCache.get(k);
  }
  // Offset 0 = tonight at 9 PM; whole numbers land on 9 PM even across DST.
  function dateAt(offset) {
    const k = Math.floor(offset);
    return new Date(ninePm(k) + (offset - k) * K.DAY_MS);
  }
  function offsetFor(ms) {
    let k = Math.floor((ms - ninePm(0)) / K.DAY_MS);
    while (ninePm(k + 1) <= ms) k++;
    while (ninePm(k) > ms) k--;
    return k + (ms - ninePm(k)) / K.DAY_MS;
  }
  function sfDay(ms) {
    const p = sfParts(ms);
    return {
      key: `${p.year}-${p.month}-${p.day}`,
      start: sfInstant(p.year, p.month, p.day, 0),
      end: sfInstant(p.year, p.month, p.day + 1, 0),
    };
  }

  let fmt;
  function makeFormatters() {
    const loc = I18n.locale;
    const tz = SF.tz;
    fmt = {
      day: new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: 'short' }),
      date: new Intl.DateTimeFormat(loc, { timeZone: tz, month: 'short', day: 'numeric' }),
      full: new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      event: new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      time: new Intl.DateTimeFormat(loc, { timeZone: tz, hour: 'numeric', minute: '2-digit' }),
    };
  }

  // ---------- Static bits of the diagram ----------
  $('ticks').innerHTML = Array.from({ length: 8 }, (_, i) => {
    const a = i * 45 * RAD;
    return `<circle cx="${ORBIT.cx + ORBIT.r * Math.cos(a)}" cy="${ORBIT.cy - ORBIT.r * Math.sin(a)}" r="3"/>`;
  }).join('');

  const events = K.findEvents(dateAt(-RANGE - 0.5), dateAt(RANGE + 0.5));

  // ---------- Language-dependent sections, rebuilt on toggle ----------
  const days = [];

  function buildStrip() {
    strip.innerHTML = '';
    days.length = 0;
    for (let i = -RANGE; i <= RANGE; i++) {
      const d = dateAt(i);
      const E = K.elongation(d);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'day' + (i === 0 ? ' is-today' : '');
      el.setAttribute('role', 'listitem');
      el.innerHTML = `
        <span class="dow">${i === 0 ? t('tonight') : fmt.day.format(d)}</span>
        <span class="date">${fmt.date.format(d)}</span>
        ${K.moonSVG(E, { label: `${fmt.date.format(d)}: ${phaseLabel(E)}` })}
        <span class="pct">${Math.round(K.illumination(E) * 100)}%</span>
        <span class="tag"></span>`;
      el.addEventListener('click', () => { stop(); setOffset(i); });
      strip.appendChild(el);
      days.push(el);
    }

    // Tag the cards on which a primary phase happens, and list the moments.
    for (const ev of events) {
      // The card for day i covers the 24 hours centred on its 9 PM snapshot.
      const idx = Math.round(offsetFor(ev.date.getTime())) + RANGE;
      if (days[idx]) days[idx].querySelector('.tag').textContent = t('phase.' + ev.type);
    }
    $('events').innerHTML = events
      .map((ev) => `<li><strong>${t('phase.' + ev.type)}</strong> ${fmt.event.format(ev.date)}</li>`)
      .join('');
  }

  function buildPlaces() {
    const E = K.elongation(dateAt(0));
    const waxing = K.isWaxing(E);
    const places = [
      { name: 'place.sanFrancisco', lat: 'lat.n38', rotate: 0 },
      // Near the equator the lit side points down toward the set (or rising)
      // Sun: evening for a waxing Moon, morning for a waning one.
      { name: 'place.singapore', lat: 'lat.n1', rotate: waxing ? 90 : -90 },
      { name: 'place.sydney', lat: 'lat.s34', rotate: 180 },
    ];
    $('hemi').innerHTML = places.map((p) => `
      <figure>
        ${K.moonSVG(E, { rotate: p.rotate, label: `${t(p.name)}: ${phaseLabel(E)}` })}
        <figcaption>${t(p.name)}<span>${t(p.lat)}</span></figcaption>
      </figure>`).join('');
  }

  // ---------- Sky panel: facing south from San Francisco ----------
  const SKY = { w: 800, horizon: 230, perDeg: 210 / 90, az0: 45, az1: 315, minAlt: -28 };
  const skyX = (az) => 30 + ((az - SKY.az0) / (SKY.az1 - SKY.az0)) * (SKY.w - 60);
  const skyY = (alt) => SKY.horizon - alt * SKY.perDeg;
  const inView = (p) => p.az >= SKY.az0 && p.az <= SKY.az1 && p.alt >= SKY.minAlt;

  // Fixed, pseudo-random stars that fade in as the sky darkens.
  {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    $('stars').innerHTML = Array.from({ length: 70 }, () =>
      `<circle cx="${(rand() * SKY.w).toFixed(1)}" cy="${(rand() * (SKY.horizon - 10)).toFixed(1)}" r="${(0.6 + rand() * 1.1).toFixed(1)}"/>`).join('');
  }

  $('alt-grid').innerHTML = [30, 60].map((a) => `
    <line x1="0" x2="${SKY.w}" y1="${skyY(a)}" y2="${skyY(a)}"/>
    <text x="8" y="${skyY(a) - 5}">${a}°</text>`).join('');

  function buildCompass() {
    const points = [[45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    $('compass').innerHTML = points.map(([az, k]) => {
      const anchor = az === SKY.az0 ? 'start' : az === SKY.az1 ? 'end' : 'middle';
      return `<line x1="${skyX(az)}" x2="${skyX(az)}" y1="${SKY.horizon}" y2="${SKY.horizon + 8}"/>
        <text x="${skyX(az)}" y="${SKY.horizon + 30}" text-anchor="${anchor}">${t('compass.' + k)}</text>`;
    }).join('');
  }

  // Sky colours by Sun altitude: night, twilight, sunrise/sunset, day.
  const SKY_STOPS = [
    [-14, '#060914', '#0f1730'],
    [-6, '#1b2350', '#4b3f70'],
    [0, '#34508e', '#e39a62'],
    [8, '#2f6db5', '#8cc2ec'],
  ];
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, f) => {
    const [x, y] = [hexToRgb(a), hexToRgb(b)];
    return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(',')})`;
  };
  function skyColours(sunAlt) {
    if (sunAlt <= SKY_STOPS[0][0]) return [SKY_STOPS[0][1], SKY_STOPS[0][2]];
    for (let i = 1; i < SKY_STOPS.length; i++) {
      const [a1, t1, b1] = SKY_STOPS[i];
      if (sunAlt <= a1) {
        const [a0, t0, b0] = SKY_STOPS[i - 1];
        const f = (sunAlt - a0) / (a1 - a0);
        return [mix(t0, t1, f), mix(b0, b1, f)];
      }
    }
    const last = SKY_STOPS[SKY_STOPS.length - 1];
    return [last[1], last[2]];
  }

  function trackPath(points) {
    let d = '';
    let prev = null;
    for (const p of points) {
      const ok = inView(p) && !(prev && Math.abs(p.az - prev.az) > 30);
      if (ok) d += `${prev && inView(prev) ? 'L' : 'M'}${skyX(p.az).toFixed(1)},${skyY(p.alt).toFixed(1)}`;
      prev = ok ? p : null;
    }
    return d;
  }

  let skyDay = null;          // cached tracks and rise/set times for one SF day

  function buildSkyDay(ms) {
    const day = sfDay(ms);
    const moon = [], sun = [];
    for (let tt = day.start; tt <= day.end; tt += 10 * 60000) {
      const p = K.skyPositions(new Date(tt), SF.lat, SF.lon);
      moon.push(p.moon);
      sun.push(p.sun);
    }
    $('moon-track').setAttribute('d', trackPath(moon));
    $('sun-track').setAttribute('d', trackPath(sun));
    skyDay = {
      ...day,
      moon: K.riseSet('moon', new Date(day.start), new Date(day.end), SF.lat, SF.lon),
      sun: K.riseSet('sun', new Date(day.start), new Date(day.end), SF.lat, SF.lon),
    };
    renderSkyTimes();
  }

  function renderSkyTimes() {
    const f = (d) => (d ? fmt.time.format(d) : '—');
    $('sky-times').innerHTML = [
      ['sky.moonrise', skyDay.moon.rise], ['sky.moonset', skyDay.moon.set],
      ['sky.sunrise', skyDay.sun.rise], ['sky.sunset', skyDay.sun.set],
    ].map(([k, d]) => `<li><span>${t(k)}</span> ${f(d)}</li>`).join('');
  }

  // Direction from the Moon toward the Sun on the sky, as a screen angle
  // (degrees clockwise from "right"). The lit edge of the Moon faces that way.
  function brightLimbAngle(moon, sun) {
    const dAz = (sun.az - moon.az) * RAD;
    const a1 = moon.alt * RAD, a2 = sun.alt * RAD;
    // Initial bearing along the great circle, from "up" toward increasing azimuth
    // (to the right on a south-facing view).
    const bearing = Math.atan2(Math.sin(dAz) * Math.cos(a2),
      Math.cos(a1) * Math.sin(a2) - Math.sin(a1) * Math.cos(a2) * Math.cos(dAz));
    return Math.atan2(-Math.cos(bearing), Math.sin(bearing)) / RAD;
  }

  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  function renderSky(date) {
    const ms = date.getTime();
    if (!skyDay || ms < skyDay.start || ms >= skyDay.end) buildSkyDay(ms);

    const { sun, moon } = K.skyPositions(date, SF.lat, SF.lon);
    const [top, bottom] = skyColours(sun.alt);
    $('sky-top').setAttribute('stop-color', top);
    $('sky-bottom').setAttribute('stop-color', bottom);
    $('stars').setAttribute('opacity', Math.max(0, Math.min(1, (-sun.alt - 4) / 10)).toFixed(2));

    const sunG = $('sky-sun');
    sunG.style.display = inView(sun) ? '' : 'none';
    sunG.setAttribute('transform', `translate(${skyX(sun.az).toFixed(1)} ${skyY(sun.alt).toFixed(1)})`);

    const E = K.elongation(date);
    const moonG = $('sky-moon');
    if (inView(moon)) {
      const limb = brightLimbAngle(moon, sun);
      const rotate = K.isWaxing(E) ? limb : limb - 180;
      const s = 40;
      moonG.innerHTML = `<g transform="translate(${(skyX(moon.az) - s / 2).toFixed(1)} ${(skyY(moon.alt) - s / 2).toFixed(1)})">
        ${K.moonSVG(E, { size: s, rotate: rotate.toFixed(1) })}</g>`;
    } else {
      moonG.innerHTML = '';
    }

    $('sky-status').textContent = moon.alt > 0
      ? t('sky.up', { alt: Math.round(moon.alt), dir: t('dir.' + DIRS[Math.round(moon.az / 45) % 8]) })
      : t('sky.down');
    $('sky-clock').textContent = fmt.time.format(date);
    skyTime.value = ((ms - skyDay.start) / HOUR_MS).toFixed(2);
  }

  // ---------- Live state ----------
  let offset = 0;
  let activeIdx = -1;
  let hasRendered = false;

  function setOffset(value) {
    // A little slack past ±15 so "play this day" can finish the last day.
    offset = Math.max(-RANGE - 1, Math.min(RANGE + 1, value));
    slider.value = offset;
    render();
  }

  function placeObserver(date) {
    // Local solar time in San Francisco: noon faces the Sun (right), midnight
    // faces away. Earth turns counterclockwise seen from above the North Pole.
    const utcHours = (date.getTime() / HOUR_MS) % 24;
    const solarHours = utcHours + SF.lon / 15;
    const a = (solarHours - 12) * 15 * RAD;
    const ux = Math.cos(a), uy = -Math.sin(a);
    const at = (r) => [ORBIT.cx + r * ux, ORBIT.cy + r * uy];

    const [px, py] = at(EARTH_R);
    const dot = $('you-dot');
    dot.setAttribute('cx', px.toFixed(1));
    dot.setAttribute('cy', py.toFixed(1));

    // The horizon is the tangent at your feet: anything on the far side of
    // it is below the horizon for you.
    const h = $('horizon');
    h.setAttribute('x1', (px - uy * 22).toFixed(1));
    h.setAttribute('y1', (py + ux * 22).toFixed(1));
    h.setAttribute('x2', (px + uy * 22).toFixed(1));
    h.setAttribute('y2', (py - ux * 22).toFixed(1));

    const [lx, ly] = at(EARTH_R + 22);
    const you = $('you-label');
    you.setAttribute('x', lx.toFixed(1));
    you.setAttribute('y', (ly + 4).toFixed(1));

    // Keep the "Earth" label on the opposite side so they never collide.
    const [ex, ey] = at(-(EARTH_R + 20));
    const earth = $('earth-label');
    earth.setAttribute('x', ex.toFixed(1));
    earth.setAttribute('y', (ey + 4).toFixed(1));
  }

  function render() {
    const d = dateAt(offset);
    const E = K.elongation(d);

    // Moon in its orbit. Elongation is measured counterclockwise from the
    // Sun's direction, which is to the right in the diagram.
    const x = ORBIT.cx + ORBIT.r * Math.cos(E * RAD);
    const y = ORBIT.cy - ORBIT.r * Math.sin(E * RAD);
    $('moon-g').setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    $('near-arc').setAttribute('transform', `rotate(${(-E).toFixed(1)})`);
    const sl = $('sightline');
    sl.setAttribute('x2', x.toFixed(1));
    sl.setAttribute('y2', y.toFixed(1));
    placeObserver(d);

    // What it looks like from here.
    $('view-moon').innerHTML = K.moonSVG(E, { label: phaseLabel(E) });
    $('phase-name').textContent = phaseLabel(E);
    $('phase-pct').textContent = `${Math.round(K.illumination(E) * 100)}%`;
    $('phase-age').textContent = t('days', { n: K.ageDays(E).toFixed(1) });
    const rel = Math.abs(offset) < 0.005 ? t('tonight')
      : t('relDays', { sign: offset > 0 ? '+' : '−', n: Math.abs(offset).toFixed(1) });
    $('phase-date').textContent = `${fmt.full.format(d)} · ${rel}`;

    renderSky(d);

    // Highlight the matching card and keep it in view.
    const idx = Math.max(0, Math.min(2 * RANGE, Math.round(offset) + RANGE));
    if (idx !== activeIdx) {
      days[activeIdx]?.classList.remove('active');
      days[idx].classList.add('active');
      activeIdx = idx;
      const card = days[idx];
      strip.scrollTo({
        left: card.offsetLeft - strip.clientWidth / 2 + card.clientWidth / 2,
        behavior: playing || skyPlaying || !hasRendered ? 'auto' : 'smooth',
      });
    }
  }

  // ---------- Playback ----------
  // Main player: a continuous sweep at a fixed speed, or "day by day", where
  // each step spins Earth once (24 hours) and then pauses.
  // Sky player: one San Francisco day, midnight to midnight.
  const DAY_STEP_MS = 2200;   // one day's animation in day-by-day mode
  const DAY_PAUSE_MS = 700;   // rest between days
  const SKY_DAY_MS = 16000;   // one day in the sky player
  const EPS = 1e-6;

  let playing = false;
  let skyPlaying = false;
  let skyResume = null;       // where a paused sky day left off
  let run = 0;                // bumped to cancel whatever is animating

  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Animate the offset to `target`; resolves false if something cancels it.
  function animateTo(target, ms, token, ease = easeInOut) {
    const from = offset;
    const t0 = performance.now();
    return new Promise((resolve) => {
      function step(now) {
        if (token !== run) return resolve(false);
        const p = Math.min(1, (now - t0) / ms);
        setOffset(from + (target - from) * ease(p));
        if (p < 1) requestAnimationFrame(step); else resolve(true);
      }
      requestAnimationFrame(step);
    });
  }

  function continuous(token) {
    let last = 0;
    function frame(now) {
      if (token !== run) return;
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      let next = offset + dt * parseFloat(speedSel.value);
      if (next > RANGE) next = -RANGE; // loop
      setOffset(next);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  async function dayByDay(token) {
    while (token === run) {
      if (offset >= RANGE - EPS) setOffset(-RANGE); // loop
      const ok = await animateTo(Math.floor(offset + EPS) + 1, DAY_STEP_MS, token);
      if (!ok) return;
      await wait(DAY_PAUSE_MS);
    }
  }

  function updateButtons() {
    playBtn.textContent = t(playing ? 'pause' : 'play');
    playBtn.setAttribute('aria-label', t(playing ? 'pause.aria' : 'play.aria'));
    skyPlayBtn.textContent = t(skyPlaying ? 'sky.pause' : 'sky.play');
  }

  function stop() {
    run++;
    playing = false;
    skyPlaying = false;
    skyResume = null;
    updateButtons();
  }

  function play() {
    stop();
    if (offset >= RANGE - EPS) setOffset(-RANGE);
    playing = true;
    updateButtons();
    const token = run;
    if (speedSel.value === 'step') dayByDay(token); else continuous(token);
  }

  async function playSkyDay() {
    const now = dateAt(offset).getTime();
    const resume = skyResume && skyResume.dayStart === sfDay(now).start ? skyResume : null;
    stop();
    const day = sfDay(now);
    const from = resume ? now : day.start;
    const end = day.end - 60000; // stop at 11:59 PM so the day stays on screen
    setOffset(offsetFor(from));
    skyPlaying = true;
    updateButtons();
    const token = run;
    const toOffset = offsetFor(end);
    const ms = SKY_DAY_MS * (end - from) / (day.end - day.start);
    const ok = await animateTo(toOffset, ms, token, (p) => p);
    if (ok && token === run) { skyPlaying = false; updateButtons(); }
  }

  function pauseSky() {
    const day = sfDay(dateAt(offset).getTime());
    stop();
    skyResume = { dayStart: day.start };
  }

  // Single steps: one day forward or back, with Earth's full turn animated.
  function stepDay(dir) {
    stop();
    const target = dir > 0 ? Math.floor(offset + EPS) + 1 : Math.ceil(offset - EPS) - 1;
    if (target < -RANGE || target > RANGE) return;
    animateTo(target, DAY_STEP_MS * 0.75, run);
  }

  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  speedSel.addEventListener('change', () => { if (playing) play(); });
  $('prev-day').addEventListener('click', () => stepDay(-1));
  $('next-day').addEventListener('click', () => stepDay(1));
  slider.addEventListener('input', () => { stop(); setOffset(parseFloat(slider.value)); });
  $('today').addEventListener('click', () => { stop(); setOffset(0); });
  skyPlayBtn.addEventListener('click', () => (skyPlaying ? pauseSky() : playSkyDay()));
  skyTime.addEventListener('input', () => {
    const start = skyDay.start;
    stop();
    setOffset(offsetFor(start + parseFloat(skyTime.value) * HOUR_MS));
  });

  // ---------- Language ----------
  function buildAll() {
    makeFormatters();
    buildStrip();
    buildPlaces();
    buildCompass();
    updateButtons();
    if (skyDay) renderSkyTimes();
    activeIdx = -1;
    hasRendered = false;
    render();
    hasRendered = true;
  }

  I18n.onChange(buildAll);
  I18n.apply();
  buildAll();
})();
