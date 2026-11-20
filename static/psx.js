const $ = (s, r = document) => r.querySelector(s);
const fmt = (n, d = 2) => n == null || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d === 0 ? 0 : Math.min(d, 2) });
const pct = (n, d = 1) => n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${Number(n).toFixed(d)}%`;
const tone = n => n > 0 ? 'up' : n < 0 ? 'down' : '';
const validDate = v => { const d = new Date(v); return v && Number.isFinite(d.getTime()) ? d : null; };
const dateLabel = (v, opts = {}) => { const d = validDate(v); return d ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi', ...opts }).format(d) : '—'; };
const timeLabel = v => { const d = validDate(v); return d ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Karachi' }).format(d) : '—'; };

const state = {
  data: null,
  symbol: null,
  bars: null,
  index: 0,
  rotateMode: 0,
  lastMids: { XAUUSD: null, USOIL: null },
};

async function request(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function syncClock() {
  const now = new Date();
  $('#lcd-date').textContent = dateLabel(now, { weekday: 'short', year: 'numeric' });
  $('#lcd-date').dateTime = now.toISOString();
  $('#lcd-time').textContent = timeLabel(now);
  $('#lcd-time').dateTime = now.toISOString();
}

function setFeedDot(id, stateName) {
  const el = $(id);
  if (!el) return;
  const dot = el.querySelector('.dot');
  if (!dot) return;
  dot.className = `dot ${stateName || 'loading'}`;
}

function pulsePanel(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('pulse-tick');
  void el.offsetWidth;
  el.classList.add('pulse-tick');
}

function drawNeonCommodity(node, entry, accent) {
  if (!node) return;
  const bars = entry?.bars || [];
  if (bars.length < 2) {
    node.innerHTML = `<div class="empty">${entry?.state === 'loading' ? 'Syncing…' : 'OHLC warming'}</div>`;
    return;
  }
  const slice = bars.slice(-96);
  const w = Math.max(520, node.clientWidth || 640);
  const h = Math.max(180, node.clientHeight || 220);
  const left = 8, right = w - 48, top = 14, bottom = h - 24;
  const hi = Math.max(...slice.map(b => b.high ?? b.close));
  const lo = Math.min(...slice.map(b => b.low ?? b.close));
  const span = hi - lo || 1;
  const x = i => left + (right - left) * i / Math.max(1, slice.length - 1);
  const y = v => bottom - (bottom - top) * (v - lo) / span;
  const stroke = accent === 'oil' ? '#ff8a3d' : '#ffd166';
  const glow = accent === 'oil' ? 'rgba(255,138,61,0.55)' : 'rgba(255,209,102,0.55)';
  const path = slice.map((b, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join(' ');
  const last = slice.at(-1);
  const first = slice[0];
  const candleW = Math.max(1.2, (right - left) / slice.length * 0.45);
  const candles = slice.map((b, i) => {
    const cx = x(i);
    const openY = y(b.open);
    const closeY = y(b.close);
    const highY = y(b.high);
    const lowY = y(b.low);
    const up = b.close >= b.open;
    const fill = up ? 'rgba(109,255,176,0.55)' : 'rgba(255,77,109,0.55)';
    const bodyTop = Math.min(openY, closeY);
    const bodyH = Math.max(1.2, Math.abs(closeY - openY));
    return `<line x1="${cx.toFixed(1)}" y1="${highY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${lowY.toFixed(1)}" stroke="${fill}" stroke-width="1" opacity=".7"/><rect x="${(cx - candleW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${fill}" opacity=".35"/>`;
  }).join('');
  const heat = slice.map((b, i) => {
    const t = (b.close - lo) / span;
    const hue = 120 * t;
    return `<rect x="${(x(i) - candleW).toFixed(1)}" y="${(bottom + 4).toFixed(1)}" width="${(candleW * 2).toFixed(1)}" height="4" fill="hsl(${hue},90%,55%)" opacity=".55"/>`;
  }).join('');
  const gid = `cg-${accent}-${Math.random().toString(36).slice(2, 7)}`;
  node.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${entry.symbol} neon chart">
    <defs>
      <linearGradient id="${gid}" x2="0" y2="1">
        <stop stop-color="${stroke}" stop-opacity=".38"/>
        <stop offset="1" stop-color="${stroke}" stop-opacity="0"/>
      </linearGradient>
      <filter id="${gid}-glow"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path d="${path} L${right},${bottom} H${left} Z" fill="url(#${gid})"/>
    ${candles}
    <path d="${path}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" filter="url(#${gid}-glow)" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(slice.length - 1)}" cy="${y(last.close)}" r="4" fill="${stroke}" style="filter:drop-shadow(0 0 6px ${glow})"/>
    ${heat}
    <text fill="#7a8aa3" font-size="10" font-family="Plex,monospace" x="${left}" y="${h - 6}">${dateLabel(first.time || first.date)}</text>
    <text fill="#7a8aa3" font-size="10" font-family="Plex,monospace" text-anchor="end" x="${right}" y="${h - 6}">${dateLabel(last.time || last.date)}</text>
    <text fill="${stroke}" font-size="12" font-family="Plex,monospace" x="${right + 6}" y="${y(last.close) + 4}">${fmt(last.close, 2)}</text>
  </svg>`;
}

