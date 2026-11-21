(() => {
  const POLL_MS = 45000;
  const EMPHASIS_MS = 8000;
  const FUT_ORDER = ['HC2701', 'I2701', 'JM2701', 'J2701', 'USDCNY'];
  let emphasis = 0;
  const prev = new Map();

  const $ = (id) => document.getElementById(id);

  function pktNow() {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    $('wall-date').textContent = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
    $('wall-time').textContent = `${parts.hour}:${parts.minute}:${parts.second}`;
    const meridiem = $('wall-meridiem');
    if (meridiem) meridiem.textContent = parts.dayPeriod || '';
  }

  function fmt(n, digits = 2) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  function deltaClass(n) {
    if (n == null || Number.isNaN(Number(n))) return 'delta';
    if (n > 0) return 'delta up';
    if (n < 0) return 'delta down';
    return 'delta';
  }

  function signed(n, digits = 2) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const v = Number(n);
    return `${v > 0 ? '+' : ''}${fmt(v, digits)}`;
  }

  function setFeed(name, state) {
    const el = document.querySelector(`[data-feed="${name}"] .status-dot`);
    if (el) el.className = `status-dot ${state || 'loading'}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function trendClass(pct) {
    if (pct == null || Number.isNaN(Number(pct))) return 'flat';
    if (pct > 0) return 'up';
    if (pct < 0) return 'down';
    return 'flat';
  }

  function svgSpark(values) {
    const nums = (values || []).map(Number).filter((n) => Number.isFinite(n));
    if (nums.length < 2) {
      return '<svg class="chart-svg" viewBox="0 0 100 40" preserveAspectRatio="none"></svg>';
    }
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const w = 100;
    const h = 40;
    const pad = 3;
    const pts = nums.map((n, i) => {
      const x = (i / (nums.length - 1)) * w;
      const y = pad + (1 - (n - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" d="${area}"></path>
      <path class="line" d="${line}"></path>
    </svg>`;
  }

  function chartCard({ symbol, name, last, changePct, spark, digits = 2, unit = '' }) {
    const key = `c:${symbol}`;
    const changed = prev.has(key) && prev.get(key) !== last;
    prev.set(key, last);
    const trend = trendClass(changePct);
    return `
      <article class="chart-card ${trend} ${changed ? 'flash' : ''}">
        <div class="sym">${escapeHtml(symbol || '—')}</div>
        <div class="name">${escapeHtml(name || '')}${unit ? ' · ' + escapeHtml(unit) : ''}</div>
        <div class="px-row">
          <span class="px">${fmt(last, digits)}</span>
          <span class="${deltaClass(changePct)}">${signed(changePct, 2)}%</span>
        </div>
        ${svgSpark(spark)}
      </article>`;
  }

  function renderTicker(titles) {
    const track = $('ticker-track');
    const items = (titles || []).filter(Boolean);
    if (!items.length) {
      track.innerHTML = '<span>Market wire warming up…</span>';
      return;
    }
    const doubled = items.concat(items);
    track.innerHTML = doubled.map((t) => `<span>${escapeHtml(t)}</span>`).join('');
  }

  function renderPsx(psx) {
    const state = (psx && psx.state) || 'loading';
    $('psx-state').textContent = state === 'current' ? 'live' : state;
    setFeed('psx', state);
    const b = (psx && psx.breadth) || {};
    $('psx-breadth').innerHTML = `
      <span>Adv <strong>${b.advancers ?? '—'}</strong></span>
      <span>Dec <strong>${b.decliners ?? '—'}</strong></span>
      <span>Flat <strong>${b.unchanged ?? '—'}</strong></span>
      <span>N <strong>${b.symbols ?? '—'}</strong></span>`;
    const charts = (psx && (psx.charts || psx.topMomentum)) || [];
    const grid = $('psx-charts');
    if (!charts.length) {
      grid.innerHTML = '<div class="chart-card flat"><div class="name">Syncing PSX charts…</div></div>';
    } else {
      grid.innerHTML = charts.slice(0, 5).map((c) => chartCard({
        symbol: c.symbol,
        name: c.name,
        last: c.last,
        changePct: c.changePct,
        spark: c.spark,
        digits: 2,
      })).join('');
    }
    const led = (psx && psx.ledger) || {};
    $('psx-ledger').innerHTML = `
      <span>Mom P&amp;L <em>${signed(led.momentumPct, 2)}%</em></span>
      <span>Model <em>${signed(led.modelPct, 2)}%</em></span>
      <span>PKR <em>${fmt(led.momentumPkr, 0)}</em></span>`;
  }

  function renderFutures(futures) {
    const grid = $('fut-charts');
    let any = 'loading';
    grid.innerHTML = FUT_ORDER.map((code) => {
      const q = (futures && futures[code]) || {};
      if (q.state === 'current') any = 'current';
      else if (any !== 'current' && q.state) any = q.state;
      const meta = q.meta || {};
      return chartCard({
        symbol: meta.short || code,
        name: meta.name || code,
        last: q.last,
        changePct: q.changePct,
        spark: q.spark,
        digits: code === 'USDCNY' ? 4 : 1,
        unit: meta.unit || '',
      });
    }).join('');
    $('fut-state').textContent = any === 'current' ? 'live' : any;
    setFeed('futures', any);
  }

  function renderMetals(metals) {
    const grid = $('metals-grid');
    const rows = [
      { ...(metals && metals.XAUUSD), symbol: 'XAU', name: 'Gold', digits: 2 },
      { ...(metals && metals.USOIL), symbol: 'OIL', name: 'Crude', digits: 2 },
    ];
    let state = 'loading';
    grid.innerHTML = rows.map((r) => {
      if (r.state === 'current') state = 'current';
      else if (state !== 'current' && r.state) state = r.state;
      return `
        <div class="rate-tile ${trendClass(r.pct)} ${prev.get('m:' + r.symbol) != null && prev.get('m:' + r.symbol) !== r.mid ? 'flash' : ''}">
          <div class="label">${escapeHtml(r.name || r.symbol)}</div>
          <div class="mid">${fmt(r.mid, r.digits)} <small>${escapeHtml(r.unit || '')}</small></div>
          <div class="${deltaClass(r.pct)}">${signed(r.pct, 2)}%</div>
          ${svgSpark(r.spark)}
        </div>`;
    }).join('');
    rows.forEach((r) => prev.set('m:' + r.symbol, r.mid));
    setFeed('metals', state);
  }

  function renderFob(fob) {
    const products = (fob && fob.products) || [];
    const box = $('fob-products');
    if (!products.length) {
      box.innerHTML = '<div class="fob-tile"><div class="label">FOB syncing…</div></div>';
    } else {
      box.innerHTML = products.slice(0, 2).map((p) => {
        const key = `fob:${p.symbol || p.name}`;
        const changed = prev.has(key) && prev.get(key) !== p.mid;
        prev.set(key, p.mid);
        return `
          <div class="fob-tile ${changed ? 'flash' : ''}">
            <div class="label">${escapeHtml(p.grade || p.name || p.symbol)}</div>
            <div class="mid">${fmt(p.mid, 0)} <small>${escapeHtml(p.unit || 'USD/mt')}</small></div>
            <div class="fob-name">${escapeHtml(p.name || '')}</div>
          </div>`;
      }).join('');
    }
    const bdi = (fob && fob.bdi) || {};
    const changed = prev.has('bdi') && prev.get('bdi') !== bdi.value;
    prev.set('bdi', bdi.value);
    $('bdi-panel').innerHTML = `
      <div class="bdi-hero ${changed ? 'flash' : ''}">
        <div class="idx">Baltic Dry Index</div>
        <div class="val">${fmt(bdi.value, 0)}</div>
        <div class="${deltaClass(bdi.change)}">${signed(bdi.change, 0)} · ${signed(bdi.pct, 2)}% · ${escapeHtml(bdi.date || '')}</div>
      </div>`;
    $('fob-disclaimer').textContent = 'Indicative scrape · not settlement · not advice';
    const st = (fob && fob.state) || 'loading';
    setFeed('fob', st === 'seed' ? 'cached' : st);
  }

  function etaCountdown(eta, days) {
    if (!eta) {
      if (days == null) return { label: '—', progress: 0.2 };
      if (days < 0) return { label: `${Math.abs(days)}d ashore`, progress: 1 };
      if (days === 0) return { label: 'today', progress: 0.92 };
      return { label: `${days}d out`, progress: Math.max(0.12, 1 - days / 30) };
    }
    const target = Date.parse(eta.length <= 10 ? `${eta}T00:00:00` : eta);
    if (!Number.isFinite(target)) return etaCountdown(null, days);
    const ms = target - Date.now();
    const abs = Math.abs(ms);
    const d = Math.floor(abs / 86400000);
    const h = Math.floor((abs % 86400000) / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    if (ms < 0) return { label: d > 0 ? `${d}d ashore` : `${h}h ashore`, progress: 1 };
    return {
      label: d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`,
      progress: Math.max(0.1, Math.min(0.95, 1 - ms / (30 * 86400000))),
    };
  }

  function shortStatus(status) {
    const s = (status || '').replace(/_/g, ' ');
    if (s.length <= 16) return s;
    return s.slice(0, 14) + '…';
  }

  function vesselCard(v) {
    if (!v) return '';
    const cd = etaCountdown(v.eta, v.days);
    const late = v.days != null && v.days < 0;
    const qty = v.qtyMt != null ? `${fmt(v.qtyMt, 0)} MT` : '';
    return `
      <div class="vessel" data-eta="${escapeHtml(v.eta || '')}" data-days="${v.days ?? ''}">
        <div class="name" title="${escapeHtml(v.vessel || '')}">${escapeHtml(v.vessel || '—')}</div>
        <span class="badge ${late ? 'late' : ''}" title="${escapeHtml(v.status || '')}">${escapeHtml(shortStatus(v.status) || 'ETA')}</span>
        <div class="meta">
          <span>${escapeHtml(v.port || '')}</span>
          <span>${qty}</span>
          <span class="eta-live">${escapeHtml(cd.label)}</span>
        </div>
        <div class="rail" aria-hidden="true"><i style="width:${Math.round(cd.progress * 100)}%"></i></div>
      </div>`;
  }

  function fillList(listId, countId, rows) {
    const items = (rows || []).filter(Boolean).slice(0, 3);
    $(countId).textContent = String(items.length);
    $(listId).innerHTML = items.map(vesselCard).join('');
  }

  function renderVessels(v) {
    const vessels = v || {};
    const band = $('vessel-band');
    const unconfigured = vessels.configured === false || vessels.state === 'unconfigured';
    const empty = !(vessels.arrived || []).length && !(vessels.transit || []).length && !(vessels.booked || []).length;

    if (unconfigured || (empty && vessels.state !== 'current')) {
      band.innerHTML = `
        <div class="waiting">
          <div class="pulse-ring" aria-hidden="true"></div>
          <strong>${unconfigured ? 'TradeDeck not linked' : 'Waiting for vessel movement'}</strong>
          <span>${unconfigured ? 'VIEWER credentials required on the server.' : 'Boards fill as shipments move.'}</span>
        </div>`;
      setFeed('vessels', unconfigured ? 'unconfigured' : (vessels.state || 'loading'));
      return;
    }

    if (!band.querySelector('#list-arrived')) {
      band.innerHTML = `
        <article class="pane vessel-pane" id="col-arrived">
          <header class="zone-head"><h2>Arrived</h2><span class="count" id="count-arrived">0</span></header>
          <div class="vessels" id="list-arrived"></div>
        </article>
        <article class="pane vessel-pane" id="col-transit">
          <header class="zone-head"><h2>In transit</h2><span class="count" id="count-transit">0</span></header>
          <div class="vessels" id="list-transit"></div>
        </article>
        <article class="pane vessel-pane" id="col-booked">
          <header class="zone-head"><h2>Booked</h2><span class="count" id="count-booked">0</span></header>
          <div class="vessels" id="list-booked"></div>
        </article>`;
    }

    fillList('list-arrived', 'count-arrived', vessels.arrived);
    fillList('list-transit', 'count-transit', vessels.transit);
    fillList('list-booked', 'count-booked', vessels.booked);
    setFeed('vessels', vessels.state || 'current');
  }

  function tickVesselCountdowns() {
    document.querySelectorAll('.vessel[data-eta]').forEach((el) => {
      const eta = el.getAttribute('data-eta');
      const daysRaw = el.getAttribute('data-days');
      const days = daysRaw === '' ? null : Number(daysRaw);
      const cd = etaCountdown(eta, Number.isFinite(days) ? days : null);
      const live = el.querySelector('.eta-live');
      const rail = el.querySelector('.rail i');
      if (live) live.textContent = cd.label;
      if (rail) rail.style.width = `${Math.round(cd.progress * 100)}%`;
    });
  }

  function renderNews(news) {
    const wire = $('news-wire');
    const items = (news || []).slice(0, 6);
    if (!items.length) {
      wire.innerHTML = '<li>Wire quiet</li>';
      return;
    }
    wire.innerHTML = items.map((n) => `
      <li>${escapeHtml(n.title)}<span class="src">${escapeHtml(n.source || '')}</span></li>`).join('');
  }

  function render(payload) {
    renderPsx(payload.psx);
    renderFutures(payload.futures);
    renderMetals(payload.metals || {});
    renderFob(payload.fob);
    renderVessels(payload.vessels);
    renderNews(payload.news);
    renderTicker(payload.ticker || (payload.news || []).map((n) => n.title));
  }

  async function poll() {
    try {
      const res = await fetch('/api/lcd/overview', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('bad status');
      render(await res.json());
    } catch (err) {
      ['psx', 'futures', 'metals', 'fob', 'vessels'].forEach((f) => setFeed(f, 'error'));
    }
  }

  function cycleEmphasis() {
    const cols = [
      $('psx-charts')?.closest('.pane'),
      $('fut-charts')?.closest('.pane'),
      $('metals-pane'), $('fob-pane'), $('bdi-pane'),
      $('col-arrived'), $('col-transit'), $('col-booked'), $('col-news'),
    ].filter(Boolean);
    cols.forEach((c) => c.classList.remove('emphasize'));
    if (!cols.length) return;
    cols[emphasis % cols.length].classList.add('emphasize');
    emphasis += 1;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });

  window.ForgeTheme.mount('[data-action="theme"]');
  pktNow();
  setInterval(pktNow, 1000);
  setInterval(tickVesselCountdowns, 1000);
  poll();
  setInterval(poll, POLL_MS);
  cycleEmphasis();
  setInterval(cycleEmphasis, EMPHASIS_MS);
})();
