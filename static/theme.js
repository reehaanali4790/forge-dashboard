/* Forge theme bootstrap. Loaded synchronously in <head> so the document is
   painted once, in the right theme. Exposes window.ForgeTheme for the page
   scripts and for the chart layer, which reads its colours from CSS tokens so
   JS and CSS can never drift apart. */
(function () {
  'use strict';

  var KEY = 'forge.theme.v2';
  var THEMES = { light: 1, dark: 1 };
  var PAGE_BG = { dark: '#000000', light: '#ffffff' };
  var root = document.documentElement;
  var listeners = [];
  var cache = {};

  function stored() {
    try {
      var value = localStorage.getItem(KEY);
      return THEMES[value] ? value : null;
    } catch (error) {
      return null;
    }
  }

  function system() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', PAGE_BG[theme]);
    cache = {};
  }

  /* Resolve a set of design tokens to concrete colour strings. */
  function colors(names) {
    var wanted = names || [
      'up', 'down', 'accent', 'accent-hi', 'info', 'warn',
      'text', 'text-2', 'text-3', 'text-4',
      'surface', 'surface-2', 'surface-3', 'bg',
      'border', 'border-soft', 'border-strong', 'grid', 'grid-strong'
    ];
    var style = null;
    var out = {};
    for (var i = 0; i < wanted.length; i += 1) {
      var name = wanted[i];
      if (cache[name] === undefined) {
        if (!style) style = getComputedStyle(root);
        cache[name] = style.getPropertyValue('--' + name).trim();
      }
      out[name] = cache[name];
    }
    return out;
  }

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function set(theme, remember) {
    if (!THEMES[theme] || theme === current()) return current();
    apply(theme);
    if (remember !== false) {
      try { localStorage.setItem(KEY, theme); } catch (error) { /* private mode */ }
    }
    for (var i = 0; i < listeners.length; i += 1) {
      try { listeners[i](theme); } catch (error) { /* keep other listeners alive */ }
    }
    return theme;
  }

  apply(stored() || system());

  /* Follow the OS only while the viewer has not chosen a theme here. */
  if (window.matchMedia) {
    var query = window.matchMedia('(prefers-color-scheme: light)');
    var onSystemChange = function () { if (!stored()) set(system(), false); };
    if (query.addEventListener) query.addEventListener('change', onSystemChange);
    else if (query.addListener) query.addListener(onSystemChange);
  }

  window.ForgeTheme = {
    get: current,
    set: function (theme) { return set(theme, true); },
    toggle: function () { return set(current() === 'light' ? 'dark' : 'light', true); },
    isLight: function () { return current() === 'light'; },
    colors: colors,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    /* Wire up every [data-action="theme"] control on the page. */
    mount: function (selector) {
      var nodes = document.querySelectorAll(selector || '[data-action="theme"]');
      var label = function (node) {
        var next = current() === 'light' ? 'dark' : 'light';
        node.setAttribute('aria-label', 'Switch to ' + next + ' mode');
        node.setAttribute('title', 'Switch to ' + next + ' mode');
      };
      Array.prototype.forEach.call(nodes, function (node) {
        label(node);
        node.addEventListener('click', function () { window.ForgeTheme.toggle(); });
      });
      window.ForgeTheme.onChange(function () {
        Array.prototype.forEach.call(nodes, label);
      });
    }
  };
})();
