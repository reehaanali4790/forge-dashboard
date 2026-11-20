(() => {
  const POLL_MS = 45000;
  const EMPHASIS_MS = 7000;
  const FUT_ORDER = ['HC2701', 'I2701', 'JM2701', 'J2701', 'USDCNY'];
  let emphasis = 0;
  let lastPayload = null;
  const prevQuotes = new Map();

  const $ = (id) => document.getElementById(id);

  function pktNow() {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    $('wall-date').textContent = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
    $('wall-time').textContent = `${parts.hour}:${parts.minute}:${parts.second}`;
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
    const el = document.querySelector(`[data-feed="${name}"] .dot`);
    if (!el) return;
    el.className = `dot ${state || 'loading'}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sparkBars(el, values) {
    if (!el) return;
    const nums = (values || []).map(Number).filter((n) => Number.isFinite(n));
    if (!nums.length) {
      el.innerHTML = '';
      return;
    }
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    el.innerHTML = nums.map((n) => {
      const h = 22 + ((n - min) / span) * 78;
      return `<i style="height:${h}%"></i>`;
    }).join('');
  }

  function flashIfChanged(key, value, el) {
    const prev = prevQuotes.get(key);
    prevQuotes.set(key, value);
    if (prev != null && prev !== value && el) el.classList.add('flash');
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
      <span>Names <strong>${b.symbols ?? '—'}</strong></span>`;
    const list = $('psx-mom');
    const rows = (psx && psx.topMomentum) || [];
    if (!rows.length) {
      list.innerHTML = '<li><span class="name">Syncing momentum…</span></li>';
    } else {
      list.innerHTML = rows.map((r, i) => {
        const key = `psx:${r.symbol}`;
        flashIfChanged(key, r.last, null);
        const flashed = prevQuotes.has(key) ? '' : '';
        return `
        <li class="${flashed}" data-key="${escapeHtml(key)}">
          <span class="sym">${escapeHtml(r.symbol || '—')}</span>
          <span class="name">${escapeHtml(r.name || '')}</span>
          <span class="last">${fmt(r.last, 2)}</span>
          <span class="${deltaClass(r.changePct)}">${signed(r.changePct, 2)}%</span>
        </li>`;
      }).join('');
      rows.forEach((r) => {
        const key = `psx:${r.symbol}`;
        const li = list.querySelector(`[data-key="${CSS.escape(key)}"]`);
        const prev = prevQuotes.get(`${key}:shown`);
        if (prev != null && prev !== r.last && li) li.classList.add('flash');
        prevQuotes.set(`${key}:shown`, r.last);
      });
    }
    sparkBars($('psx-spark'), (psx && psx.spark) || rows.map((r) => r.changePct));
    const led = (psx && psx.ledger) || {};
    $('psx-ledger').innerHTML = `
      <span>Mom P&amp;L <em>${signed(led.momentumPct, 2)}%</em></span>
      <span>Model <em>${signed(led.modelPct, 2)}%</em></span>
      <span>PKR <em>${fmt(led.momentumPkr, 0)}</em></span>`;
  }

  function renderFutures(futures) {
    const grid = $('fut-grid');
    let any = 'loading';
    grid.innerHTML = FUT_ORDER.map((code) => {
      const q = (futures && futures[code]) || {};
      if (q.state === 'current') any = 'current';
      else if (any !== 'current' && q.state) any = q.state;
      const meta = q.meta || {};
      const key = `fut:${code}`;
      const prev = prevQuotes.get(key);
      const changed = prev != null && prev !== q.last;
      prevQuotes.set(key, q.last);
      let marker = '';
      if (q.low != null && q.high != null && q.last != null && q.high !== q.low) {
        const pct = Math.max(0, Math.min(1, (q.last - q.low) / (q.high - q.low)));
        marker = `<div class="range"><i style="left:calc(${pct * 100}% - 5px)"></i></div>`;
      }
      return `
        <div class="fut-tile ${changed ? 'flash' : ''}">
          <div class="code">${escapeHtml(meta.name || code)}</div>
          <div class="px">${fmt(q.last, code === 'USDCNY' ? 4 : 1)}</div>
          <div class="${deltaClass(q.changePct)}">${signed(q.changePct, 2)}%</div>
          ${marker}
        </div>`;
    }).join('');
    $('fut-state').textContent = any === 'current' ? 'live' : any;
    setFeed('futures', any);
  }

  function renderFob(fob) {
    const products = (fob && fob.products) || [];
    const box = $('fob-products');
    if (!products.length) {
      box.innerHTML = '<div class="fob-row"><span class="label">FOB syncing…</span></div>';
    } else {
      box.innerHTML = products.slice(0, 2).map((p) => {
        const key = `fob:${p.symbol || p.name}`;
        const prev = prevQuotes.get(key);
        const changed = prev != null && prev !== p.mid;
        prevQuotes.set(key, p.mid);
        return `
        <div class="fob-row ${changed ? 'flash' : ''}">
          <span class="label">${escapeHtml(p.name || p.symbol)}</span>
          <span class="mid">${fmt(p.mid, 0)} <small>${escapeHtml(p.unit || '')}</small></span>
          <span class="meta">${escapeHtml((p.source || '').replace(' · public scrape', ''))}${p.asOf ? ' · ' + escapeHtml(p.asOf) : ''}</span>
        </div>`;
      }).join('');
    }
    const bdi = (fob && fob.bdi) || {};
    const bdiKey = 'bdi';
    const prevBdi = prevQuotes.get(bdiKey);
    const bdiChanged = prevBdi != null && prevBdi !== bdi.value;
    prevQuotes.set(bdiKey, bdi.value);
    $('bdi-panel').innerHTML = `
      <div>
        <div class="idx">Baltic Dry Index</div>
        <div class="val ${bdiChanged ? 'flash' : ''}">${fmt(bdi.value, 0)}</div>
      </div>
      <div>
        <div class="${deltaClass(bdi.change)}">${signed(bdi.change, 0)} · ${signed(bdi.pct, 2)}%</div>
        <div class="meta" style="font-family:var(--mono);font-size:0.72rem;color:var(--muted);margin-top:0.35rem">
          ${escapeHtml(bdi.date || '—')}
        </div>
      </div>`;
    $('fob-disclaimer').textContent = 'Indicative scrape · not settlement · not advice';
    const st = (fob && fob.state) || 'loading';
    setFeed('fob', st === 'seed' ? 'cached' : st);
  }

  function etaCountdown(eta, days) {
    if (!eta) {
      if (days == null) return { label: '—', progress: 0.2 };
      if (days < 0) return { label: `${Math.abs(days)}d ashore`, progress: 1 };
      if (days === 0) return { label: 'due today', progress: 0.92 };
      return { label: `${days}d out`, progress: Math.max(0.12, 1 - days / 30) };
    }
    const target = Date.parse(eta.length <= 10 ? `${eta}T00:00:00` : eta);
    if (!Number.isFinite(target)) return etaCountdown(null, days);
    const ms = target - Date.now();
    const abs = Math.abs(ms);
    const d = Math.floor(abs / 86400000);
    const h = Math.floor((abs % 86400000) / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    if (ms < 0) {
      return { label: d > 0 ? `${d}d ${h}h ashore` : `${h}h ${m}m ashore`, progress: 1 };
    }
    const label = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
    return { label, progress: Math.max(0.1, Math.min(0.95, 1 - ms / (30 * 86400000))) };
  }

  function vesselCard(v) {
    if (!v) return '';
    const cd = etaCountdown(v.eta, v.days);
    const badgeClass = (v.days != null && v.days < 0) ? 'badge late' : 'badge';
    const qty = v.qtyMt != null ? `${fmt(v.qtyMt, 0)} MT` : '';
    return `
      <div class="vessel" data-eta="${escapeHtml(v.eta || '')}" data-days="${v.days ?? ''}">
        <div class="name">${escapeHtml(v.vessel)}</div>
        <span class="${badgeClass}">${escapeHtml(v.status || 'ETA')}</span>
        <div class="meta">
          <span>${escapeHtml(v.voyage || '')}</span>
          <span>${escapeHtml(v.port || '')}</span>
          <span>${qty}</span>
          <span>${escapeHtml(v.buyer || '')}</span>
          <span class="eta-live">${escapeHtml(cd.label)}</span>
        </div>
        <div class="rail" aria-hidden="true"><i style="width:${Math.round(cd.progress * 100)}%"></i></div>
      </div>`;
  }

  function waitingBlock(message, detail) {
    return `
      <div class="waiting">
        <div class="pulse-ring" aria-hidden="true"></div>
        <strong>${escapeHtml(message)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>`;
  }

  function fillColumn(listId, countId, rows, vessels) {
    const list = $(listId);
    const items = (rows || []).filter(Boolean);
    $(countId).textContent = String(items.length);
    if (!items.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = items.slice(0, 4).map(vesselCard).join('');
  }

  function renderVessels(v) {
    const vessels = v || {};
    const band = $('vessel-band');
    const unconfigured = vessels.configured === false || vessels.state === 'unconfigured';
    const empty = !(vessels.arrived || []).length && !(vessels.transit || []).length && !(vessels.booked || []).length;

    if (unconfigured || (empty && vessels.state !== 'current')) {
      band.innerHTML = waitingBlock(
        unconfigured ? 'TradeDeck not linked yet' : 'Waiting for vessel movement',
        unconfigured
          ? 'Add VIEWER credentials on the server to stream arrivals, transit, and booked lots.'
          : 'Polling arrivals — boards fill as soon as shipments move.',
      );
      setFeed('vessels', unconfigured ? 'unconfigured' : (vessels.state || 'loading'));
      return;
    }

    if (!band.querySelector('#list-arrived')) {
      band.innerHTML = `
        <article class="pane pane-vessel" id="col-arrived" data-col="0">
          <header class="pane-head"><h2>Arrived</h2><span class="count" id="count-arrived">0</span></header>
          <div class="vessels" id="list-arrived"></div>
        </article>
        <article class="pane pane-vessel" id="col-transit" data-col="1">
          <header class="pane-head"><h2>In transit</h2><span class="count" id="count-transit">0</span></header>
          <div class="vessels" id="list-transit"></div>
        </article>
        <article class="pane pane-vessel" id="col-booked" data-col="2">
          <header class="pane-head"><h2>Booked</h2><span class="count" id="count-booked">0</span></header>
          <div class="vessels" id="list-booked"></div>
        </article>`;
    }

    fillColumn('list-arrived', 'count-arrived', vessels.arrived, vessels);
    fillColumn('list-transit', 'count-transit', vessels.transit, vessels);
    fillColumn('list-booked', 'count-booked', vessels.booked, vessels);
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
      if (live && live.textContent !== cd.label) {
        live.textContent = cd.label;
        el.classList.add('live-tick');
        setTimeout(() => el.classList.remove('live-tick'), 500);
      }
      if (rail) rail.style.width = `${Math.round(cd.progress * 100)}%`;
    });
  }

  function renderNews(news) {
    const wire = $('news-wire');
    const items = (news || []).slice(0, 7);
    if (!items.length) {
      wire.innerHTML = '<li>Wire quiet</li>';
      return;
    }
    wire.innerHTML = items.map((n) => `
      <li>${escapeHtml(n.title)}
        <span class="src">${escapeHtml(n.source || '')}</span>
      </li>`).join('');
    const pulse = $('wire-pulse');
    if (pulse) {
      pulse.textContent = 'live';
      pulse.classList.add('flash');
    }
  }

  function render(payload) {
    lastPayload = payload;
    renderPsx(payload.psx);
    renderFutures(payload.futures);
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
      setFeed('psx', 'error');
      setFeed('futures', 'error');
      setFeed('fob', 'error');
      setFeed('vessels', 'error');
    }
  }

  function cycleEmphasis() {
    const cols = [
      $('card-psx'), $('card-futures'), $('card-fob'),
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

  pktNow();
  setInterval(pktNow, 1000);
  setInterval(tickVesselCountdowns, 1000);
  poll();
  setInterval(poll, POLL_MS);
  cycleEmphasis();
  setInterval(cycleEmphasis, EMPHASIS_MS);
})();
