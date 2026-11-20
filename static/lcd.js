(() => {
  const POLL_MS = 50000;
  const EMPHASIS_MS = 8000;
  const FUT_ORDER = ['HC2701', 'I2701', 'JM2701', 'J2701', 'USDCNY'];
  let emphasis = 0;
  let lastPayload = null;

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
    const s = v > 0 ? '+' : '';
    return s + fmt(v, digits);
  }

  function setFeed(name, state) {
    const el = document.querySelector(`[data-feed="${name}"] .dot`);
    if (!el) return;
    el.className = `dot ${state || 'loading'}`;
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
      const h = 18 + ((n - min) / span) * 82;
      return `<i style="height:${h}%"></i>`;
    }).join('');
  }

  function renderTicker(titles) {
    const track = $('ticker-track');
    const items = (titles || []).filter(Boolean);
    if (!items.length) {
      track.innerHTML = '<span class="marquee-item">Wire quiet — waiting for headlines</span>';
      return;
    }
    const doubled = items.concat(items);
    track.innerHTML = doubled.map((t) => `<span class="marquee-item">${escapeHtml(t)}</span>`).join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderPsx(psx) {
    const state = (psx && psx.state) || 'loading';
    $('psx-state').textContent = state;
    setFeed('psx', state);
    const b = (psx && psx.breadth) || {};
    $('psx-breadth').innerHTML = `
      <span>ADV <strong>${b.advancers ?? '—'}</strong></span>
      <span>DEC <strong>${b.decliners ?? '—'}</strong></span>
      <span>FLAT <strong>${b.unchanged ?? '—'}</strong></span>
      <span>N <strong>${b.symbols ?? '—'}</strong></span>`;
    const list = $('psx-mom');
    const rows = (psx && psx.topMomentum) || [];
    if (!rows.length) {
      list.innerHTML = '<li><span class="name">Syncing momentum board…</span></li>';
    } else {
      list.innerHTML = rows.map((r) => `
        <li>
          <span class="sym">${escapeHtml(r.symbol || '—')}</span>
          <span class="name">${escapeHtml(r.name || '')}</span>
          <span class="last">${fmt(r.last, 2)}</span>
          <span class="${deltaClass(r.changePct)}">${signed(r.changePct, 2)}%</span>
        </li>`).join('');
    }
    sparkBars($('psx-spark'), (psx && psx.spark) || rows.map((r) => r.changePct));
    const led = (psx && psx.ledger) || {};
    $('psx-ledger').innerHTML = `
      <span>MOM P&amp;L <em>${signed(led.momentumPct, 2)}%</em></span>
      <span>MODEL <em>${signed(led.modelPct, 2)}%</em></span>
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
      let marker = '';
      if (q.low != null && q.high != null && q.last != null && q.high !== q.low) {
        const pct = Math.max(0, Math.min(1, (q.last - q.low) / (q.high - q.low)));
        marker = `<div class="range"><i style="left:${pct * 100}%"></i></div>`;
      }
      return `
        <div class="fut-tile">
          <div class="code">${escapeHtml(code)} · ${escapeHtml(meta.name || '')}</div>
          <div class="px">${fmt(q.last, code === 'USDCNY' ? 4 : 1)}</div>
          <div class="${deltaClass(q.changePct)}">${signed(q.changePct, 2)}%</div>
          ${marker}
        </div>`;
    }).join('');
    $('fut-state').textContent = any;
    setFeed('futures', any);
  }

  function renderFob(fob) {
    const products = (fob && fob.products) || [];
    const box = $('fob-products');
    if (!products.length) {
      box.innerHTML = '<div class="fob-row"><span class="label">FOB sync…</span></div>';
    } else {
      box.innerHTML = products.slice(0, 3).map((p) => `
        <div class="fob-row">
          <span class="label">${escapeHtml(p.name || p.symbol)}</span>
          <span class="mid">${fmt(p.mid, 0)} <small>${escapeHtml(p.unit || '')}</small></span>
          <span class="meta">${escapeHtml(p.source || '')}${p.asOf ? ' · ' + escapeHtml(p.asOf) : ''}</span>
        </div>`).join('');
    }
    const bdi = (fob && fob.bdi) || {};
    $('bdi-panel').innerHTML = `
      <div>
        <div class="idx">BALTIC DRY · ${escapeHtml(bdi.index || 'BDI')}</div>
        <div class="val">${fmt(bdi.value, 0)}</div>
      </div>
      <div>
        <div class="${deltaClass(bdi.change)}">${signed(bdi.change, 0)} · ${signed(bdi.pct, 2)}%</div>
        <div class="meta" style="font-family:var(--font-mono);font-size:0.65rem;color:var(--muted);margin-top:0.35rem">
          ${escapeHtml(bdi.date || '—')} · ${escapeHtml(bdi.source || '')}
        </div>
      </div>`;
    $('fob-disclaimer').textContent = (fob && fob.disclaimer)
      || 'FOB scrape + BDI · not settlement / not advice';
    const st = (fob && fob.state) || 'loading';
    setFeed('fob', st === 'seed' ? 'cached' : st);
  }

  function vesselCard(v) {
    if (!v) {
      return '<div class="vessel empty">— slot open —</div>';
    }
    const days = v.days;
    let badge = 'ETA';
    let badgeClass = 'badge';
    if (days == null) badge = escapeHtml(v.status || '—');
    else if (days < 0) {
      badge = `D${days}`;
      badgeClass = 'badge late';
    } else if (days === 0) badge = 'TODAY';
    else badge = `D+${days}`;
    const qty = v.qtyMt != null ? `${fmt(v.qtyMt, 0)} MT` : '— MT';
    return `
      <div class="vessel">
        <div class="name">${escapeHtml(v.vessel)}</div>
        <span class="${badgeClass}">${badge}</span>
        <div class="meta">
          <span>${escapeHtml(v.voyage || '—')}</span>
          <span>${escapeHtml(v.port || '—')}</span>
          <span>${qty}</span>
          <span>${escapeHtml(v.buyer || '—')}</span>
          <span>${escapeHtml(v.status || '')}</span>
        </div>
        <div class="rail" aria-hidden="true"><i></i></div>
      </div>`;
  }

  function fillColumn(listId, countId, rows) {
    const list = $(listId);
    const items = rows || [];
    $(countId).textContent = String(items.length);
    const padded = [...items];
    while (padded.length < 4) padded.push(null);
    list.innerHTML = padded.slice(0, 4).map(vesselCard).join('');
  }

  function renderVessels(v) {
    const vessels = v || {};
    fillColumn('list-arrived', 'count-arrived', vessels.arrived);
    fillColumn('list-transit', 'count-transit', vessels.transit);
    fillColumn('list-booked', 'count-booked', vessels.booked);
    const st = vessels.state || (vessels.configured === false ? 'unconfigured' : 'loading');
    setFeed('vessels', st === 'unconfigured' ? 'unconfigured' : st);
  }

  function renderNews(news) {
    const wire = $('news-wire');
    const items = (news || []).slice(0, 8);
    if (!items.length) {
      wire.innerHTML = '<li>No headlines yet</li>';
      return;
    }
    wire.innerHTML = items.map((n) => `
      <li>${escapeHtml(n.title)}
        <span class="src">${escapeHtml(n.source || '')}${n.published ? ' · ' + escapeHtml(n.published) : ''}</span>
      </li>`).join('');
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
    const cols = [ $('col-arrived'), $('col-transit'), $('col-booked'), $('col-news') ];
    cols.forEach((c) => c && c.classList.remove('emphasize'));
    const target = cols[emphasis % cols.length];
    if (target) target.classList.add('emphasize');
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
  poll();
  setInterval(poll, POLL_MS);
  cycleEmphasis();
  setInterval(cycleEmphasis, EMPHASIS_MS);
})();