function setRangeBar(id, entry, oil = false) {
  const bar = $(id);
  if (!bar || !entry) return;
  const mid = entry.mid, hi = entry.high, lo = entry.low;
  const marker = bar.querySelector('i');
  if (mid == null || hi == null || lo == null || hi <= lo) {
    if (marker) marker.style.left = '50%';
    return;
  }
  const t = Math.max(0, Math.min(1, (mid - lo) / (hi - lo)));
  if (marker) marker.style.left = `${(t * 100).toFixed(1)}%`;
  bar.classList.toggle('oil', oil);
}

function renderCommodity(sym, panelId, midId, pctId, nameId, footId, chartId, rangeId) {
  const entry = state.data?.commodities?.[sym];
  const accent = sym === 'USOIL' ? 'oil' : 'gold';
  if (!entry) {
    $(chartId).innerHTML = '<div class="empty">No commodity payload</div>';
    return;
  }
  $(nameId).textContent = entry.name || sym;
  $(midId).textContent = fmt(entry.mid, 2);
  const delta = $(pctId);
  delta.textContent = pct(entry.pct, 2);
  delta.className = `delta ${tone(entry.pct)}`;
  $(footId).textContent = `${entry.source || 'biquote · CFD mid'} · ${entry.state || '—'} · ${entry.unit || ''}`;
  setRangeBar(rangeId, entry, accent === 'oil');
  drawNeonCommodity($(chartId), entry, accent);
  if (state.lastMids[sym] != null && entry.mid != null && entry.mid !== state.lastMids[sym]) {
    pulsePanel(panelId);
  }
  if (entry.mid != null) state.lastMids[sym] = entry.mid;
}

