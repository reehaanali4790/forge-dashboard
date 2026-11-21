'use strict';

const $ = (s, r = document) => r.querySelector(s);
const fmt = (n, d = 2) => n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d === 0 ? 0 : Math.min(d, 2) });
const pct = (n, d = 1) => n == null || !Number.isFinite(Number(n)) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Number(n)).toFixed(d)}%`;
const tone = n => n > 0 ? 'up' : n < 0 ? 'down' : '';
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validDate = v => { const d = new Date(v); return v && Number.isFinite(d.getTime()) ? d : null; };
const dateLabel = (v, opts = {}) => { const d = validDate(v); return d ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi', ...opts }).format(d) : '—'; };
const timeLabel = v => { const d = validDate(v); return d ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Karachi' }).format(d) : '—'; };

const state = {
  data: null,
  symbol: null,
  bars: null,
  index: 0,
  rotateMode: 0,
  lastMids: { XAUUSD: null, USOIL: null },
};

/* One chart handle per surface, kept alive across polls so the engine can
   update a series in place instead of being torn down every 45 seconds. */
const charts = { XAUUSD: null, USOIL: null, feature: null };

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
  const dot = $(id)?.querySelector('.status-dot');
  if (dot) dot.className = `status-dot ${stateName || 'loading'}`;
}

function pulsePanel(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('pulse-tick');
  void el.offsetWidth;
  el.classList.add('pulse-tick');
}

function placeholder(node, message) {
  if (!node) return;
  node.classList.remove('lw-host');
  node.innerHTML = `<div class="empty">${esc(message)}</div>`;
}

/* Hourly CFD candles for gold and crude. */
function drawCommodity(key, nodeId, entry) {
  const node = $(nodeId);
  const bars = entry?.bars || [];
  if (bars.length < 2) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
    placeholder(node, entry?.state === 'loading' ? 'Syncing…' : 'OHLC warming');
    return;
  }
  if (!window.ForgeCharts?.available) { placeholder(node, 'Chart engine unavailable'); return; }
  if (!charts[key]) {
    charts[key] = window.ForgeCharts.create(node, {
      kind: 'candles',
      precision: 2,
      unit: entry.unit || 'USD',
      intraday: true,
      timeZone: 'Asia/Karachi',
      barSpacing: 5,
      volume: true,
    });
  }
  if (charts[key]) charts[key].setData(bars.slice(-120));
  else placeholder(node, 'Chart engine unavailable');
}

function setRangeBar(id, entry) {
  const bar = $(id);
  if (!bar || !entry) return;
  const marker = bar.querySelector('i');
  const { mid, high, low } = entry;
  if (mid == null || high == null || low == null || high <= low) {
    if (marker) marker.style.left = '50%';
    return;
  }
  const at = Math.max(0, Math.min(1, (mid - low) / (high - low)));
  if (marker) marker.style.left = `${(at * 100).toFixed(1)}%`;
}

function renderCommodity(sym, panelId, midId, pctId, nameId, footId, chartId, rangeId) {
  const entry = state.data?.commodities?.[sym];
  if (!entry) { placeholder($(chartId), 'No commodity payload'); return; }
  $(nameId).textContent = entry.name || sym;
  $(midId).textContent = fmt(entry.mid, 2);
  const delta = $(pctId);
  delta.textContent = pct(entry.pct, 2);
  delta.className = `delta mono ${tone(entry.pct)}`;
  $(footId).textContent = `${entry.source || 'biquote · CFD mid'} · ${entry.state || '—'}${entry.unit ? ` · ${entry.unit}` : ''}`;
  setRangeBar(rangeId, entry);
  drawCommodity(sym, chartId, entry);
  if (state.lastMids[sym] != null && entry.mid != null && entry.mid !== state.lastMids[sym]) pulsePanel(panelId);
  if (entry.mid != null) state.lastMids[sym] = entry.mid;
}

/* Daily closes for the rotating PSX name. */
function drawFeature(bars, symbol) {
  const node = $('#feature-chart');
  if (!bars || bars.length < 2) {
    if (charts.feature) { charts.feature.destroy(); charts.feature = null; }
    placeholder(node, 'Not enough daily bars.');
    return;
  }
  const slice = bars.slice(-140);
  const first = slice[0];
  const last = slice.at(-1);
  const moved = (last.close / first.close - 1) * 100;

  $('#feature-title').textContent = symbol;
  $('#feature-meta').innerHTML = `<strong>${esc(symbol)}</strong><br>${fmt(last.close, 2)} · <span class="delta ${tone(moved)}">${pct(moved)}</span><br>${slice.length} sessions · DPS EOD`;

  if (!window.ForgeCharts?.available) { placeholder(node, 'Chart engine unavailable'); return; }
  if (!charts.feature) {
    charts.feature = window.ForgeCharts.create(node, {
      kind: 'area',
      precision: 2,
      unit: 'PKR',
      timeZone: 'Asia/Karachi',
      barSpacing: 6,
      baseline: true,
    });
  }
  if (charts.feature) charts.feature.setData(slice);
  else placeholder(node, 'Chart engine unavailable');
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
    return `<button type="button" class="pick-row ${state.symbol === r.symbol ? 'active' : ''}" data-symbol="${esc(r.symbol)}" data-index="${i}">
      <span class="pick-rank">${String(i + 1).padStart(2, '0')}</span>
      <span><span class="pick-sym">${esc(r.symbol)}</span><span class="pick-name">${esc(r.name || 'PSX')}</span></span>
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
    ${latest ? `<table class="ledger-table"><thead><tr><th>Symbol</th><th>Bucket</th><th>P&amp;L</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.symbol)}</td><td>${esc(r.bucket || 'mom')}</td><td class="delta ${tone(r.pnlPct)}">${pct(r.pnlPct, 1)}</td></tr>`).join('') || '<tr><td colspan="3">Cohort open</td></tr>'}
    </tbody></table>
    <p class="comm-foot">Cohort ${esc(latest.week)} · ${esc(latest.status)}</p>` : '<div class="empty">No cohort yet</div>'}`;
}

function renderBoard() {
  const d = state.data;
  if (!d) return;
  const b = d.breadth || {};
  $('#lcd-breadth').innerHTML = `
    <span class="chip">Symbols <b>${b.symbols ?? '—'}</b></span>
    <span class="chip up">Advancing <b>${b.advancers ?? '—'}</b></span>
    <span class="chip down">Declining <b>${b.decliners ?? '—'}</b></span>
    <span class="chip">Volume <b>${fmt(b.volume, 0)}</b></span>`;

  const watch = d.states?.watch || 'loading';
  setFeedDot('#feed-dps', watch === 'current' ? 'ok' : watch === 'cached' ? 'stale' : watch === 'unavailable' ? 'err' : 'loading');

  const comm = d.commodities || {};
  const bqStates = [comm.XAUUSD?.state, comm.USOIL?.state].filter(Boolean);
  const bq = bqStates.length && bqStates.every(s => s === 'current') ? 'ok'
    : bqStates.some(s => s === 'cached') ? 'stale'
      : bqStates.some(s => s === 'loading') || !bqStates.length ? 'loading' : 'err';
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
    placeholder($('#feature-chart'), 'History unavailable.');
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
  if (state.rotateMode === 1) { pulsePanel('#panel-xau'); return; }
  if (state.rotateMode === 2) { pulsePanel('#panel-oil'); return; }
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

window.ForgeTheme.mount('[data-action="theme"]');
syncClock();
setInterval(syncClock, 1000);
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 45000);
setInterval(() => { if (!document.hidden) rotateFeature(); }, 10000);
