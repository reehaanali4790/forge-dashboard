/* Forge chart layer.
   A thin, opinionated wrapper over TradingView Lightweight Charts (vendored,
   Apache-2.0) that gives every chart on the desk the same grid weight, axis
   type, crosshair, tooltip and directional colouring, in both themes.

   All colour comes from the CSS design tokens via ForgeTheme.colors(), so a
   theme switch repaints the canvases from the same source of truth as the DOM.
*/
(function () {
  'use strict';

  var LW = window.LightweightCharts;
  var live = [];

  /* ---- colour helpers ---------------------------------------------------- */
  function rgba(color, alpha) {
    var value = String(color || '').trim();
    if (value.charAt(0) === '#') {
      var hex = value.slice(1);
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      var n = parseInt(hex, 16);
      if (!isFinite(n)) return 'rgba(128,128,128,' + alpha + ')';
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }
    var parts = value.replace(/^rgba?\(|\)$/g, '').split(',');
    if (parts.length >= 3) {
      return 'rgba(' + parts[0].trim() + ',' + parts[1].trim() + ',' + parts[2].trim() + ',' + alpha + ')';
    }
    return 'rgba(128,128,128,' + alpha + ')';
  }

  /* ---- formatting -------------------------------------------------------- */
  function numberFormatter(precision, locale) {
    var nf = new Intl.NumberFormat(locale || 'en-GB', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
    return function (value) {
      return Number.isFinite(value) ? nf.format(value) : '-';
    };
  }

  function barTime(bar, intraday) {
    if (intraday) {
      var stamp = Date.parse(bar.time || bar.date);
      return Number.isFinite(stamp) ? Math.floor(stamp / 1000) : null;
    }
    var date = String(bar.date || bar.time || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  function timeKey(time) {
    return typeof time === 'object' && time
      ? time.year + '-' + String(time.month).padStart(2, '0') + '-' + String(time.day).padStart(2, '0')
      : String(time);
  }

  /* ---- chart option builders -------------------------------------------- */
  /* TradingView's own reading of a price chart: the overview (area) view is
     gridless apart from faint horizontals, the detailed (candle) view adds
     verticals and a volume shelf, and neither draws a scale border. */
  function chartOptions(opts, c, kind) {
    var candles = kind === 'candles';
    var withVolume = candles && Boolean(opts.volume);
    return {
      autoSize: true,
      layout: {
        /* Paint the panel colour rather than leaving the canvas transparent,
           so axis text antialiases against a known background. */
        background: { type: 'solid', color: c.surface },
        textColor: c['text-4'],
        fontFamily: '"Trebuchet MS", -apple-system, BlinkMacSystemFont, Roboto, Inter, sans-serif',
        fontSize: 11,
        attributionLogo: false
      },
      grid: {
        vertLines: { color: c.grid, style: 0, visible: candles && opts.vertLines !== false },
        horzLines: { color: c.grid, style: 0, visible: opts.horzLines !== false }
      },
      crosshair: {
        mode: LW.CrosshairMode.Magnet,
        vertLine: {
          color: c['border-strong'],
          width: 1,
          style: 0,
          labelVisible: true,
          labelBackgroundColor: c['text-4']
        },
        horzLine: {
          /* The overview view tracks the series with a marker dot only, the
             way TradingView's symbol page does. */
          visible: candles,
          labelVisible: candles,
          color: c['border-strong'],
          width: 1,
          style: 0,
          labelBackgroundColor: c['text-4']
        }
      },
      rightPriceScale: {
        borderVisible: false,
        entireTextOnly: true,
        scaleMargins: withVolume ? { top: 0.08, bottom: 0.26 } : { top: 0.12, bottom: 0.08 }
      },
      timeScale: {
        borderVisible: false,
        timeVisible: Boolean(opts.intraday),
        secondsVisible: false,
        rightOffset: opts.rightOffset == null ? 2 : opts.rightOffset,
        barSpacing: opts.barSpacing || 7,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true
      },
      localization: {
        locale: opts.locale || 'en-GB',
        priceFormatter: numberFormatter(opts.precision == null ? 2 : opts.precision, opts.locale)
      },
      handleScroll: opts.interactive !== false,
      handleScale: opts.interactive !== false,
      kineticScroll: { mouse: false, touch: false },
      trackingMode: { exitMode: LW.TrackingModeExitMode.OnNextTap }
    };
  }

  function seriesTint(opts, c, direction) {
    if (opts.tint && c[opts.tint]) return c[opts.tint];
    if (opts.directional === false) return c.info;
    return direction < 0 ? c.down : c.up;
  }

  /* ---- the handle -------------------------------------------------------- */
  function create(container, options) {
    if (!LW || !container) return null;
    var opts = options || {};
    var precision = opts.precision == null ? 2 : opts.precision;

    container.classList.add('lw-host');
    container.textContent = '';

    /* The canvas itself is opaque to assistive tech, so the readout is a live
       region, as the previous SVG chart's tooltip was. Arrow-key inspection
       therefore announces each bar. */
    var tip = document.createElement('div');
    tip.className = 'lw-tip';
    tip.setAttribute('data-open', '0');
    tip.setAttribute('role', 'status');
    tip.setAttribute('aria-live', 'polite');
    container.appendChild(tip);

    var kind = opts.kind === 'candles' ? 'candles' : 'area';
    var c = window.ForgeTheme.colors();
    var chart = LW.createChart(container, chartOptions(opts, c, kind));
    var price = null;
    var volume = null;
    var baseLine = null;
    var bars = [];
    var byKey = Object.create(null);
    var direction = 1;
    var format = numberFormatter(precision, opts.locale);

    var dateFormat = new Intl.DateTimeFormat(opts.locale || 'en-GB', opts.intraday
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: opts.timeZone || 'UTC' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: opts.timeZone || 'UTC' });

    function labelFor(bar) {
      var stamp = Date.parse(opts.intraday ? (bar.time || bar.date) : (String(bar.date || '').slice(0, 10) + 'T00:00:00Z'));
      return Number.isFinite(stamp) ? dateFormat.format(new Date(stamp)) : '-';
    }

    function priceFormat() {
      var step = Math.pow(10, -precision);
      return { type: 'price', precision: precision, minMove: Number(step.toFixed(precision)) };
    }

    function buildSeries() {
      var tokens = window.ForgeTheme.colors();
      var tint = seriesTint(opts, tokens, direction);
      /* Price lines belong to the series, so they go with it. */
      if (price) { chart.removeSeries(price); price = null; baseLine = null; }
      if (kind === 'candles') {
        price = chart.addCandlestickSeries({
          upColor: tokens.up,
          downColor: tokens.down,
          borderUpColor: tokens.up,
          borderDownColor: tokens.down,
          wickUpColor: rgba(tokens.up, .85),
          wickDownColor: rgba(tokens.down, .85),
          borderVisible: false,
          priceFormat: priceFormat(),
          priceLineVisible: true,
          priceLineWidth: 1,
          priceLineStyle: 1,
          lastValueVisible: true
        });
      } else {
        price = chart.addAreaSeries({
          lineColor: tint,
          lineWidth: 2,
          topColor: rgba(tint, .24),
          bottomColor: rgba(tint, .02),
          priceFormat: priceFormat(),
          priceLineVisible: true,
          priceLineWidth: 1,
          priceLineStyle: 1,
          priceLineColor: tint,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBorderColor: tokens.surface,
          crosshairMarkerBorderWidth: 2,
          crosshairMarkerBackgroundColor: tint,
          lineType: 0
        });
      }
      /* Volume sits under the candles only; the overview view stays clean. */
      var wantVolume = Boolean(opts.volume) && kind === 'candles';
      if (!wantVolume && volume) { chart.removeSeries(volume); volume = null; }
      if (wantVolume && !volume) {
        volume = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'forge-volume',
          lastValueVisible: false,
          priceLineVisible: false
        });
        chart.priceScale('forge-volume').applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 },
          borderVisible: false
        });
      }
    }

    /* The dotted reference line the window's change is measured from —
       TradingView's "Prev close". */
    function setBaseline() {
      if (!price || !opts.baseline || bars.length < 2) return;
      var tokens = window.ForgeTheme.colors();
      if (baseLine) { try { price.removePriceLine(baseLine); } catch (error) { /* gone with its series */ } }
      baseLine = price.createPriceLine({
        price: bars[0].close,
        color: tokens['text-4'],
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: opts.baselineLabel || ''
      });
    }

    function pushData() {
      var tokens = window.ForgeTheme.colors();
      var line = [];
      var candles = [];
      var vols = [];
      byKey = Object.create(null);
      for (var i = 0; i < bars.length; i += 1) {
        var bar = bars[i];
        var time = barTime(bar, opts.intraday);
        if (time == null) continue;
        byKey[timeKey(time)] = bar;
        line.push({ time: time, value: bar.close });
        candles.push({ time: time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
        if (opts.volume) {
          vols.push({
            time: time,
            value: Number(bar.volume) || 0,
            color: rgba(bar.close >= bar.open ? tokens.up : tokens.down, .3)
          });
        }
      }
      price.setData(kind === 'candles' ? candles : line);
      if (volume) volume.setData(vols);
      setBaseline();
      chart.timeScale().fitContent();
    }

    function applyChartOptions() {
      chart.applyOptions(chartOptions(opts, window.ForgeTheme.colors(), kind));
    }

    function hideTip() {
      tip.setAttribute('data-open', '0');
    }

    function placeTip(x, y) {
      var box = container.getBoundingClientRect();
      var w = tip.offsetWidth;
      var h = tip.offsetHeight;
      var left = x + 14;
      if (left + w > box.width - 6) left = x - w - 14;
      var top = y - h - 12;
      if (top < 4) top = y + 16;
      tip.style.left = Math.max(4, Math.min(box.width - w - 4, left)) + 'px';
      tip.style.top = Math.max(4, Math.min(box.height - h - 4, top)) + 'px';
    }

    function tooltip(param) {
      if (!param || !param.time) { hideTip(); return; }
      var bar = byKey[timeKey(param.time)];
      if (!bar) { hideTip(); return; }

      /* Pointer moves carry a point; keyboard-driven crosshairs do not, so
         fall back to projecting the bar through the scales. */
      var x = param.point ? param.point.x : chart.timeScale().timeToCoordinate(barTime(bar, opts.intraday));
      var y = param.point ? param.point.y : price.priceToCoordinate(bar.close);
      if (x == null || y == null || x < 0 || y < 0) { hideTip(); return; }

      var index = bars.indexOf(bar);
      var previous = index > 0 ? bars[index - 1].close : null;
      var delta = Number.isFinite(previous) && previous ? (bar.close / previous - 1) * 100 : null;
      var deltaClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'flat';
      var deltaText = delta == null ? '' :
        '<span class="move ' + deltaClass + '">' + (delta > 0 ? '+' : delta < 0 ? '−' : '') +
        Math.abs(delta).toFixed(2) + '%</span>';

      /* Value first, date under it — TradingView's reading order. */
      var html = '<div class="tip-price">' + format(bar.close) +
        (opts.unit ? '<em>' + opts.unit + '</em>' : '') + deltaText + '</div>' +
        '<div class="tip-date">' + labelFor(bar) + '</div>';

      if (kind === 'candles') {
        html += '<div class="tip-ohlc">' +
          '<span>Open <b>' + format(bar.open) + '</b></span>' +
          '<span>High <b>' + format(bar.high) + '</b></span>' +
          '<span>Low <b>' + format(bar.low) + '</b></span>' +
          '<span>Close <b>' + format(bar.close) + '</b></span>' +
          '</div>';
      }
      tip.innerHTML = html;
      tip.setAttribute('data-open', '1');
      placeTip(x, y);
    }

    chart.subscribeCrosshairMove(tooltip);

    buildSeries();

    var handle = {
      chart: chart,
      get bars() { return bars; },
      get kind() { return kind; },

      setData: function (next) {
        bars = (next || []).filter(function (bar) {
          return bar && Number.isFinite(bar.close);
        });
        if (!bars.length) return handle;
        var first = bars[0].close;
        var last = bars[bars.length - 1].close;
        var nextDirection = last >= first ? 1 : -1;
        var flipped = nextDirection !== direction;
        direction = nextDirection;
        /* Only the area series is tinted by the window's direction, so only it
           needs rebuilding when the window turns; candles never do. */
        if (flipped && kind === 'area') buildSeries();
        pushData();
        return handle;
      },

      setKind: function (next) {
        var wanted = next === 'candles' ? 'candles' : 'area';
        if (wanted === kind) return handle;
        kind = wanted;
        applyChartOptions();
        buildSeries();
        pushData();
        return handle;
      },

      /* Keyboard inspection: move the crosshair to a bar by index. */
      markIndex: function (index) {
        if (!bars.length) return -1;
        var at = Math.max(0, Math.min(bars.length - 1, index));
        var bar = bars[at];
        var time = barTime(bar, opts.intraday);
        if (time == null) return -1;
        chart.setCrosshairPosition(bar.close, time, price);
        return at;
      },

      clearMark: function () {
        chart.clearCrosshairPosition();
        hideTip();
      },

      applyTheme: function () {
        applyChartOptions();
        buildSeries();
        if (bars.length) pushData();
      },

      fit: function () { chart.timeScale().fitContent(); },

      destroy: function () {
        var at = live.indexOf(handle);
        if (at >= 0) live.splice(at, 1);
        try { chart.remove(); } catch (error) { /* already gone */ }
      }
    };

    live.push(handle);
    return handle;
  }

  window.ForgeCharts = {
    available: Boolean(LW),
    create: create,
    rgba: rgba
  };

  if (window.ForgeTheme) {
    window.ForgeTheme.onChange(function () {
      for (var i = 0; i < live.length; i += 1) {
        try { live[i].applyTheme(); } catch (error) { /* keep repainting the rest */ }
      }
    });
  }
})();
