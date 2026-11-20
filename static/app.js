'use strict';

const $ = (sel, base = document) => base.querySelector(sel);
const $$ = (sel, base = document) => [...base.querySelectorAll(sel)];
const icons = {
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5.1 8a7.8 7.8 0 0 1 13-2L20 9M4 15l1.9 3a7.8 7.8 0 0 0 13-2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pulse:'<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  chart:'<path d="M3 4v16h18M6 15l5-5 4 3 5-6"/>',
  candles:'<path d="M7 3v4m0 9v5m10-18v7m0 7v4"/><rect x="4" y="7" width="6" height="9" rx="1"/><rect x="14" y="10" width="6" height="7" rx="1"/>',
  mountain:'<path d="m3 19 6.1-13L14 16l2.7-5L21 19H3Z"/><path d="m7.6 10 1.5 1.2L11 10"/>',
  flame:'<path d="M12 22a7 7 0 0 0 7-7c0-3.5-1.7-5.5-3.2-6.8.2 2-1.1 2.8-2 3.1.3-3.7-1-6.3-3.9-9.3.4 3.3-1.3 5.9-3 8.2C5.7 11.8 5 13.5 5 15a7 7 0 0 0 7 7Z"/><path d="M12 22a3 3 0 0 0 3-3c0-1.4-.9-2.7-2.6-4-.3 1.8-3.4 2.6-3.4 4a3 3 0 0 0 3 3Z"/>',
  arrows:'<path d="M3 8h17m-4-4 4 4-4 4M21 16H4m4 4-4-4 4-4"/>',
  box:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5m-8 4.5v9"/>',
  diagonal:'<path d="M6 18 18 6M8 6h10v10"/>',
  arrowRight:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  up:'<path d="M7 16 17 6M9 6h8v8"/>',
  down:'<path d="m7 8 10 10m-8 0h8v-8"/>',
  dash:'<path d="M5 12h14"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  radio:'<circle cx="12" cy="12" r="2"/><path d="M8.4 8.4a5.1 5.1 0 0 0 0 7.2m7.2-7.2a5.1 5.1 0 0 1 0 7.2M5.6 5.6a9.1 9.1 0 0 0 0 12.8M18.4 5.6a9.1 9.1 0 0 1 0 12.8"/>',
  sparkle:'<path d="M10 3 8.2 8.2 3 10l5.2 1.8L10 17l1.8-5.2L17 10l-5.2-1.8L10 3ZM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6ZM18.5 3v4M16.5 5h4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m10 3-.7 2.2a7 7 0 0 0-1.8 1L5.2 6 3 9.5l1.6 1.7a7 7 0 0 0 0 1.6L3 14.5 5.2 18l2.3-.2a7 7 0 0 0 1.8 1l.7 2.2h4l.7-2.2a7 7 0 0 0 1.8-1l2.3.2 2.2-3.5-1.6-1.7a7 7 0 0 0 0-1.6L21 9.5 18.8 6l-2.3.2a7 7 0 0 0-1.8-1L14 3h-4Z"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M5 16h-1V4h12v1"/>',
  factory:'<path d="M3 21V10l6 4v-4l6 4V5h4l2 16H3Zm4-3h1m4 0h1m4 0h1"/>',
  package:'<path d="M4 6h16v14H4zM3 3h18v3H3zM10 11h4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9c5 5 5 13 0 18m0-18c-5 5-5 13 0 18"/>',
  file:'<path d="M6 3h8l4 4v14H6V3Z"/><path d="M13 3v5h5M9 12h6m-6 4h6"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M10 9v11"/>',
  upload:'<path d="M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  sliders:'<path d="M4 6h5m4 0h7M4 12h11m4 0h1M4 18h1m4 0h11M9 3v6m6 0v6M5 15v6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  eye:'<path d="M2 12s3.5-6.5 10-6.5 10 6.5 10 6.5-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  check:'<path d="m4 12 5 5 11-11"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.info}</svg>`;
const setIcons = (parent = document) => $$('[data-icon]', parent).forEach(node => node.innerHTML = icon(node.dataset.icon));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const safeHref = value => typeof value === 'string' && (value.startsWith('https://') || /^#[a-z-]+$/.test(value)) ? esc(value) : '#';
const external = (href, content, classes = '') => `<a ${classes ? `class="${classes}"` : ''} href="${safeHref(href)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
const fmt = (n, d = 0) => n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-GB', {minimumFractionDigits:d, maximumFractionDigits:d}).format(n);
const sign = (n, d = 2) => !Number.isFinite(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n),d);
const pct = (n,d = 2) => Number.isFinite(n) ? `${sign(n,d)}%` : '—';
const tone = n => n > 0 ? 'positive' : n < 0 ? 'negative' : 'flat';
const move = (n, d = 2, chip = false) => `<span class="move ${tone(n)} ${chip ? 'move-chip' : ''}">${icon(n > 0 ? 'up' : n < 0 ? 'down' : 'dash')}${pct(n,d)}</span>`;
const fmtPrice = (n, inst) => fmt(n, inst.precision);
const priceDeltaDigits = (inst, n) => inst.id === 'USDCNY' && Math.abs(n) < .01 && n !== 0 ? 3 : 2;
const validDate = value => { const d = new Date(value); return value && Number.isFinite(d.getTime()) ? d : null; };
const dateLabel = (value, opts = {}) => { const d = validDate(value); return d ? new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Shanghai',...opts}).format(d) : '—'; };
const timeLabel = value => { const d = validDate(value); return d ? new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(d) : '—'; };
const fullStamp = value => `${dateLabel(value)} · ${timeLabel(value)}`;
const state = {data:null, ref:null, id:'HC2701', range:'1M', mode:'line', news:'all', modalNews:'all', book:'local', bookAll:false, imported:[], dialog:null, trade:'all', tradeSource:'live', key:'', model:'openai/gpt-4.1-mini', provider:'openrouter', serverAgent:false, ai:null, aiShown:false, aiError:'', generating:false, deltaClock:0, psx:null, psxSymbol:null, psxBars:null};
const agentReady = () => Boolean(state.key || state.serverAgent);
const ranges = {'1W':7, '1M':30, '3M':91, '6M':182};
const categories = {steel:'Steel',inputs:'Raw materials',policy:'Policy',macro:'Macro'};
const bookInfo = {
  local: {currency:'PKR', label:'Local rates · CSV', note:'Live book is CSV imports only. No free public API covers Pakistan PKR offers — import your sheet. Not a live settlement feed.'},
  indenter: {currency:'USD', label:'Indenter asks · CSV', note:'Live book is CSV imports only. Supplier asks stay in this browser. These are not Chinese exchange quotes.'},
  benchmark: {currency:'USD', label:'Benchmarks · CSV', note:'Live book is CSV imports only. Helper / Trishmir / LME-style figures from the PDF are archive-only, not live settlements.'},
  archive: {currency:'MIXED', label:'Archive · 17 Nov', note:'Perfect Craft report transcriptions dated 17 Nov 2026. Archive only — not live market data.'},
};
const dataNow = () => new Date(Date.now()+state.deltaClock);
const quoteFor = (id=state.id) => state.data?.quotes?.[id];
const marketStatus = () => {
  if (!state.data) return ['loading','Checking feeds'];
  const list = Object.values(state.data.quotes);
  if (list.every(x=>x.state==='current') && state.data.news.state==='current') return ['current','Feeds connected'];
  if (list.some(x=>x.state==='current')) return ['cached','Some feeds delayed'];
  if (list.some(x=>x.value)) return ['cached','Cached quotes'];
  if (list.some(x=>x.state==='loading')) return ['loading','Checking feeds'];
  return ['unavailable','Quotes unavailable'];
};
const stateLabel = status => ({current:'Connected', cached:'Cached', dated:'Dated', loading:'Checking', unavailable:'Unavailable'}[status] || 'Unavailable');
function toast(message) {
  const node = $('#toast'); node.textContent = message; node.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(()=>{ node.hidden=true; },3400);
}
function syncHero() {
  const now = dataNow();
  $('#hero-date').textContent = dateLabel(now, {weekday:'short',year:'numeric'});
  $('#hero-date').dateTime = now.toISOString();
  $('#hero-clock').textContent = `${timeLabel(now)} China time`;
  $('#hero-clock').dateTime = now.toISOString();
  const [status, message] = marketStatus(), el = $('#feed-indicator');
  el.dataset.state = status;
  el.innerHTML = `<i class="status-dot ${status}"></i><span>${message}</span>`;
  const stamps = state.data ? Object.values(state.data.quotes).map(q=>q.fetchedAt).filter(Boolean).sort() : [];
  $('#quote-feed-meta').textContent = stamps.length ? `Sina Finance · ${status==='current' ? 'Auto-refresh 60s' : `Last checked ${timeLabel(stamps.at(-1))}`}` : 'Sina Finance · Provider quotes';
}
function sparkline(data, id, mood) {
  if (!data || data.length < 2) return '';
  const values = data.slice(-19).map(item=>item.close), color = mood==='positive' ? '#6dffb0' : mood==='negative' ? '#ff4d6d' : '#7a8aa3';
  const min = Math.min(...values), max = Math.max(...values), span = max-min || 1;
  const coords = values.map((v,i)=>[i/(values.length-1)*116,33-(v-min)/span*26]);
  const path = coords.map((pair, i)=>`${i ? 'L' : 'M'} ${pair[0].toFixed(1)} ${pair[1].toFixed(1)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 117 37" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="s-${id}" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${path} L116 37 L0 37Z" fill="url(#s-${id})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><circle cx="116" cy="${coords.at(-1)[1].toFixed(1)}" r="1.8" fill="${color}"/></svg>`;
}
function renderQuotes() {
  const oldFocus = document.activeElement?.dataset?.asset, old = $('#quotes');
  if (!state.data) return;
  const symbols = ['HC2701','I2701','JM2701','USDCNY'];
  old.innerHTML = symbols.map(id=>{
    const inst = state.data.instruments[id], entry = quoteFor(id), q = entry?.value, className = {I2701:'ore',JM2701:'coal',USDCNY:'fx'}[id] || '';
    return `<button type="button" class="quote-card" data-asset="${id}" aria-pressed="${state.id===id}" aria-label="${inst.name} ${q ? fmtPrice(q.last,inst) : 'unavailable'}; show chart" title="${q ? `Sina · ${fullStamp(q.asOf)} China time · vs ${inst.basis}` : 'No current quote'}">
      <span class="quote-head"><span class="ticker-icon ${className}">${icon(inst.icon)}</span><span><span class="quote-name">${inst.name}</span><span class="quote-code">${inst.id==='USDCNY' ? 'ONSHORE FX' : `${inst.venue} · ${id}`}</span></span><span class="quote-open">${icon('diagonal')}</span></span>
      <span class="quote-main"><strong class="quote-value">${fmtPrice(q?.last,inst)}</strong><span class="quote-unit">${inst.unit}</span></span>
      <span class="quote-bottom">${q ? move(q.pct,priceDeltaDigits(inst,q.pct),true) : '<span class="move flat">Unavailable</span>'}<span class="quote-date">${q ? (entry.state==='current' ? timeLabel(q.asOf) : `${stateLabel(entry.state)} · ${dateLabel(q.asOf)}`) : ''}</span></span>
      ${sparkline(state.data.history[id]?.value,id,tone(q?.pct))}</button>`;
  }).join('');
  if (oldFocus && document.activeElement === document.body) $(`button[data-asset="${oldFocus}"]`)?.focus({preventScroll:true});
}
function currentBars() {
  const all = state.data?.history[state.id]?.value || [];
  if (!all.length) return [];
  const threshold = Date.parse(all.at(-1).date) - ranges[state.range]*864e5;
  return all.filter(bar=>Date.parse(bar.date)>threshold);
}
let plotGeometry = null;
function niceTicks(lo, hi, target = 5) {
  const rough = (hi-lo || Math.max(1, Math.abs(lo)*.01)) / target;
  const power = Math.pow(10,Math.floor(Math.log10(rough)));
  const fraction = rough/power;
  const choice = [1,2,2.5,5,10].find(x=>x>=fraction) || 10;
  const step = choice*power;
  const begin = Math.floor(lo/step)*step, end = Math.ceil(hi/step)*step;
  const fixed = Array.from({length:Math.min(12,Math.round((end-begin)/step)+1)}, (_, i)=>begin+i*step);
  return {ticks:fixed.length>1?fixed:[lo-step,lo+step], step};
}
function renderChart() {
  const node = $('#plot'), select = $('#instrument'), inst = state.data?.instruments[state.id];
  $$('[data-range]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.range===state.range));
  $$('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.mode===state.mode));
  if (!inst) return;
  if (!select.options.length) select.innerHTML = Object.values(state.data.instruments).map(s=>`<option value="${s.id}">${s.name}${s.id==='USDCNY' ? ' · Onshore' : ` · ${s.id}`}</option>`).join('');
  if (select.value!==state.id) select.value=state.id;
  const q=quoteFor()?.value, history=state.data.history[state.id];
  $('#chart-quote').innerHTML = q ? `<strong>${fmtPrice(q.last,inst)}</strong><span class="chart-unit">${inst.unit}</span><span title="Versus ${inst.basis}">${move(q.pct,priceDeltaDigits(inst,q.pct),true)}</span>` : '<span class="mono muted">Quote unavailable</span>';
  const bars = currentBars();
  const end = bars.at(-1), first = bars[0], windowMove = bars.length>1 ? (end.close/first.close-1)*100 : null;
  const desc = bars.length ? `${state.mode==='line' ? 'Daily close' : 'Daily OHLC'} · ${dateLabel(first.date)} – ${dateLabel(end.date)}${history.state!=='current' ? ` · ${stateLabel(history.state)}` : ''}` : 'Daily history unavailable';
  $('#chart-foot').innerHTML = `<div class="chart-info">${external(inst.url, `Sina Finance ${icon('diagonal')}`)}<span class="chart-foot-extra" title="Latest daily bar may be provisional.">${desc}</span></div><div class="chart-actions">${bars.length>1 ? `<span class="chart-window mono ${tone(windowMove)}" title="First to last daily close in this window">${state.range} ${pct(windowMove)}</span>` : ''}<button type="button" data-action="download-series" aria-label="Download chart data CSV" title="Download visible series (CSV)" ${!bars.length ? 'disabled' : ''}>${icon('download')}</button></div>`;
  if (bars.length<2) { plotGeometry=null; node.classList.remove('chart-ready'); node.innerHTML = `<div class="empty">${history?.state==='loading' ? 'Loading daily prices…' : 'Not enough daily observations for this range.'}</div>`; return; }
  const w = Math.max(252,node.clientWidth||660), h = Math.max(160,node.clientHeight||255), compact = w<480, right = w-(compact?53:62), left = 10, bottom=h-24, top=15;
  const hi = Math.max(...bars.map(b=>state.mode==='candles'?b.high:b.close));
  const lo = Math.min(...bars.map(b=>state.mode==='candles'?b.low:b.close));
  const pad=(hi-lo||hi*.004)*.06;
  const {ticks,step} = niceTicks(lo-pad,hi+pad,4.5);
  const tLo=ticks[0], tHi=ticks.at(-1), span=tHi-tLo || 1;
  const innerLeft=left+3, innerRight=right-6;
  const x = i=>innerLeft+(innerRight-innerLeft)*i/(bars.length-1), y = v=>bottom-(bottom-top)*(v-tLo)/span;
  // Session spacing is intentional: weekends and holidays are omitted rather than interpolated.
  const labelCount=Math.min(bars.length,compact?4:6);
  const indexes = Array.from({length:labelCount},(_,i)=>Math.round(i*(bars.length-1)/(labelCount-1)));
  const tickDecimals = Math.min(inst.precision,step>=1 ? 0 : Math.min(4,String(Number(step.toPrecision(5))).split('.')[1]?.length||0));
  const ys = ticks.map(v=>`<line class="chart-gridline ${v===tLo?'base':''}" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-axis" x="${right+9}" y="${y(v)+3.4}">${fmt(v,tickDecimals)}</text>`).join('');
  const xs = indexes.map((i,j)=>`<line class="chart-gridline" opacity=".37" x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${bottom}"/><line class="chart-tick" x1="${x(i)}" x2="${x(i)}" y1="${bottom}" y2="${bottom+4}"/><text class="chart-axis" text-anchor="${j===0?'start':j===labelCount-1?'end':'middle'}" x="${x(i)}" y="${h-6}">${dateLabel(bars[i].date)}</text>`).join('');
  const line = bars.map((bar,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(bar.close).toFixed(2)}`).join(' ');
  const gap=(innerRight-innerLeft)/(bars.length-1), bw=Math.max(2, Math.min(10,gap*.58));
  const barsSVG=bars.map((b,i)=>{
    const topY=y(Math.max(b.open,b.close)), baseY=y(Math.min(b.open,b.close)), color=b.close>=b.open?'#6dffb0':'#ff4d6d', X=x(i);
    return `<line x1="${X}" x2="${X}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${color}" stroke-width="1"/><rect x="${X-bw/2}" y="${topY}" width="${bw}" height="${Math.max(1.35,baseY-topY)}" rx=".6" fill="${color}"/>`;
  }).join('');
  const lastY=y(end.close);
  const dataSVG = state.mode==='line' ? `<path fill="url(#price-fill)" d="${line} L${x(bars.length-1)},${bottom} L${x(0)},${bottom}Z"/><path class="chart-path" d="${line}"/>` : barsSVG;
  const markerValue = fmtPrice(end.close,inst), markWidth = compact ? 49 : 56, markY=Math.max(top+2,Math.min(lastY,bottom-2));
  const marker = `<line x1="${left}" x2="${right}" y1="${lastY}" y2="${lastY}" stroke="#00f0ff55" stroke-dasharray="3 4"/>${state.mode==='line' ? `<circle cx="${x(bars.length-1)}" cy="${lastY}" r="4" fill="#7af6ff" stroke="#05060a" stroke-width="1.6"/>` : ''}<rect x="${right+5}" y="${markY-8.5}" width="${markWidth}" height="17" rx="4" fill="#0a1824" stroke="#00f0ff66"/><text x="${right+5+markWidth/2}" y="${markY+3.4}" text-anchor="middle" style="fill:#7af6ff;font:500 ${compact?9:10}px var(--mono)">${markerValue}</text>`;
  node.classList.remove('chart-ready');
  node.innerHTML = `<svg class="series" viewBox="0 0 ${w} ${h}" role="img" aria-label="${inst.name} daily ${state.mode==='line'?'closes':'candles'}, ${state.range}, ${inst.unit}"><defs><linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#00f0ff" stop-opacity=".24"/><stop offset=".92" stop-color="#00c8d8" stop-opacity=".015"/></linearGradient></defs>${ys}${xs}${dataSVG}${marker}<g class="chart-hover" hidden><line class="hover-v" y1="${top}" y2="${bottom}"/><line class="hover-h" x1="${left}" x2="${right}"/><circle r="4.4"/></g></svg><div class="plot-tip" role="status" aria-live="polite" hidden></div>`;
  plotGeometry={bars,w,h,x,y,left,right,top,bottom,inst,hover:node.querySelector('.chart-hover'),tip:node.querySelector('.plot-tip'),at:null};
  requestAnimationFrame(()=>node.classList.add('chart-ready'));
}
function plotMark(i) {
  const g=plotGeometry;
  if (!g) return;
  i=Math.max(0,Math.min(g.bars.length-1,i));
  if (g.at===i && !g.tip.hidden) return;
  g.at=i; const b=g.bars[i], x=g.x(i), y=g.y(b.close);
  g.hover.removeAttribute('hidden');
  for (const key of ['x1','x2']) $('.hover-v',g.hover).setAttribute(key,x);
  for (const key of ['y1','y2']) $('.hover-h',g.hover).setAttribute(key,y);
  const point=$('circle',g.hover); point.setAttribute('cx',x); point.setAttribute('cy',y);
  const pre=g.bars[i-1]?.close;
  const valueD=Number.isFinite(pre)?pct((b.close/pre-1)*100,2):'';
  g.tip.innerHTML=`${dateLabel(b.date,{year:'numeric'})}<br><strong>${fmtPrice(b.close,g.inst)}</strong> ${g.inst.unit} ${valueD ? `<b>${valueD}</b>` : ''}${state.mode==='candles' ? `<div class="ohlc"><span>Open <b>${fmtPrice(b.open,g.inst)}</b></span><span>High <b>${fmtPrice(b.high,g.inst)}</b></span><span>Low <b>${fmtPrice(b.low,g.inst)}</b></span><span>Close <b>${fmtPrice(b.close,g.inst)}</b></span></div>` : ''}`;
  g.tip.hidden=false;
  g.tip.style.left=`${Math.max(1,Math.min(g.w-g.tip.offsetWidth-1,x<g.w/2?x+11:x-g.tip.offsetWidth-10))}px`;
  g.tip.style.top=`${Math.min(g.h-g.tip.offsetHeight-6,Math.max(4,y-g.tip.offsetHeight-13))}px`;
}
function clearPlot() {
  if (!plotGeometry) return;
  plotGeometry.hover.setAttribute('hidden',''); plotGeometry.tip.hidden=true; plotGeometry.at=null;
}
function newsAge(value) {
  const t=validDate(value); if (!t) return 'Undated';
  const h=Math.max(0,Math.floor((dataNow()-t)/36e5));
  return h===0?'Just in':h<24?`${h}h ago`:h<72?`${Math.floor(h/24)}d ago`:dateLabel(t);
}
function newsItem(item, absolute=false) {
  const category=categories[item.category]||'News';
  return `<a class="news-item" href="${safeHref(item.url)}" target="_blank" rel="noopener noreferrer"><div><div class="news-top"><span class="news-cat ${esc(item.category)}">${category}</span><span>${esc(item.publisher)}</span><span aria-hidden="true">·</span><time datetime="${esc(item.publishedAt)}" title="${fullStamp(item.publishedAt)} China time">${absolute ? fullStamp(item.publishedAt) : newsAge(item.publishedAt)}</time></div><span class="news-title">${esc(item.title)}</span></div><span class="news-arrow">${icon('diagonal')}</span></a>`;
}
function filteredNews(cat) {
  const list=(state.data?.news?.value||[]);
  return cat==='all'?list:list.filter(item=>item.category===cat);
}
function renderNews() {
  const list=filteredNews(state.news), news=state.data?.news;
  $$('#news-filters [data-news]').forEach(b=>b.setAttribute('aria-pressed',state.news===b.dataset.news));
  const status=$('#wire-status'), mood=news?.state==='current'?'current':news?.value?'cached':news?.state==='loading'?'loading':'unavailable';
  status.className=`sub-badge ${mood==='current'?'':mood==='cached'?'cached':'neutral'}`;
  status.innerHTML=`<i class="status-dot ${mood}"></i> ${mood==='current'?'NEWS FEED':mood==='cached'?'CACHED':mood==='loading'?'CHECKING':'NO FEED'}`;
  $('#news-list').innerHTML=list.length?list.slice(0,4).map(item=>newsItem(item)).join(''):`<div class="empty">${state.data ? (news?.value ? 'No recent headlines in this category.' : 'No headlines are available from the providers right now.') : 'Loading sourced headlines…'}</div>`;
  $('#headlines-count').textContent=list.length?`${Math.min(4,list.length)} / ${list.length}`:'';
}

function dataBrief() {
  const d=state.data, obs=[], refs={};
  if (!d) return null;
  const register = (id,label,url) => {refs[id]={label,url}; return id;};
  const usable = ['HC2701','I2701','JM2701','J2701','USDCNY'].filter(k=>d.quotes[k]?.value);
  const hrc=quoteFor('HC2701'), ore=quoteFor('I2701');
  let headline='Latest prices and the stories to watch';
  if (hrc?.value && ore?.value && hrc.state==='current' && ore.state==='current' && hrc.value.asOf.slice(0,10)===ore.value.asOf.slice(0,10)) {
    const [a,b]=[hrc.value.pct,ore.value.pct];
    if (a<0 && b>0) headline='Hot-rolled coil slips as iron ore ticks higher';
    else if (a>0 && b<0) headline='Hot-rolled coil rises while iron ore retreats';
    else if (a<0 && b<0) headline='Finished steel and iron ore both trade lower';
    else if (a>0 && b>0) headline='Finished steel and iron ore both edge higher';
  }
  if (usable.length) {
    const symbols=usable.slice(0,3);
    const text=symbols.map(k=>{
      const q=d.quotes[k], meta=d.instruments[k];
      return `${meta.short} ${pct(q.value.pct,priceDeltaDigits(meta,q.value.pct))}${q.state==='current' ? '' : ` (${dateLabel(q.value.asOf)} ${stateLabel(q.state).toLowerCase()})`}`;
    }).join(' · ');
    obs.push({label:'Latest quotes',text:`${text}. ${symbols.every(k=>k==='USDCNY')?'Change versus prior close.':'Futures changes are versus prior settlement.'}`,
      refs:symbols.map(k=>register(`q-${k}`,d.instruments[k].short,d.instruments[k].url))});
  }
  const inst=d.instruments[state.id], hist=d.history[state.id], bars=(hist?.value||[]).slice(-20);
  if (bars.length>1) {
    const a=bars[0], b=bars.at(-1), n=(b.close/a.close-1)*100;
    obs.push({label:'Trend in focus',text:`${inst.short} moved ${pct(n)} across ${bars.length} daily bars (${dateLabel(a.date)} – ${dateLabel(b.date)})${hist.state==='current' ? '' : ' on cached or dated history'}. This compares daily prices, not settlements.`,refs:[register(`trend-${state.id}`,'Daily series · Sina',inst.url)]});
  }
  const top=d.news?.value?.[0];
  if (top) {
    obs.push({label:d.news.state==='current'?'Lead headline':'Cached headline',text:`${top.publisher} (${dateLabel(top.publishedAt)}): ${top.title}`,refs:[register(top.id,top.publisher,top.url)]});
  } else if(d.macro?.value?.pmi) {
    const p=d.macro.value.pmi;
    obs.push({label:'Monthly context',text:`China manufacturing PMI was ${fmt(p.value,1)} in ${p.label}, versus ${fmt(p.previous,1)} the prior month. Readings below 50 indicate a contraction.`,refs:[register('pmi','PMI · NBS',p.url)]});
  }
  return {headline,observations:obs,refs};
}
function renderRefs(ids, dictionary) {
  return `<div class="brief-refs">${(ids||[]).map(id=>{
    const ref=dictionary?.[id];if (!ref) return '';
    const name=esc(ref.label);
    if (ref.url?.startsWith('#')) return `<a href="${safeHref(ref.url)}" class="ref-chip">${name} ${icon('arrowRight')}</a>`;
    return external(ref.url,`${name} ${icon('diagonal')}`,'ref-chip');
  }).join('')}</div>`;
}
function briefCards(list, refs, kind) {
  return `<div class="brief-cards">${list.map((card,i)=>`<div class="brief-card"><h4>${esc(card.label || `${kind} ${String(i+1).padStart(2,'0')}`)}</h4><p>${esc(card.text)}</p>${renderRefs(card.refs,refs)}</div>`).join('')}</div>`;
}
function renderBrief() {
  const data=state.aiShown && state.ai ? state.ai : dataBrief(), mode=Boolean(state.aiShown&&state.ai);
  const node=$('#brief-body');
  const err=state.aiError ? `<div class="inline-error" role="alert">${esc(state.aiError)}</div>` : '';
  const badge=`<span class="sub-badge ${mode?'cached':'neutral'}">${mode?'AI SYNTHESIS':'DATA BRIEF'}</span>`;
  node.innerHTML = err + (data?.observations?.length ? `<div class="brief-title-row"><h4>${esc(data.headline)}</h4>${badge}</div>${briefCards(data.observations,data.refs,'Observation')}${mode&&data.watch.length ? `<div class="ai-watch"><h4>Conditional outlook</h4>${briefCards(data.watch,data.refs,'Watch')}</div>` : ''}` : `<div class="empty">Waiting on source data for the brief.</div>`);
  node.style.animation='none';
  void node.offsetWidth;
  node.style.animation='';
  const changed=mode&&Object.entries(data.quoteTimes||{}).some(([id,ts])=>quoteFor(id)?.value?.asOf!==ts);
  const readyLabel = state.key
    ? `${state.provider==='nvidia'?'NVIDIA':'OpenRouter'} override · Run on demand`
    : state.serverAgent
      ? `Server ${state.provider==='nvidia'?'NVIDIA':'OpenRouter'} ready · Run on demand`
      : 'Computed from sources · Connect a key to unlock AI';
  $('#brief-status').innerHTML = mode ? `${icon('sparkle')} <span>${esc(data.model)} · ${fullStamp(data.generatedAt)}${changed?' · newer quotes available':''}</span>`
    : `<i class="status-dot ${state.generating?'loading':agentReady()?'current':'cached'}"></i><span>${state.generating?'Reading quotes, releases and headlines…':readyLabel}</span>`;
  $('#use-data-brief').hidden=!mode;
  const btn=$('#generate');
  btn.disabled=state.generating;
  btn.innerHTML=`<span class="${state.generating?'spin':''}">${icon(state.generating?'refresh':'sparkle')}</span> ${state.generating?'Building brief…':'Generate AI brief'}`;
}
function liveWatchCards() {
  if (state.aiShown && state.ai?.watch?.length) {
    return state.ai.watch.slice(0,3).map((w,i)=>({icon:['globe','factory','package'][i]||'globe', label:w.label, text:w.text, badge:'AI'}));
  }
  const cards=[], d=state.data;
  const pmi=d?.macro?.value?.pmi;
  if (pmi && Number.isFinite(pmi.value) && pmi.value < 50) {
    cards.push({icon:'factory', label:'Manufacturing contraction', text:`Official PMI is ${fmt(pmi.value,1)} in ${pmi.label} (below 50). Watch whether new orders and export orders keep softening before reading a demand rebound.`, badge:'NBS'});
  }
  const movers=['HC2701','I2701','JM2701'].map(id=>{
    const q=d?.quotes?.[id]; return q?.value ? {id, pct:q.value.pct, name:d.instruments[id].short, state:q.state} : null;
  }).filter(Boolean).sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct));
  if (movers[0] && Math.abs(movers[0].pct) >= 0.8) {
    const m=movers[0];
    cards.push({icon:'layers', label:`${m.name} move`, text:`${m.name} is ${pct(m.pct)} versus ${d.instruments[m.id].basis}${m.state==='current'?'':' (cached/dated)'}. Large single-session moves are catalysts until confirmed by the next session and physical offers.`, badge:'Sina'});
  }
  const policy=(d?.news?.value||[]).find(n=>n.category==='policy') || (d?.trade?.value?.items||[])[0];
  if (policy) {
    const title=policy.title || `${policy.country}: ${policy.product}`;
    const pub=policy.publisher || 'Policy wire';
    cards.push({icon:'globe', label:'Trade / policy headline', text:`${pub}: ${title}`, badge:'Wire'});
  }
  if (!cards.length && state.ref?.watch?.length) {
    return state.ref.watch.slice(0,1).map(w=>({...w, badge:'Archive'}));
  }
  return cards.slice(0,3);
}
function renderWatch() {
  const cards=liveWatchCards();
  $('#watch-list').innerHTML=cards.length
    ? cards.map(w=>`<article class="watch-card"><div class="watch-icon">${icon(w.icon||'globe')}</div><div><div class="watch-card-head"><h4>${esc(w.label)}</h4>${w.badge?`<span class="provenance ${w.badge==='Archive'?'':'imported'}">${esc(w.badge)}</span>`:''}</div><p>${esc(w.text)}</p></div></article>`).join('')
    : '<div class="empty">Waiting on live catalysts from PMI, quotes, or policy headlines.</div>';
}
function pmiSeries(p) {
  if (!p?.series?.length) return '';
  const series=p.series,w=605,H=106,top=12,ybot=86,start=14,end=561;
  const lower=Math.min(...series.map(x=>x.value),50)-.2,upper=Math.max(...series.map(x=>x.value),50)+.22;
  const x=i=>start+(end-start)*i/Math.max(1,series.length-1), y=v=>ybot-(v-lower)/(upper-lower)*(ybot-top);
  const d=series.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v.value)}`).join(' ');
  const tick=series.map((v,i)=>i%3===0 || i===series.length-1 ? `<text x="${x(i)}" y="104" text-anchor="${i===0?'start':i===series.length-1?'end':'middle'}" class="chart-axis">${dateLabel(v.period+'-01',{day:undefined})}</text>`:'').join('');
  return `<svg class="pmi-chart" viewBox="0 0 ${w} ${H}" preserveAspectRatio="none" aria-label="Official manufacturing PMI, last ${series.length} months" role="img"><defs><linearGradient id="pmi-fill" x2="0" y2="1"><stop stop-color="#00f0ff" stop-opacity=".2"/><stop offset="1" stop-color="#00f0ff" stop-opacity=".015"/></linearGradient></defs><line x1="${start}" x2="${end}" y1="${ybot}" y2="${ybot}" stroke="#00f0ff22"/><line x1="${start}" x2="${end}" y1="${y(50)}" y2="${y(50)}" stroke="#00f0ff44" stroke-dasharray="4 4"/><text x="${end+9}" y="${y(50)+3.4}" class="chart-axis">50.0</text>${tick}<path d="${d} L${end},${ybot}H${start}Z" fill="url(#pmi-fill)"/><path d="${d}" fill="none" stroke="#00f0ff" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${series.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v.value)}" r="${i===series.length-1?4:2.5}" fill="#7af6ff"><title>${dateLabel(v.period+'-01',{day:undefined,year:'numeric'})}: ${fmt(v.value,1)}</title></circle>`).join('')}</svg>`;
}
function renderFundamentals() {
  const d=state.data;if(!d) return;
  const frame=d.macro?.value,p=frame?.pmi;
  $('#pmi-panel').innerHTML=`<div class="panel-head"><div class="panel-title"><span class="title-icon">${icon('factory')}</span><h3>China manufacturing PMI</h3></div><span class="sub-badge ${d.macro.state==='current'?'neutral':'cached'}">${d.macro.state==='current'?'NBS · MONTHLY':stateLabel(d.macro.state).toUpperCase()}</span></div>${p ? `<div class="pmi-summary"><strong class="pmi-value">${fmt(p.value,1)}</strong><span class="move ${tone(p.value-p.previous)}">${icon(p.value<p.previous?'down':'up')}${sign(p.value-p.previous,1)} pts</span><span class="pmi-period">${p.label}</span></div>${pmiSeries(p)}<div class="pmi-detail">${[['Production',p.production],['New orders',p.orders],['Export orders',p.exportOrders]].map(([s,v])=>`<div><span>${s}</span><strong>${fmt(v,1)}</strong></div>`).join('')}</div><div class="panel-foot">${external(p.url,`Official NBS release ${icon('diagonal')}`)}<button type="button" class="text-button" data-action="pmi">View sub-indexes ${icon('arrowRight')}</button></div>`:'<div class="empty">Waiting on the official release.</div>'}`;
  const stat=(name,m)=>m?external(m.url,`<div class="macro-label">${name} ${icon('diagonal')}</div><strong>${pct(m.yoy,1)}</strong> <span class="mono">YoY</span><div class="stat-bottom">${pct(m.mom,1)} MoM · ${esc(m.label)}</div>`,'macro-stat'):`<div class="macro-stat"><div class="macro-label">${name}</div><strong>—</strong> <span class="mono">YoY</span></div>`;
  const expFeed=d.exports, exp=expFeed?.value;
  const mom=exp?.monthMoM, yoyLabel=mom==null ? (exp?.ytdYoY!=null?`${pct(exp.ytdYoY,1)} YTD YoY`:'—') : `${pct(mom,1)} MoM`;
  const momTone=mom==null?tone(exp?.ytdYoY):tone(mom);
  $('#releases-panel').innerHTML=`<div class="panel-head"><div class="panel-title"><span class="title-icon">${icon('globe')}</span><h3>Inflation &amp; exports</h3></div><span class="sub-badge ${expFeed?.state==='current'?'neutral':'cached'}">${expFeed?.state==='current'?'GACC · OFFICIAL':stateLabel(expFeed?.state||'loading').toUpperCase()}</span></div><div class="macro-grid">${stat('Consumer prices · CPI',frame?.cpi)}${stat('Producer prices · PPI',frame?.ppi)}</div>${exp?`<div class="export-line"><div><h4>${external(exp.url,`Finished steel exports ${icon('diagonal')}`)}</h4><p>${esc(exp.period)} · ${esc(exp.source)}</p></div><div class="export-aside"><strong>${fmt(exp.monthMt,2)} Mt</strong><div class="mono ${momTone}">${yoyLabel}</div></div></div><p class="export-baseline"><strong>${fmt(exp.ytdMt,1)} Mt</strong> ${esc(exp.ytdPeriod)} (${pct(exp.ytdYoY,1)} YoY)${exp.published?` · Published ${dateLabel(exp.published)}`:''}.</p>`: '<div class="empty">Waiting on the official GACC export table.</div>'}<div class="panel-foot"><span>NBS monthly · Exports from GACC · official table</span><span class="mono">Mt = million tonnes</span></div>`;
}
const IMPORT_STORE = 'forge.local-quotes.v1';
const seriesKey = row => [row.product,row.spec,row.currency].map(t=>t.trim().toLocaleLowerCase('en')).join('\u001f');
function bookRows() {
  if (state.book === 'archive') {
    return (state.ref?.rows || []).map(r => ({...r, archive:true}));
  }
  return state.imported.filter(r => r.book === state.book);
}
function bookGroups() {
  const groups = new Map();
  for (const row of bookRows()){
    const key=seriesKey(row);
    if (!groups.has(key)) groups.set(key,new Map());
    groups.get(key).set(row.date+'|'+row.source,row);
  }
  return [...groups.values()].map(g=>[...g.values()].sort((a,b)=>b.date.localeCompare(a.date)|| Number(!!b.imported)-Number(!!a.imported)));
}
const pricePrint = r => `${r.currency==='USD'?'$':''}${fmt(r.price,r.book==='benchmark' || r.price%1!==0 ? 2:0)}`;
function renderBook() {
  if (!Object.hasOwn(bookInfo, state.book)) state.book = 'local';
  const groups=bookGroups();
  const info=bookInfo[state.book];
  $$('[data-book]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.book===state.book));
  const extra = state.book!=='archive' && state.imported.some(x=>x.book===state.book) ? ' Includes this browser’s imports.' : '';
  $('#book-note').textContent=info.note + extra;
  const limit=state.bookAll?groups.length:5;
  const currencyHead = state.book==='archive' ? 'Price' : info.currency;
  const rows=groups.slice(0,limit).map((g,i)=>{
    const r=g[0], prev=g.find(s=>s.date<r.date && s.source===r.source); const change=prev ? (r.price/prev.price-1)*100:null;
    const badge = r.imported ? 'Import' : 'Archive';
    return `<tr><td><strong>${esc(r.product)}</strong><small>${esc(r.spec)}${state.book==='archive'?` · ${esc(r.book)}`:''}</small></td><td class="num"><strong>${pricePrint(r)}</strong></td><td class="num ${tone(change)}" title="Versus prior recorded observation from the same source">${pct(change,1)}</td><td class="as-of">${dateLabel(r.date)}</td><td><span class="provenance ${r.imported?'imported':''}" title="${esc(r.source)}">${badge}</span></td><td><button type="button" class="row-button" data-series="${i}" title="Price history" aria-label="${esc(r.product)} ${esc(r.spec)} price history">${icon('chart')}</button></td></tr>`;
  }).join('');
  const empty = state.book==='archive'
    ? 'No archive rows loaded from the 17 Nov report.'
    : 'No CSV imports yet. Use Import CSV to add live observations for this book.';
  $('#price-book').innerHTML=groups.length?`<table class="price-table" aria-label="${info.label}"><thead><tr><th>Product / specification</th><th class="num">${currencyHead}</th><th class="num">Change</th><th>As of</th><th>Source</th><th><span aria-label="History"></span></th></tr></thead><tbody>${rows}</tbody></table>`:`<div class="empty">${empty}</div>`;
  $('#book-footer').innerHTML=`<span>${Math.min(limit,groups.length)} of ${groups.length} specifications · ${state.book==='archive'?'Report archive':'CSV live book'}</span>${groups.length>5?`<button type="button" class="text-button" data-action="expand-book">${state.bookAll?'Show fewer':'View all specifications'} ${icon(state.bookAll?'chevronDown':'arrowRight')}</button>`:''}`;
}
function tradeRate(row) {
  if (row.status==='Investigation') return `<span class="trade-rate investigation">Investigation</span>`;
  if (row.status==='Policy signal') return `<span class="trade-rate investigation">Policy signal</span>`;
  return `<span class="trade-rate">${esc(row.rate || '—')}</span>`;
}
function liveTradeRows() {
  return state.data?.trade?.value?.items || [];
}
function archiveTradeRows() {
  return (state.ref?.trade || []).map(t => ({...t, source:'archive'}));
}
function renderTrade() {
  const feed=state.data?.trade;
  const list=liveTradeRows();
  const badge=feed?.state==='current'?'LIVE WIRE':stateLabel(feed?.state||'loading').toUpperCase();
  const head=$('.trade-panel .panel-head .sub-badge');
  if (head) { head.textContent=badge; head.className=`sub-badge ${feed?.state==='current'?'neutral':'cached'}`; }
  const note=$('.trade-panel > .book-note');
  if (note) note.textContent='Live register from policy headlines (anti-dumping, tariffs, steel duties). Confirm scope and rates with the authority. Slide 9 list is archive-only.';
  $('#trade-list').innerHTML=list.slice(0,5).map(t=>`<div class="trade-item"><div><h4>${esc(t.country)}</h4><p>${esc(t.product)}</p>${t.url?external(t.url,`${esc(t.publisher||'Coverage')} ${icon('diagonal')}`,'text-button'):''}</div><div class="trade-meta">${tradeRate(t)}<div class="mono">${dateLabel(t.date)}</div></div></div>`).join('') || '<div class="empty">Waiting on policy headlines for the trade register.</div>';
}
const defaultCost = {ore:100,coal:200,steel:600};
const preset = {ore:[1,0],coal:[0,1],both:[5,5],flat:[0,0]};
function getBase(id) {
  const el=$(`#base-${id}`), n=Number(el.value);
  return Number.isFinite(n)&&n>=1&&n<=10000 ? n:defaultCost[id];
}
function renderCost() {
  const ore=Number($('#ore-shift').value), coal=Number($('#coal-shift').value), pass=Number($('#pass-through').value);
  $('#ore-output').textContent=pct(ore,ore%1===0?0:1); $('#coal-output').textContent=pct(coal,coal%1===0?0:1); $('#pass-output').textContent=`${pass}%`;
  $$('.slider-field input').forEach(i=>i.style.setProperty('--fill',`${(i.value-i.min)/(i.max-i.min)*100}%`));
  $$('[data-scenario]').forEach(b=>{const [x,y]=preset[b.dataset.scenario];b.setAttribute('aria-pressed',x===ore&&y===coal);});
  const cost=((1.5*getBase('ore')*ore)+(.8*getBase('coal')*coal))/100, base=getBase('steel'), shift=cost*pass/100;
  const signedUSD = n => (n<0?'−':n>0?'+':'')+'$'+fmt(Math.abs(n),2);
  $('#cost-output').innerHTML=`<div><div class="eyebrow">ILLUSTRATIVE · NOT A LIVE PRICE</div><strong class="scenario-value">$${fmt(base+shift,2)}</strong> <span class="cost-unit">USD/t</span></div><div class="result-side"><strong class="${tone(cost)}">${signedUSD(cost)}/t input cost</strong><span>${pct((shift/base)*100)} steel price</span></div>`;
}
function renderMass() {
  const mass=state.ref?.mass||[];if(!mass.length)return;
  const sum=mass.reduce((a,b)=>a+b.weight,0);
  $('#mass').innerHTML=`<div class="mass-head"><strong>Inputs for 1 t of finished steel</strong><span>${fmt(sum,2)} t total</span></div><div class="mass-bar" aria-hidden="true">${mass.map(m=>`<span class="mass-segment ${m.color}" style="flex:${m.weight}"></span>`).join('')}</div><div class="mass-legend">${mass.map(m=>`<span title="${esc(m.note)}"><i class="mass-dot ${m.color}"></i>${esc(m.label)} <strong>${fmt(m.weight,2)} t</strong></span>`).join('')}</div>`;
}

function openDialog(type,title,kicker,markup,wide=false) {
  const dlg=$('#dialog'), already=dlg.open;
  if(!already) openDialog.opener=document.activeElement;
  state.dialog=type;
  $('#dialog-title').textContent=title; $('#dialog-kicker').textContent=kicker;
  $('#dialog-body').innerHTML=markup; dlg.classList.toggle('wide',wide);
  if(!already) dlg.showModal();
  dlg.scrollTop=0;
}
function openSources() {
  const d=state.data;
  const providerRows=Object.values(d?.instruments||{}).map(i=>{
    const q=d.quotes[i.id], h=d.history[i.id];
    return `<div class="dialog-source"><div><strong>${external(i.url,`${i.name} · ${i.id} ${icon('diagonal')}`)}</strong><p>${i.unit} · Change vs ${i.basis}. Daily history: ${stateLabel(h.state).toLowerCase()}.</p></div><span class="source-right">${stateLabel(q.state)}${q.value ? `<br>${fullStamp(q.value.asOf)}` : ''}</span></div>`;
  }).join('');
  const exp=d?.exports, tr=d?.trade;
  openDialog('sources','Sources & freshness','FORGE / DATA LINEAGE',`<p>All quote stamps are shown in China time (UTC+8). “Connected” means a provider fetch succeeded, not that an exchange is open or prices are tick real-time.</p><div class="data-legend"><span>Connected · provider responded</span><span>Cached · last successful pull</span><span>Dated · older market observation</span><span>Archive · 17 Nov PDF snapshot</span></div><h3>Sina Finance</h3>${providerRows||'<p class="muted">The market service is still loading.</p>'}<p>Quotes are checked every 60 seconds and daily history every 15 minutes. Futures use the specified Jan 2027 contract codes (${Object.keys(d?.instruments||{}).filter(k=>k!=='USDCNY').join(', ')||'HC2701 / I2701 / JM2701 / J2701'}); there is no automatic contract roll. The latest daily bar may be provisional.</p><h3>News, releases &amp; trade</h3><div class="dialog-source"><div><strong>Market wire</strong><p>Topic RSS via Google News, with Bing as a fallback. Headlines are ranked and deduplicated; links open the original coverage via the feed.</p></div><span class="source-right">${d?.news ? stateLabel(d.news.state) : 'Loading'}${d?.news?.fetchedAt ? `<br>${fullStamp(d.news.fetchedAt)}`:''}</span></div><div class="dialog-source"><div><strong>${external('https://www.stats.gov.cn/english/PressRelease/',`China NBS ${icon('diagonal')}`)}</strong><p>Official monthly PMI, CPI, and PPI releases. Checked hourly.</p></div><span class="source-right">${d?.macro ? stateLabel(d.macro.state) : 'Loading'}</span></div><div class="dialog-source"><div><strong>${external('http://english.customs.gov.cn/Statistics/Statistics',`GACC steel exports ${icon('diagonal')}`)}</strong><p>Official “(5) Major Exports” USD table, Products of steel or iron. Checked about every 6 hours.</p></div><span class="source-right">${exp ? stateLabel(exp.state) : 'Loading'}${exp?.fetchedAt ? `<br>${fullStamp(exp.fetchedAt)}`:''}</span></div><div class="dialog-source"><div><strong>Trade remedies</strong><p>Structured from policy RSS (anti-dumping, tariffs, steel duties). Not an official customs register.</p></div><span class="source-right">${tr ? stateLabel(tr.state) : 'Loading'}${tr?.fetchedAt ? `<br>${fullStamp(tr.fetchedAt)}`:''}</span></div><div class="dialog-source"><div><strong>PSX Data Portal</strong><p>Market watch and EOD series via dps.psx.com.pk (rotating X-Req-Id). Momentum Top 5 and ridge scores are screens, not advice. Paper ledger only. Commercial redistribution needs a PSX license. Gold (XAUUSD) and crude (USOIL) are biquote.io CFD mids with 1h OHLC — not exchange settlement. Open <span class="mono">/psx</span> for the neon LCD terminal.</p></div><span class="source-right">Board feed</span></div><div class="dialog-source"><div><strong>Perfect Craft · 17 Nov 2026 archive</strong><p>PDF outlook, slide-9 trade list, and commercial sheet transcriptions. Live price books are CSV imports only — Helper / Trishmir / LME figures in the deck are not live settlements.</p></div><a class="text-button" href="/report-blueprint.md" download>Blueprint ${icon('download')}</a></div><div class="callout">FOB, supplier, exchange and local rates have different terms and units. This dashboard does not fill an unavailable series with a different benchmark.</div>`,true);
}
function openArchive() {
  const watch=(state.ref?.watch||[]).map(w=>`<div class="dialog-source"><div><strong>${esc(w.label)}</strong><p>${esc(w.text)}</p></div></div>`).join('');
  openDialog('archive','17 Nov 2026 report outlook','PERFECT CRAFT / ARCHIVE',`<p>Original report framing only — not the live Market pulse, GACC exports, or policy trade register.</p><h3>The November 1–10 setup</h3><div class="dialog-source"><div><strong>Weak demand and rising HRC supply</strong><p>The report describes small-batch, needs-based buying and fading construction demand. Across 37 surveyed mills it reports HRC production up 1.1% week on week and mill inventories up 4.8% to 710,000 tonnes.</p></div></div><div class="dialog-source"><div><strong>Raw inputs and mill economics</strong><p>The deck cites high iron ore port stocks, weak steel-mill demand for coke and coal, and delayed winter restocking. It notes that low coking coal output and stocks could cushion declines even as weak end demand limits a recovery.</p></div></div><h3>Trade and demand evidence (deck)</h3><div class="dialog-source"><div><strong>85.7 million tonnes of steel exports, Jan–Sep</strong><p>Deck baseline only. Live GACC figures are under Inflation &amp; exports.</p></div></div><h3>Original “what to watch”</h3>${watch||'<p class="muted">No archived watch items.</p>'}<p class="callout">These catalysts were conditional in the deck. Prefer the live What to watch cards driven by PMI, quotes, and policy headlines.</p><div class="dialog-actions"><a class="text-button" href="/report-blueprint.md" download>Download the slide-by-slide blueprint ${icon('download')}</a></div>`);
}
function openSettings(wantRun=false) {
  const serverNote = state.serverAgent
    ? `<div class="callout">Server key is active (${esc(state.provider)} · ${esc(state.model)}). Leave the key blank to use it, or paste an override for this tab only.</div>`
    : `<div class="callout">Optional tab override. Prefer putting keys in the server <span class="mono">.env</span> file so they are never stored in the browser.</div>`;
  openDialog('settings','Agent setup','FORGE / ANALYST DESK',`<p>The data brief works without a key. Connect OpenRouter or NVIDIA for a sourced synthesis of quotes, releases and headlines.</p><form id="agent-form"><label class="field" for="provider-id">Provider<select id="provider-id" name="provider"><option value="openrouter">OpenRouter</option><option value="nvidia">NVIDIA Build</option></select></label><label class="field" for="api-key">API key (optional if server .env is set)<div class="secret-field"><input id="api-key" name="key" type="password" placeholder="sk-or-v1-… or nvapi-…" autocomplete="off" spellcheck="false"><button type="button" class="button icon-button" data-action="toggle-secret" aria-label="Show API key" aria-pressed="false">${icon('eye')}</button></div></label><label class="field" for="model-id">Model ID<input id="model-id" list="models" name="model" autocomplete="off" spellcheck="false" required><small>Use a model that can return JSON.</small></label><datalist id="models"><option value="openai/gpt-4.1-mini"><option value="google/gemini-2.5-flash"><option value="anthropic/claude-haiku-4.5"><option value="meta/llama-3.1-70b-instruct"><option value="nvidia/llama-3.1-nemotron-70b-instruct"></datalist>${serverNote}<p class="form-status" id="agent-form-status" role="status"></p><div class="dialog-actions"><button type="button" class="text-button muted" data-action="disconnect" ${state.key?'':'hidden'}>Forget override</button><button type="submit" class="button accent-button">${icon('sparkle')} ${wantRun?'Save & generate':'Save for this tab'}</button></div></form>`);
  $('#api-key').value=state.key; $('#model-id').value=state.model; $('#provider-id').value=state.provider;
  $('#agent-form').dataset.run=wantRun?'yes':'no';
}
function openNewsModal(category=state.news) {
  state.modalNews=category;
  const list=filteredNews(category);
  const status=state.data?.news;
  openDialog('news','Market headlines','FORGE / NEWSWIRE',`<p>Selected headlines from publisher feeds. Sorted by relevance; times are China time.${status?.value&&status.state!=='current' ? ` Showing cached items retrieved ${fullStamp(status.fetchedAt)}.`:''}</p><div class="filter-row" aria-label="Filter all headlines">${[['all','All news'],...Object.entries(categories)].map(([k,val])=>`<button type="button" data-modal-news="${k}" aria-pressed="${k===category}">${val}</button>`).join('')}</div><div>${list.length?list.map(n=>newsItem(n,true)).join(''):'<div class="empty">No headlines are available for this filter.</div>'}</div>`,true);
}
function openPmi() {
  const p=state.data?.macro?.value?.pmi; if(!p)return;
  const details=[['Manufacturing PMI',p.value],['Production',p.production],['New orders',p.orders],['New export orders',p.exportOrders],['Raw material inventories',p.rawInventory],['Finished goods inventories',p.finishedInventory],['Employment',p.employment],['Supplier delivery time',p.delivery]];
  openDialog('pmi','Manufacturing sub-indexes','FORGE / MONTHLY RELEASE',`<p>Official China NBS release for ${p.label}. 50 is the expansion/contraction threshold. The presentation’s order labels are ambiguous; this table follows the NBS definitions.</p><div class="table-scroll"><table class="price-table"><thead><tr><th>Index</th><th class="num">Reading</th></tr></thead><tbody>${details.map(([l,v])=>`<tr><td>${l}</td><td class="num">${fmt(v,1)}</td></tr>`).join('')}</tbody></table></div><div class="dialog-actions">${external(p.url,`Read official release ${icon('diagonal')}`,'text-button')}</div>`);
}
function openTrade(mode='all') {
  state.trade=mode;
  const live=liveTradeRows().filter(t=>mode==='all'||(mode==='duty'?t.status!=='Investigation':t.status==='Investigation'));
  const archive=archiveTradeRows();
  const feed=state.data?.trade;
  openDialog('trade','Trade remedy register','FORGE / POLICY WIRE',`<p>Live rows are normalized from policy headlines (anti-dumping, tariffs, steel duties). Dates are article dates, not verified effective dates. Confirm scope and rates with the authority.${feed?.state && feed.state!=='current' ? ` Showing ${stateLabel(feed.state).toLowerCase()} items.` : ''}</p><div class="filter-row" aria-label="Filter trade remedies">${[['all','All signals'],['duty','Duties / tariffs'],['investigation','Investigations']].map(([k,v])=>`<button type="button" data-trade-filter="${k}" aria-pressed="${k===mode}">${v}</button>`).join('')}</div><div class="table-scroll"><table class="price-table"><thead><tr><th>Jurisdiction / product</th><th>Status</th><th>Headline date</th></tr></thead><tbody>${live.length?live.map(t=>`<tr><td><strong>${esc(t.country)}</strong><small>${esc(t.product)}</small>${t.title?`<small>${esc(t.title)}</small>`:''}${t.url ? external(t.url,`${esc(t.publisher||'Coverage')} ${icon('diagonal')}`,'text-button') : ''}</td><td>${tradeRate(t)}</td><td class="as-of">${dateLabel(t.date,{year:'numeric'})}</td></tr>`).join(''):'<tr><td colspan="3">No live policy items for this filter.</td></tr>'}</tbody></table></div><h3>Archive · 17 Nov report snapshot</h3><p class="book-note">Slide 9 list from the Perfect Craft deck. Not the live register.</p><div class="table-scroll"><table class="price-table"><thead><tr><th>Jurisdiction / product</th><th>Status</th><th>Report date</th></tr></thead><tbody>${archive.map(t=>`<tr><td><strong>${esc(t.country)}</strong><small>${esc(t.product)}</small></td><td>${tradeRate(t)}</td><td class="as-of">${dateLabel(t.date,{year:'numeric'})}</td></tr>`).join('')}</tbody></table></div><div class="dialog-actions"><button type="button" class="text-button" data-action="policy-wire">Current policy headlines ${icon('arrowRight')}</button></div>`,true);
}
function openPriceSeries(index) {
  const rows=bookGroups()[index]; if(!rows?.length)return;
  const first=rows[0], chain=rows.filter(r=>r.source===first.source).slice().reverse();
  let spark='';
  if(chain.length>1){
    const w=600,h=156,l=8,r=572,t=13,b=129;
    const vals=chain.map(r=>r.price), low=Math.min(...vals), high=Math.max(...vals), pad=(high-low||1)*.17;
    const x=i=>l+(r-l)*i/(chain.length-1),y=v=>b-(b-t)*(v-low+pad)/(high-low+2*pad);
    const path=vals.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');
    spark=`<svg class="price-series-plot" role="img" aria-label="Observed asking prices from ${esc(first.source)}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path fill="#00f0ff14" d="${path} L${r},${b}H${l}Z"/><line x1="${l}" x2="${r}" y1="${b}" y2="${b}" class="chart-gridline base"/><path d="${path}" fill="none" stroke="#00f0ff" stroke-width="1.9" vector-effect="non-scaling-stroke"/>${chain.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.price)}" r="3" fill="#7af6ff"><title>${dateLabel(r.date)}: ${pricePrint(r)}</title></circle>`).join('')}<text class="chart-axis" x="${l}" y="${h-7}">${dateLabel(chain[0].date)}</text><text class="chart-axis" text-anchor="end" x="${r}" y="${h-7}">${dateLabel(first.date)}</text></svg>`;
  }
  const bookLabel = state.book==='archive' ? bookInfo.archive.label : bookInfo[first.book].label;
  openDialog('series',`${first.product} · ${first.spec}`,'FORGE / RECORDED OBSERVATIONS',`<p>${bookLabel} · ${first.currency}. ${spark?'The chart shows observations from the latest source only; spacing represents observations, not elapsed days.':'Only one observation is available from the latest source.'} Blank dates are not imputed.</p>${spark}<div class="table-scroll"><table class="price-table"><thead><tr><th>Observed</th><th>Source</th><th class="num">${first.currency}</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="as-of">${dateLabel(r.date,{year:'numeric'})}</td><td>${esc(r.source)}${r.page?` · slide ${r.page}`:''}</td><td class="num">${pricePrint(r)}</td></tr>`).join('')}</tbody></table></div>`,true);
}
function openImport() {
  openDialog('import','Import a price sheet','FORGE / LIVE CSV BOOK',`<p>Local, indenter, and benchmark books are CSV-only. PDF commercial sheets live under <strong>Archive · 17 Nov</strong> and are never treated as live prices.</p><div class="callout">CSV only: <span class="mono">book,product,spec,currency,price,date,source</span>. Use book values <span class="mono">local</span> (PKR), <span class="mono">indenter</span> (USD), or <span class="mono">benchmark</span> (USD), and <span class="mono">YYYY-MM-DD</span> dates. Match the product, specification, and currency to add to the same series.</div><form id="import-form"><label class="field" for="csv-file">Select a CSV file<input type="file" accept=".csv,text/csv" id="csv-file" required><small>Up to 600 rows. Imports stay in this browser and are never sent to the analyst or a server.</small></label><div class="form-status" id="import-status" role="status">${state.imported.length} imported observations in this tab.</div><div class="dialog-actions"><button type="button" class="text-button" data-action="csv-template">${icon('download')} CSV template</button><button class="button accent-button" type="submit">${icon('upload')} Import observations</button></div>${state.imported.length?`<label class="field inline"><input type="checkbox" id="clear-confirm"> Confirm removal of imported rows</label><button type="button" class="text-button muted" data-action="clear-imports">Remove all imports</button>`:''}</form>`);
}
function decodeCSV(text) {
  const lines=[];
  let line=[], field='', quoted=false, closed=false;
  const finishField=()=>{line.push(field.trim());field='';closed=false;};
  const finishLine=()=>{finishField();if(line.some(Boolean))lines.push(line);line=[];};
  text=text.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"') { if(text[i+1]==='"'){field+='"';i++;} else {quoted=false;closed=true;} }
      else field+=c;
    } else if(c===','){finishField();}
    else if(c==='\n'){finishLine();}
    else if(c==='"' && !field.trim() && !closed){quoted=true;field='';}
    else if(closed && c.trim()){throw new Error('Unexpected text after a quoted CSV field.');}
    else field+=c;
  }
  if(quoted)throw new Error('A quotation mark in the CSV is not closed.');
  finishLine();
  const header=lines.shift()?.map(h=>h.toLowerCase());
  const keys=['book','product','spec','currency','price','date','source'];
  if(!header || header.length!==keys.length || !keys.every(k=>header.includes(k)))throw new Error(`CSV columns must be: ${keys.join(', ')}.`);
  if(!lines.length||lines.length>600)throw new Error('Include between 1 and 600 data rows.');
  return lines.map((values,i)=>{
    const row=Object.fromEntries(header.map((name,j)=>[name,values[j]||'']));
    row.book=row.book.toLowerCase();row.currency=row.currency.toUpperCase();
    const price=Number(row.price);const stamp=validDate(row.date+'T00:00:00Z');
    if(values.length!==keys.length||!['local','indenter','benchmark'].includes(row.book)||row.currency!==bookInfo[row.book].currency)throw new Error(`Row ${i+2}: check the book and currency combination.`);
    if(!row.product||!row.spec||!row.source||[row.product,row.spec,row.source].some(x=>x.length>110||/[\u0000-\u001f]/.test(x)))throw new Error(`Row ${i+2}: product, specification and source are required (up to 110 characters each).`);
    if(!/^\d+(\.\d{1,4})?$/.test(row.price)||!Number.isFinite(price)||price<=0||price>1e7)throw new Error(`Row ${i+2}: price must be a positive number without a currency sign.`);
    if(!/^20\d\d-\d\d-\d\d$/.test(row.date)||!stamp||stamp.toISOString().slice(0,10)!==row.date||stamp>dataNow().getTime()+864e5)throw new Error(`Row ${i+2}: enter a valid observation date (YYYY-MM-DD).`);
    return {...row,price,imported:true};
  });
}
function writeImports() {
  try { localStorage.setItem(IMPORT_STORE,JSON.stringify(state.imported));return true; } catch {return false;}
}
function loadImports() {
  try {
    const stored=JSON.parse(localStorage.getItem(IMPORT_STORE)||'[]');
    if(Array.isArray(stored)) state.imported=stored.slice(0,1500).filter(row=>row&&['local','indenter','benchmark'].includes(row.book)&&row.currency===bookInfo[row.book].currency&&Number.isFinite(row.price)&&row.price>0&&[row.product,row.spec,row.date,row.source].every(v=>typeof v==='string'&&v.length<=110)).map(r=>({...r,imported:true}));
  } catch { state.imported=[]; }
}
function download(name,text,type='text/csv;charset=utf-8') {
  const link=document.createElement('a'), url=URL.createObjectURL(new Blob([text],{type}));
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function copyBrief() {
  const ai=state.aiShown?state.ai:null, data=ai||dataBrief(); if(!data?.observations.length)return;
  const renderLine=(card)=>`• ${card.label ? `${card.label}: `:''}${card.text}\n  ${card.refs.map(r=>data.refs[r]?.url||'').filter(Boolean).join(' · ')}`;
  const text=`Forge · ${ai?'AI synthesis':'Data brief'} · ${dateLabel(ai?.generatedAt||dataNow(),{year:'numeric'})}\n${data.headline}\n\n${data.observations.map(renderLine).join('\n')}${ai?.watch?.length?'\n\nConditional outlook\n'+ai.watch.map(renderLine).join('\n'):''}`;
  if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(()=>toast('Brief copied to clipboard.')).catch(()=>download('forge-market-brief.txt',text,'text/plain'));
  else download('forge-market-brief.txt',text,'text/plain');
}
async function request(url, method='GET', data) {
  const response=await fetch(url,{method,cache:'no-store',...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'The service could not complete the request.');
  return result;
}
function psxSpark(bars) {
  if (!bars || bars.length < 2) return '';
  const values = bars.slice(-40).map(b=>b.close);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const coords = values.map((v,i)=>[i/(values.length-1)*160, 36 - (v-min)/span*28]);
  const path = coords.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const up = values.at(-1) >= values[0];
  const color = up ? '#6dffb0' : '#ff4d6d';
  return `<svg class="psx-spark" viewBox="0 0 160 40" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function neonCommSpark(bars, accent) {
  if (!bars || bars.length < 2) return '';
  const values = bars.slice(-48).map(b => b.close).filter(Number.isFinite);
  if (values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const w = 88, h = 36;
  const coords = values.map((v, i) => [i / (values.length - 1) * w, h - 4 - (v - min) / span * (h - 8)]);
  const path = coords.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const color = accent === 'oil' ? '#ff8a3d' : '#ffd166';
  const area = `${path} L${w} ${h} L0 ${h} Z`;
  return `<svg class="psx-neon-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${area}" fill="${color}22"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function renderPsxCommodities() {
  const node = $('#psx-comm-strip');
  if (!node) return;
  const comm = state.psx?.commodities || {};
  const cards = [
    { key: 'XAUUSD', cls: 'gold', label: 'XAUUSD · Gold' },
    { key: 'USOIL', cls: 'oil', label: 'USOIL · Crude' },
  ];
  if (!comm.XAUUSD && !comm.USOIL) {
    node.innerHTML = '<div class="empty">Gold &amp; crude warming…</div>';
    return;
  }
  node.innerHTML = cards.map(({ key, cls, label }) => {
    const e = comm[key] || {};
    return `<a class="psx-comm-card ${cls}" href="/psx" title="Open neon terminal">
      <div><p class="tele">${label}</p><strong>${fmt(e.mid, 2)}</strong> <span class="delta mono ${tone(e.pct)}">${pct(e.pct, 2)}</span></div>
      ${neonCommSpark(e.bars, cls)}
      <div class="foot">${esc(e.source || 'biquote · CFD mid')} · ${esc(e.state || 'loading')}</div>
    </a>`;
  }).join('');
}
function renderPsxChart() {
  const node = $('#psx-chart'), foot = $('#psx-chart-foot'), badge = $('#psx-chart-symbol');
  const bars = state.psxBars, sym = state.psxSymbol;
  if (!sym) { node.innerHTML='<div class="empty">Pick a symbol from the Top 5 lists.</div>'; badge.textContent='—'; foot.textContent=''; return; }
  badge.textContent = sym;
  if (!bars || bars.length < 2) { node.innerHTML='<div class="empty">Loading daily series…</div>'; foot.textContent=''; return; }
  const slice = bars.slice(-90);
  const w = Math.max(280, node.clientWidth || 520), h = 180, left=8, right=w-48, top=12, bottom=h-22;
  const hi = Math.max(...slice.map(b=>b.high ?? b.close)), lo = Math.min(...slice.map(b=>b.low ?? b.close));
  const span = hi - lo || 1;
  const x = i => left + (right-left)*i/Math.max(1,slice.length-1);
  const y = v => bottom - (bottom-top)*(v-lo)/span;
  const path = slice.map((b,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`).join(' ');
  const first = slice[0], last = slice.at(-1), movePct = (last.close/first.close-1)*100;
  node.innerHTML = `<svg class="psx-plot" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(sym)} daily closes"><path d="${path} L${right},${bottom} H${left} Z" fill="#00f0ff18"/><path d="${path}" fill="none" stroke="#00f0ff" stroke-width="1.8" vector-effect="non-scaling-stroke"/><text class="chart-axis" x="${left}" y="${h-4}">${dateLabel(first.date)}</text><text class="chart-axis" text-anchor="end" x="${right}" y="${h-4}">${dateLabel(last.date)}</text><text class="chart-axis" x="${right+6}" y="${y(last.close)+3}">${fmt(last.close,2)}</text></svg>`;
  foot.innerHTML = `<span>${esc(sym)} · ${slice.length} sessions · ${pct(movePct)} window</span><span class="mono">DPS EOD</span>`;
}
async function selectPsxSymbol(symbol) {
  if (!symbol) return;
  state.psxSymbol = symbol;
  renderPsxBoard();
  try {
    const data = await request(`/api/psx/history?symbol=${encodeURIComponent(symbol)}`);
    state.psxBars = data.bars || [];
  } catch {
    state.psxBars = null;
  }
  renderPsxChart();
}
function renderPsxBoard() {
  const d = state.psx;
  if (!d) return;
  renderPsxCommodities();
  const b = d.breadth;
  $('#psx-breadth').innerHTML = b
    ? `<div class="psx-breadth-grid"><div><span>Symbols</span><strong>${b.symbols}</strong></div><div><span>Up</span><strong class="up">${b.advancers}</strong></div><div><span>Down</span><strong class="down">${b.decliners}</strong></div><div><span>Volume</span><strong class="mono">${fmt(b.volume,0)}</strong></div></div><div class="psx-fresh mono">${stateLabel(d.states?.watch||'loading')} · ${d.fetchedAt?.watch ? fullStamp(d.fetchedAt.watch) : 'warming'}</div>`
    : '<div class="empty">Waiting on DPS market watch…</div>';
  const mom = d.momentum || [];
  $('#psx-mom-badge').textContent = d.states?.ranks === 'current' ? 'LIVE SCREEN' : stateLabel(d.states?.ranks||'loading').toUpperCase();
  $('#psx-momentum').innerHTML = mom.length
    ? mom.map(r=>`<button type="button" class="psx-pick ${state.psxSymbol===r.symbol?'active':''}" data-psx-symbol="${esc(r.symbol)}"><div class="psx-pick-top"><strong>${esc(r.symbol)}</strong><span class="mono ${tone(r.weeklyPct)}">${pct(r.weeklyPct,1)} wk</span></div><div class="psx-pick-meta"><span>${fmt(r.last,2)} · day ${pct(r.pct,1)}</span><span class="mono">vol ${fmt(r.volume,0)}</span></div></button>`).join('')
    : '<div class="empty">Momentum Top 5 will appear after volume leaders have history.</div>';
  const model = d.model || [];
  $('#psx-model-badge').textContent = model.length ? 'RIDGE SCORE' : 'WARMING';
  $('#psx-model').innerHTML = model.length
    ? model.map(r=>`<button type="button" class="psx-pick ${state.psxSymbol===r.symbol?'active':''}" data-psx-symbol="${esc(r.symbol)}"><div class="psx-pick-top"><strong>${esc(r.symbol)}</strong><span class="mono ${tone(r.predictedWeeklyPct)}">${pct(r.predictedWeeklyPct,1)} pred</span></div><div class="psx-pick-meta"><span>±${fmt(r.bandPct,1)} band · ${fmt(r.last,2)}</span><span class="mono">vol ${fmt(r.volume,0)}</span></div></button>`).join('')
    : '<div class="empty">Model scores need pooled daily history from the volume leaders.</div>';
  const led = d.ledger || {}, cum = led.cumulative || {}, hit = led.hitRate || {}, latest = led.latest;
  $('#psx-ledger').innerHTML = `<div class="psx-ledger-sum"><div><span>Momentum paper</span><strong class="${tone(cum.momentumPct)}">${pct(cum.momentumPct,1)}</strong><small>${fmt(cum.momentumPkr,2)} PKR · hit ${hit.momentum==null?'—':pct(hit.momentum*100,0)}</small></div><div><span>Model paper</span><strong class="${tone(cum.modelPct)}">${pct(cum.modelPct,1)}</strong><small>${fmt(cum.modelPkr,2)} PKR · hit ${hit.model==null?'—':pct(hit.model*100,0)}</small></div></div>${latest?`<p class="book-note">Current cohort ${esc(latest.week)} · ${esc(latest.status)} · Rs ${fmt(latest.notionalPerName,0)} notional / name</p><div class="psx-cohort mono">${(latest.momentum||[]).map(l=>l.symbol).join(' · ')||'—'}</div>`:'<p class="book-note">A weekly cohort opens when the board first has Top 5 picks.</p>'}`;
  if (state.psxSymbol) renderPsxChart();
  else if (mom[0]?.symbol) selectPsxSymbol(mom[0].symbol);
}
async function refreshPsx(manual=false) {
  try {
    state.psx = await request(manual?'/api/psx/refresh':'/api/psx/overview', manual?'POST':'GET', manual?{}:undefined);
    renderPsxBoard();
    if (manual) toast('PSX board refreshed.');
  } catch {
    if (manual) toast('PSX service unavailable.');
    else if (!state.psx) {
      $('#psx-breadth').innerHTML='<div class="empty">PSX service unavailable.</div>';
    }
  }
}
function useSnapshot(data) {
  state.data=data;
  state.deltaClock=Date.parse(data.clock)-Date.now();
  if (data.agent) {
    state.serverAgent=Boolean(data.agent.ready);
    if (!state.key) {
      state.provider=data.agent.provider||'openrouter';
      state.model=data.agent.model||state.model;
    }
  }
  syncHero();renderQuotes();renderChart();renderNews();renderFundamentals();renderBrief();renderWatch();renderTrade();
}
let refreshing=false;
async function refresh(manual=false) {
  if(refreshing)return;
  const button=$('#refresh'); refreshing=true;
  if(manual){button.disabled=true;button.classList.add('spin');}
  try {
    const data=await request(manual?'/api/refresh':'/api/overview',manual?'POST':'GET',manual?{}:undefined);
    useSnapshot(data);
    if(manual)toast(marketStatus()[0]==='current'?'Latest available quotes and headlines loaded.':'Checked feeds. Some data may be cached or unavailable.');
  } catch {
    if(state.data){
      for(const entry of [...Object.values(state.data.quotes),...Object.values(state.data.history),state.data.news,state.data.macro])if(entry.value)entry.state='cached';
      syncHero();renderQuotes();renderChart();renderNews();renderFundamentals();renderBrief();renderWatch();renderTrade();
    } else {
      $('#feed-indicator').dataset.state='unavailable';
      $('#feed-indicator').innerHTML='<i class="status-dot unavailable"></i><span>Service unavailable</span>';
      $('#quotes').innerHTML='<div class="empty" style="grid-column:1/-1">Market service is unavailable. Try Refresh to reconnect.</div>';
    }
    if(manual)toast('Could not reach the data service.');
  } finally {refreshing=false;button.disabled=false;button.classList.remove('spin');}
}
async function generateBrief() {
  if (state.generating)return;
  if(!agentReady()){openSettings(true);return;}
  state.generating=true;state.aiError='';renderBrief();
  try {
    state.ai=await request('/api/brief','POST',{key:state.key||'',model:state.model,provider:state.provider,focus:state.id});
    state.aiShown=true;toast('AI market brief ready.');
  } catch(error) {
    state.aiError=error.message==='Failed to fetch' ? 'Could not reach the brief service. The data brief is still available.' : error.message;
    state.aiShown=false;
  } finally {state.generating=false;renderBrief();renderWatch();}
}
function setInstrument(id){if(!state.data?.instruments[id])return;state.id=id;renderQuotes();renderChart();if(!state.aiShown)renderBrief();}
function setCost(ore,coal){$('#ore-shift').value=ore;$('#coal-shift').value=coal;renderCost();}

document.addEventListener('click',event=>{
  const control=event.target.closest('button'); if(!control)return;
  const c=control.dataset;
  if(c.asset){setInstrument(c.asset);return;}
  if(c.range){state.range=c.range;renderChart();return;}
  if(c.mode){state.mode=c.mode;renderChart();return;}
  if(c.news){state.news=c.news;renderNews();return;}
  if(c.modalNews){openNewsModal(c.modalNews);$(`[data-modal-news="${c.modalNews}"]`)?.focus();return;}
  if(c.book){state.book=c.book;state.bookAll=false;renderBook();return;}
  if(c.series!==undefined){openPriceSeries(Number(c.series));return;}
  if(c.tradeFilter){openTrade(c.tradeFilter);$(`[data-trade-filter="${c.tradeFilter}"]`)?.focus();return;}
  if(c.scenario){setCost(...preset[c.scenario]);return;}
  if(c.psxSymbol){selectPsxSymbol(c.psxSymbol);return;}
  switch(c.action){
    case 'sources': openSources();break;
    case 'archive': openArchive();break;
    case 'refresh': refresh(true);break;
    case 'psx-refresh': refreshPsx(true);break;
    case 'settings': openSettings();break;
    case 'generate': generateBrief();break;
    case 'all-news': openNewsModal();break;
    case 'policy-wire': openNewsModal('policy');break;
    case 'trade': openTrade();break;
    case 'pmi': openPmi();break;
    case 'import': openImport();break;
    case 'copy-brief': copyBrief();break;
    case 'data-brief': state.aiShown=false;state.aiError='';renderBrief();renderWatch();break;
    case 'close': $('#dialog').close();break;
    case 'expand-book': state.bookAll=!state.bookAll;renderBook();$('[data-action="expand-book"]')?.focus({preventScroll:true});break;
    case 'toggle-secret': {
      const field=$('#api-key');field.type=field.type==='password'?'text':'password';
      control.setAttribute('aria-label',field.type==='password'?'Show API key':'Hide API key'); control.setAttribute('aria-pressed',field.type==='text'); break;
    }
    case 'disconnect': state.key='';state.aiError='';$('#dialog').close();renderBrief();toast('Tab override forgotten.');break;
    case 'csv-template': download('forge-price-sheet-template.csv','book,product,spec,currency,price,date,source\nlocal,HRC,Q195 · 3 mm,PKR,183,2026-11-16,Example supplier\n');break;
    case 'clear-imports': {
      if(!$('#clear-confirm')?.checked){$('#import-status').textContent='Confirm removal first.';return;}
      state.imported=[]; writeImports();$('#dialog').close();renderBook();toast('Imported observations removed.');break;
    }
    case 'download-series': {
      const rows=currentBars();if(!rows.length)return;
      const unit=state.data.instruments[state.id].unit;
      download(`forge-${state.id}-${state.range}.csv`,'date,symbol,unit,open,high,low,close,volume\n'+rows.map(b=>[b.date,state.id,unit,b.open,b.high,b.low,b.close,b.volume??''].join(',')).join('\n')+'\n');break;
    }
    case 'reset-cost': {
      for(const [k,v] of Object.entries(defaultCost))$(`#base-${k}`).value=v;
      $('#pass-through').value=100;setCost(1,0);break;
    }
  }
});
document.addEventListener('submit',async event=>{
  if(event.target.id==='agent-form'){
    event.preventDefault();
    const apiKey=$('#api-key').value.trim(), model=$('#model-id').value.trim(), provider=$('#provider-id').value.trim(), msg=$('#agent-form-status');
    const keyOk=!apiKey || (provider==='nvidia' ? /^nvapi-[A-Za-z0-9_-]{20,240}$/.test(apiKey) : /^sk-or-[A-Za-z0-9_-]{18,240}$/.test(apiKey));
    if(!keyOk||!/^[-\w.]+\/[-\w.:]+$/.test(model)||model.length>100||!['openrouter','nvidia'].includes(provider)){msg.textContent='Check the provider, API key and model ID.';msg.classList.add('error');return;}
    if(!apiKey && !state.serverAgent){msg.textContent='Add a key, or configure server .env first.';msg.classList.add('error');return;}
    state.key=apiKey;state.model=model;state.provider=provider;state.aiError='';$('#api-key').value='';$('#dialog').close();renderBrief();
    if(event.target.dataset.run==='yes')generateBrief();else toast(apiKey ? 'Provider override saved for this tab.' : 'Using server key for this tab.');
  } else if(event.target.id==='import-form'){
    event.preventDefault();const status=$('#import-status'), file=$('#csv-file').files[0];
    if(!file)return;
    try {
      if(file.size>220_000)throw new Error('CSV file must be 220 KB or smaller.');
      const rows=decodeCSV(await file.text()), merged=new Map();
      for(const r of [...state.imported,...rows])merged.set(`${r.book}|${seriesKey(r)}|${r.date}|${r.source}`,r);
      if(merged.size>1500)throw new Error('The browser price book supports up to 1,500 imported observations.');
      state.imported=[...merged.values()];
      const saved=writeImports();
      state.book=rows[0].book;state.bookAll=true;renderBook();$('#dialog').close();
      toast(`${rows.length} observation${rows.length===1?'':'s'} imported${saved?'.':' for this tab (browser storage is disabled).'}`);
    } catch(error) {status.textContent=error.message;status.classList.add('error');}
  }
});
$('#instrument').addEventListener('change',e=>setInstrument(e.target.value));
$$('.sliders input,.base-inputs input').forEach(i=>i.addEventListener('input',renderCost));
$('#dialog').addEventListener('close',()=>{state.dialog=null;$('#dialog-body').replaceChildren();openDialog.opener?.focus?.({preventScroll:true});});
$('#dialog').addEventListener('click',e=>{if(e.target!==$('#dialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
$('#plot').addEventListener('pointermove',e=>{
  const g=plotGeometry;if(!g)return;
  const x=e.clientX-e.currentTarget.getBoundingClientRect().left;
  plotMark(Math.round((x-g.x(0))/(g.x(g.bars.length-1)-g.x(0))*(g.bars.length-1)));
});
$('#plot').addEventListener('pointerleave',clearPlot);
$('#plot').addEventListener('blur',clearPlot);
$('#plot').addEventListener('keydown',e=>{
  const g=plotGeometry;if(!g)return;
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();plotMark(e.key==='Home'?0:e.key==='End'?g.bars.length-1:(g.at??g.bars.length-1)+(e.key==='ArrowLeft'?-1:1));}
  if(e.key==='Escape') clearPlot();
});
let priorSize='';
new ResizeObserver(entries=>{
  const r=entries[0].contentRect, sig=`${Math.round(r.width)}x${Math.round(r.height)}`;
  if(sig===priorSize)return;
  priorSize=sig;renderChart();
}).observe($('#plot'));
const nav=$$('.nav-link'), anchors=nav.map(link=>$(link.hash));
function navScroll(){
  const pos=$('.topbar').getBoundingClientRect().height+95;
  let current=0;
  for(let i=0;i<anchors.length;i++)if(anchors[i].getBoundingClientRect().top<pos)current=i;
  if(window.scrollY>0 && window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-8)current=anchors.length-1;
  nav.forEach((link,i)=>{link.classList.toggle('active',i===current);if(i===current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
}
window.addEventListener('scroll',navScroll,{passive:true});
window.addEventListener('hashchange',navScroll);
async function start() {
  setIcons();loadImports();renderCost();syncHero();navScroll();
  refresh();
  refreshPsx();
  try {state.ref=await request('/reference.json');renderWatch();renderBook();renderTrade();renderMass();}
  catch {$('#price-book').innerHTML='<div class="empty">The reference snapshot could not load.</div>';} 
  setTimeout(()=>refresh(),4200);setTimeout(()=>refresh(),9500);
  setTimeout(()=>refreshPsx(),8000);
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  setInterval(()=>{if(!document.hidden)refreshPsx();},60000);
  setInterval(()=>{if(!document.hidden && state.data)syncHero();},10000);
}
start();