function drawFeature(bars, symbol) {
  const node = $('#feature-chart');
  if (!bars || bars.length < 2) {
    node.innerHTML = '<div class="empty">Not enough daily bars.</div>';
    return;
  }
  const slice = bars.slice(-120);
  const w = Math.max(640, node.clientWidth || 900);
  const h = Math.max(220, node.clientHeight || 300);
  const left = 12, right = w - 56, top = 16, bottom = h - 28;
  const hi = Math.max(...slice.map(b => b.high ?? b.close));
  const lo = Math.min(...slice.map(b => b.low ?? b.close));
  const span = hi - lo || 1;
  const x = i => left + (right - left) * i / Math.max(1, slice.length - 1);
  const y = v => bottom - (bottom - top) * (v - lo) / span;
  const path = slice.map((b, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join(' ');
  const last = slice.at(-1);
  const first = slice[0];
  const move = (last.close / first.close - 1) * 100;
  const color = move >= 0 ? '#00f0ff' : '#ff2bd6';
  const gid = `psx-${Math.random().toString(36).slice(2, 7)}`;
  node.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${symbol} chart">
    <defs>
      <linearGradient id="${gid}" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
      <filter id="${gid}-g"><feGaussianBlur stdDeviation="2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path d="${path} L${right},${bottom} H${left} Z" fill="url(#${gid})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" filter="url(#${gid}-g)" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(slice.length - 1)}" cy="${y(last.close)}" r="4" fill="${color}"/>
    <text fill="#7a8aa3" font-size="11" font-family="Plex,monospace" x="${left}" y="${h - 8}">${dateLabel(first.date)}</text>
    <text fill="#7a8aa3" font-size="11" font-family="Plex,monospace" text-anchor="end" x="${right}" y="${h - 8}">${dateLabel(last.date)}</text>
    <text fill="#e8f4ff" font-size="13" font-family="Plex,monospace" x="${right + 8}" y="${y(last.close) + 4}">${fmt(last.close, 2)}</text>
  </svg>`;
  $('#feature-title').textContent = symbol;
  $('#feature-meta').innerHTML = `<strong class="glow-cyan">${symbol}</strong><br>${fmt(last.close, 2)} · <span class="delta ${tone(move)}">${pct(move)}</span><br>${slice.length} sessions · DPS`;
}

function renderPicks(target, rows, kind) {
  const node = $(target);
  if (!rows?.length) {
    node.innerHTML = '<div class="empty">Waiting on ranks…</div>';
    return;
  }
  node.innerHTML = rows.map((r, i) => {
    const score = kind === 'model' ? r.predictedWeeklyPct : r.weeklyPct;
    const label = kind === 'model' ? 'pred' : 'wk';
    return `<button type="button" class="pick-row ${state.symbol === r.symbol ? 'active' : ''}" data-symbol="${r.symbol}" data-index="${i}">
      <span class="pick-rank">${String(i + 1).padStart(2, '0')}</span>
      <span><span class="pick-sym">${r.symbol}</span><span class="pick-name">${r.name || 'PSX'}</span></span>
      <span class="pick-stats"><span class="delta ${tone(score)}">${pct(score, 1)} ${label}</span><br>${fmt(r.last, 2)} · ${pct(r.pct, 1)}</span>
    </button>`;
  }).join('');
}

function renderLedger(led) {
  const cum = led?.cumulative || {};
  const hit = led?.hitRate || {};
  const latest = led?.latest;
  const rows = [...(latest?.momentum || []), ...(latest?.model || [])].slice(0, 6);
  $('#lcd-ledger').innerHTML = `
    <div class="ledger-summary">
      <div class="stat"><span>Momentum paper</span><strong class="delta ${tone(cum.momentumPct)}">${pct(cum.momentumPct, 1)}</strong></div>
      <div class="stat"><span>Model paper</span><strong class="delta ${tone(cum.modelPct)}">${pct(cum.modelPct, 1)}</strong></div>
      <div class="stat"><span>Mom hit</span><strong>${hit.momentum == null ? '—' : pct(hit.momentum * 100, 0)}</strong></div>
      <div class="stat"><span>Model hit</span><strong>${hit.model == null ? '—' : pct(hit.model * 100, 0)}</strong></div>
    </div>
    ${latest ? `<table class="ledger-table"><thead><tr><th>Sym</th><th>Side</th><th>P&amp;L</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.symbol}</td><td>${r.bucket || 'mom'}</td><td class="delta ${tone(r.pnlPct)}">${pct(r.pnlPct, 1)}</td></tr>`).join('') || '<tr><td colspan="3">Cohort open</td></tr>'}
    </tbody></table>
    <p class="comm-foot">Cohort ${latest.week} · ${latest.status}</p>` : '<div class="empty">No cohort yet</div>'}`;
}

function renderBoard() {
  const d = state.data;
  if (!d) return;
  const b = d.breadth || {};
  $('#lcd-breadth').innerHTML = `
    <span class="chip">SYM ${b.symbols ?? '—'}</span>
    <span class="chip">UP ${b.advancers ?? '—'}</span>
    <span class="chip">DN ${b.decliners ?? '—'}</span>
    <span class="chip">VOL ${fmt(b.volume, 0)}</span>`;

  const watch = d.states?.watch || 'loading';
  setFeedDot('#feed-dps', watch === 'current' ? 'ok' : watch === 'cached' ? 'stale' : watch === 'unavailable' ? 'err' : 'loading');

  const comm = d.commodities || {};
  const bqStates = [comm.XAUUSD?.state, comm.USOIL?.state].filter(Boolean);
  const bq = bqStates.every(s => s === 'current') ? 'ok'
    : bqStates.some(s => s === 'cached') ? 'stale'
    : bqStates.some(s => s === 'loading') ? 'loading' : 'err';
  setFeedDot('#feed-bq', bq);

  renderCommodity('XAUUSD', '#panel-xau', '#xau-mid', '#xau-pct', '#xau-name', '#xau-foot', '#xau-chart', '#xau-range');
  renderCommodity('USOIL', '#panel-oil', '#oil-mid', '#oil-pct', '#oil-name', '#oil-foot', '#oil-chart', '#oil-range');
  renderPicks('#lcd-momentum', d.momentum, 'momentum');
  renderPicks('#lcd-model', d.model, 'model');
  renderLedger(d.ledger);
  const universe = [...(d.momentum || []), ...(d.model || [])];
  if (!state.symbol && universe[0]) state.symbol = universe[0].symbol;
}

async function loadHistory(symbol) {
  if (!symbol) return;
  state.symbol = symbol;
  renderBoard();
  try {
    const data = await request(`/api/psx/history?symbol=${encodeURIComponent(symbol)}`);
    state.bars = data.bars || [];
    drawFeature(state.bars, symbol);
  } catch {
    $('#feature-chart').innerHTML = '<div class="empty">History unavailable.</div>';
  }
}

async function refresh(manual = false) {
  try {
    state.data = await request(
      manual ? '/api/psx/refresh' : '/api/psx/overview',
      manual ? 'POST' : 'GET',
      manual ? {} : undefined,
    );
    renderBoard();
    const list = state.data.momentum || [];
    if (list.length) {
      if (!list.some(r => r.symbol === state.symbol)) state.symbol = list[0].symbol;
      await loadHistory(state.symbol);
    }
  } catch {
    setFeedDot('#feed-dps', 'err');
    setFeedDot('#feed-bq', 'err');
  }
}

function rotateFeature() {
  const list = state.data?.momentum || [];
  state.rotateMode = (state.rotateMode + 1) % 3;
  if (state.rotateMode === 1) {
    pulsePanel('#panel-xau');
    return;
  }
  if (state.rotateMode === 2) {
    pulsePanel('#panel-oil');
    return;
  }
  if (list.length < 2) return;
  state.index = (state.index + 1) % list.length;
  loadHistory(list[state.index].symbol);
}

document.addEventListener('click', e => {
  const pick = e.target.closest('[data-symbol]');
  if (pick) {
    state.index = Number(pick.dataset.index || 0);
    loadHistory(pick.dataset.symbol);
  }
});
$('#lcd-refresh').addEventListener('click', () => refresh(true));
document.addEventListener('keydown', e => {
  if (e.key === 'f' || e.key === 'F') {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
});

syncClock();
setInterval(syncClock, 1000);
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 45000);
setInterval(() => { if (!document.hidden) rotateFeature(); }, 10000);
window.addEventListener('resize', () => {
  if (state.bars && state.symbol) drawFeature(state.bars, state.symbol);
  if (state.data?.commodities) {
    renderCommodity('XAUUSD', '#panel-xau', '#xau-mid', '#xau-pct', '#xau-name', '#xau-foot', '#xau-chart', '#xau-range');
    renderCommodity('USOIL', '#panel-oil', '#oil-mid', '#oil-pct', '#oil-name', '#oil-foot', '#oil-chart', '#oil-range');
  }
});
