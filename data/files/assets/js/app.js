/* =====================================================================
   SDE Prep Dojo - app.js
   ---------------------------------------------------------------------
   One self-contained IIFE. No build step. Works from file:// and http://.
   Reads:  window.SITEMAP (assets/js/sitemap.js)
           <body data-page-id="..." data-root="..">
   Injects: top bar, sidebar, "On this page" TOC, prev/next pager,
            Mark-as-done button, code copy + highlight.js, shared SVG
            arrow markers, and wires steppers, tabs, quizzes, videos,
            interview Q&A (chips, expand/collapse, filter bar).
   Rule: never throw. Every feature runs inside safe(); storage is
   wrapped in try/catch so private windows / blocked storage still work.
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. Tiny helpers
     ------------------------------------------------------------------ */
  var doc = document;
  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  };

  /* el("div", {class: "x", text: "hi", onclick: fn}, [children]) */
  function el(tag, attrs, children) {
    var node = doc.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : String(v));
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === "string" ? doc.createTextNode(c) : c);
    });
    return node;
  }

  function safe(name, fn) {
    try { fn(); } catch (e) {
      if (window.console && console.warn) console.warn("[dojo] " + name + " failed:", e);
    }
  }

  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------------
     1. Site data: flatten SITEMAP, find current page, resolve root
     ------------------------------------------------------------------ */
  var SITEMAP = window.SITEMAP || { title: "SDE Prep Dojo", sections: [] };
  var body = doc.body;
  var PAGE_ID = (body && body.getAttribute("data-page-id")) || "";
  var ROOT = ((body && body.getAttribute("data-root")) || ".").replace(/\/+$/, "") || ".";
  var LEVEL_NAMES = { 1: "Kid", 2: "Beginner", 3: "Intermediate", 4: "Advanced", 5: "Interview-ready" };

  var PAGES = [];        // flat list in SITEMAP order
  var SECTION_OF = {};   // page id -> section
  (SITEMAP.sections || []).forEach(function (sec) {
    (sec.pages || []).forEach(function (p) {
      PAGES.push(p);
      SECTION_OF[p.id] = sec;
    });
  });
  var CURRENT = null;
  PAGES.forEach(function (p) { if (p.id === PAGE_ID) CURRENT = p; });

  function href(file) { return ROOT === "." ? file : ROOT + "/" + file; }

  /* Done pages: localStorage "dojo-done" = array of page ids */
  var DONE_KEY = "dojo-done";
  function getDone() {
    var d = store.get(DONE_KEY, []);
    return Array.isArray(d) ? d : [];
  }
  function isDone(id) { return getDone().indexOf(id) !== -1; }
  function setDone(id, on) {
    var d = getDone().filter(function (x) { return x !== id; });
    if (on) d.push(id);
    store.set(DONE_KEY, d);
    refreshProgress();
  }

  /* ------------------------------------------------------------------
     2. Theme (data-theme on <html>, remembered, default from OS)
     ------------------------------------------------------------------ */
  var THEME_KEY = "dojo-theme";
  function preferredTheme() {
    var saved = store.get(THEME_KEY, null);
    if (saved === "light" || saved === "dark") return saved;
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    catch (e) { return "light"; }
  }
  function applyTheme(theme) {
    doc.documentElement.setAttribute("data-theme", theme);
    var btn = $(".theme-toggle");
    if (btn) {
      btn.textContent = theme === "dark" ? "☀️" : "🌙";
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
      btn.title = btn.getAttribute("aria-label");
    }
    var css = doc.getElementById("hljs-theme");
    if (css) css.href = HLJS_BASE + "styles/" + (theme === "dark" ? "github-dark" : "github") + ".min.css";
  }
  function toggleTheme() {
    var next = doc.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    store.set(THEME_KEY, next);
    applyTheme(next);
  }

  /* ------------------------------------------------------------------
     3. Layout shell: make sure body > .layout > main.content exists
     ------------------------------------------------------------------ */
  function ensureLayout() {
    var main = $("main");
    if (!main) return null;
    if (!main.classList.contains("content")) main.classList.add("content");
    var layout = main.closest(".layout");
    if (!layout) {
      layout = el("div", { class: "layout" });
      main.parentNode.insertBefore(layout, main);
      layout.appendChild(main);
    }
    if (!main.id) main.id = "main";
    return { main: main, layout: layout };
  }

  /* ------------------------------------------------------------------
     4. Top bar: hamburger, logo, search, progress, theme toggle
     ------------------------------------------------------------------ */
  function buildTopbar() {
    if ($(".topbar")) return;
    var skip = el("a", { class: "skip-link", href: "#main", text: "Skip to content" });
    var burger = el("button", {
      class: "hamburger", type: "button", "aria-label": "Open menu", "aria-expanded": "false",
      onclick: function () {
        var open = body.classList.toggle("sidebar-open");
        burger.setAttribute("aria-expanded", open ? "true" : "false");
      }
    }, [el("span"), el("span"), el("span")]);
    var logo = el("a", { class: "logo", href: href("index.html") }, [
      el("span", { class: "logo-icon", "aria-hidden": "true", text: "🥋" }),
      el("span", { class: "logo-text", text: SITEMAP.title || "SDE Prep Dojo" })
    ]);
    var search = buildSearch();
    var progress = el("div", { class: "progress", title: "Pages marked as done" }, [
      el("div", { class: "progress-bar" }, [el("span", { class: "progress-fill" })]),
      el("span", { class: "progress-label" })
    ]);
    var theme = el("button", { class: "theme-toggle", type: "button", onclick: toggleTheme });
    var bar = el("header", { class: "topbar" }, [burger, logo, search, progress, theme]);
    body.insertBefore(bar, body.firstChild);
    body.insertBefore(skip, body.firstChild);

    // backdrop closes the mobile sidebar
    body.appendChild(el("div", {
      class: "sidebar-backdrop",
      onclick: function () { body.classList.remove("sidebar-open"); burger.setAttribute("aria-expanded", "false"); }
    }));
  }

  /* Search index: every page title + every section title */
  function buildSearchIndex() {
    var items = [];
    (SITEMAP.sections || []).forEach(function (sec) {
      var first = (sec.pages || [])[0];
      if (first) items.push({ title: sec.title, sub: "Section", icon: sec.icon || "", file: first.file, id: first.id });
      (sec.pages || []).forEach(function (p) {
        items.push({
          title: p.title, sub: sec.title + " · L" + p.level + " " + (LEVEL_NAMES[p.level] || ""),
          icon: sec.icon || "", file: p.file, id: p.id
        });
      });
    });
    return items;
  }

  /* Fuzzy score: substring beats word-start beats subsequence. 0 = no match */
  function fuzzyScore(text, query) {
    var t = text.toLowerCase(), q = query.toLowerCase().trim();
    if (!q) return 0;
    var idx = t.indexOf(q);
    if (idx === 0) return 1000 - t.length;
    if (idx > 0) return (/\W/.test(t.charAt(idx - 1)) ? 800 : 600) - idx;
    // every word of the query appears somewhere
    var words = q.split(/\s+/);
    if (words.length > 1 && words.every(function (w) { return t.indexOf(w) !== -1; })) return 500;
    // subsequence match, rewarding consecutive characters
    var ti = 0, score = 0, streak = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var ch = q.charAt(qi);
      if (ch === " ") continue;
      var found = t.indexOf(ch, ti);
      if (found === -1) return 0;
      streak = found === ti ? streak + 1 : 0;
      score += 1 + streak * 2;
      ti = found + 1;
    }
    return 100 + score - Math.min(t.length, 60) / 10;
  }

  function buildSearch() {
    var index = buildSearchIndex();
    var input = el("input", {
      type: "search", placeholder: "Search pages...", "aria-label": "Search pages",
      autocomplete: "off", spellcheck: "false"
    });
    var results = el("div", { class: "search-results", role: "listbox" });
    var wrap = el("div", { class: "search" }, [input, results]);
    var active = -1;

    function close() { results.innerHTML = ""; results.classList.remove("open"); active = -1; }
    function setActive(i) {
      var links = $$(".search-item", results);
      if (!links.length) return;
      active = (i + links.length) % links.length;
      links.forEach(function (a, j) { a.classList.toggle("active", j === active); });
      links[active].scrollIntoView({ block: "nearest" });
    }
    function render() {
      var q = input.value;
      if (!q.trim()) { close(); return; }
      var hits = index.map(function (it) {
        return { it: it, s: Math.max(fuzzyScore(it.title, q), fuzzyScore(it.sub, q) * 0.5) };
      }).filter(function (h) { return h.s > 0; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
      results.innerHTML = "";
      if (!hits.length) {
        results.appendChild(el("div", { class: "search-empty", text: "No pages match \"" + q + "\"" }));
      } else {
        hits.forEach(function (h) {
          results.appendChild(el("a", { class: "search-item", href: href(h.it.file), role: "option" }, [
            el("span", { class: "search-icon", text: h.it.icon }),
            el("span", { class: "search-title", text: h.it.title }),
            el("span", { class: "search-sub", text: h.it.sub })
          ]));
        });
      }
      results.classList.add("open");
      active = -1;
      if (hits.length) setActive(0);
    }

    input.addEventListener("input", render);
    input.addEventListener("focus", function () { if (input.value) render(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") {
        var links = $$(".search-item", results);
        var target = links[active >= 0 ? active : 0];
        if (target) { e.preventDefault(); window.location.href = target.getAttribute("href"); }
      } else if (e.key === "Escape") { close(); input.blur(); }
    });
    doc.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    // "/" focuses search unless the user is typing somewhere
    doc.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
    return wrap;
  }

  /* ------------------------------------------------------------------
     5. Sidebar: sections (collapsible), pages, level dots, done ticks
     ------------------------------------------------------------------ */
  var OPEN_KEY = "dojo-nav-open";
  function buildSidebar(shell) {
    if (!shell || $(".sidebar")) return;
    var openMap = store.get(OPEN_KEY, {}) || {};
    var nav = el("nav", { class: "sidebar", "aria-label": "Site navigation" });
    var currentSec = CURRENT ? SECTION_OF[CURRENT.id] : null;

    (SITEMAP.sections || []).forEach(function (sec) {
      var isCurrentSec = currentSec && currentSec.id === sec.id;
      var open = isCurrentSec || openMap[sec.id] === true;
      var list = el("ul", { class: "nav-pages" });
      (sec.pages || []).forEach(function (p) {
        var a = el("a", {
          class: "nav-link" + (CURRENT && p.id === CURRENT.id ? " current" : ""),
          href: href(p.file), "data-id": p.id, title: p.title + " (Level " + p.level + ", " + p.mins + " min)"
        }, [
          el("span", { class: "level-dot", "data-level": p.level, title: "Level " + p.level + " - " + (LEVEL_NAMES[p.level] || "") }),
          el("span", { class: "nav-title", text: p.title }),
          el("span", { class: "tick", "aria-hidden": "true", text: "✓" })
        ]);
        if (CURRENT && p.id === CURRENT.id) a.setAttribute("aria-current", "page");
        a.addEventListener("click", function () { body.classList.remove("sidebar-open"); });
        list.appendChild(el("li", null, [a]));
      });
      var head = el("button", {
        class: "nav-section-title", type: "button", "aria-expanded": open ? "true" : "false"
      }, [
        el("span", { class: "nav-icon", "aria-hidden": "true", text: sec.icon || "" }),
        el("span", { class: "nav-section-name", text: sec.title }),
        el("span", { class: "nav-count", "data-section": sec.id }),
        el("span", { class: "nav-caret", "aria-hidden": "true", text: "▸" })
      ]);
      var block = el("div", {
        class: "nav-section" + (open ? " open" : "") + (isCurrentSec ? " current" : ""),
        "data-section": sec.id, style: sec.color ? "--section-color:" + sec.color : null
      }, [head, list]);
      head.addEventListener("click", function () {
        var nowOpen = block.classList.toggle("open");
        head.setAttribute("aria-expanded", nowOpen ? "true" : "false");
        var m = store.get(OPEN_KEY, {}) || {};
        m[sec.id] = nowOpen;
        store.set(OPEN_KEY, m);
      });
      nav.appendChild(block);
    });
    var anchor = shell.main;
    while (anchor.parentNode && anchor.parentNode !== shell.layout) anchor = anchor.parentNode;
    shell.layout.insertBefore(nav, anchor.parentNode === shell.layout ? anchor : shell.layout.firstChild);
    // keep the current page visible in a long sidebar
    var cur = $(".nav-link.current", nav);
    if (cur) setTimeout(function () { try { cur.scrollIntoView({ block: "center" }); window.scrollTo(0, 0); } catch (e) { /* ignore */ } }, 0);
  }

  /* Update progress bar, sidebar ticks/counts and the done button */
  function refreshProgress() {
    var done = getDone();
    var known = PAGES.filter(function (p) { return done.indexOf(p.id) !== -1; }).length;
    var pct = PAGES.length ? Math.round((known / PAGES.length) * 100) : 0;
    var fill = $(".progress-fill");
    if (fill) fill.style.width = pct + "%";
    var label = $(".progress-label");
    if (label) label.textContent = known + "/" + PAGES.length + " done";
    $$(".nav-link").forEach(function (a) { a.classList.toggle("done", done.indexOf(a.getAttribute("data-id")) !== -1); });
    (SITEMAP.sections || []).forEach(function (sec) {
      var c = $('.nav-count[data-section="' + sec.id + '"]');
      if (!c) return;
      var n = (sec.pages || []).filter(function (p) { return done.indexOf(p.id) !== -1; }).length;
      c.textContent = n + "/" + (sec.pages || []).length;
      c.classList.toggle("complete", n === (sec.pages || []).length && n > 0);
    });
    var btn = $(".done-btn");
    if (btn && CURRENT) {
      var on = done.indexOf(CURRENT.id) !== -1;
      btn.classList.toggle("is-done", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "✓ Done - click to undo" : "Mark as done";
    }
  }

  /* ------------------------------------------------------------------
     6. "On this page" TOC from main section > h2, with scroll-spy
     ------------------------------------------------------------------ */
  function slugify(s) {
    return (s || "").toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "section";
  }
  function buildToc(shell) {
    if (!shell || $(".toc")) return;
    var heads = $$("section > h2", shell.main);
    if (heads.length < 2) return;
    var used = {};
    var list = el("ul");
    var links = [];
    heads.forEach(function (h) {
      var target = h;
      var sec = h.parentNode;
      if (!h.id) {
        // prefer the section id; otherwise make one from the heading text
        if (sec && sec.id && !used[sec.id]) { target = sec; }
        else {
          var base = slugify(h.textContent), id = base, i = 2;
          while (doc.getElementById(id) || used[id]) id = base + "-" + (i++);
          h.id = id;
        }
      }
      used[target.id] = true;
      var a = el("a", { href: "#" + target.id, text: h.textContent.trim() });
      links.push({ a: a, h: h });
      list.appendChild(el("li", null, [a]));
    });
    var toc = el("aside", { class: "toc", "aria-label": "On this page" }, [el("h4", { text: "On this page" }), list]);
    shell.layout.appendChild(toc);

    var ticking = false;
    function spy() {
      ticking = false;
      var current = links[0];
      links.forEach(function (l) { if (l.h.getBoundingClientRect().top < 140) current = l; });
      if ((window.innerHeight + window.scrollY) >= doc.documentElement.scrollHeight - 4) current = links[links.length - 1];
      links.forEach(function (l) { l.a.classList.toggle("active", l === current); });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(spy); }
    }, { passive: true });
    spy();
  }

  /* ------------------------------------------------------------------
     7. Done button + prev/next pager (SITEMAP order)
     ------------------------------------------------------------------ */
  function buildPager(shell) {
    if (!shell || !CURRENT || $(".pager")) return;
    var i = PAGES.indexOf(CURRENT);
    var prev = PAGES[i - 1], next = PAGES[i + 1];
    var btn = el("button", {
      class: "done-btn", type: "button",
      onclick: function () { setDone(CURRENT.id, !isDone(CURRENT.id)); }
    });
    var pager = el("nav", { class: "pager", "aria-label": "Previous and next page" }, [
      prev ? el("a", { class: "pager-prev", href: href(prev.file), rel: "prev" }, [
        el("span", { class: "pager-dir", text: "← Previous" }), el("span", { class: "pager-title", text: prev.title })
      ]) : el("span", { class: "pager-spacer" }),
      next ? el("a", { class: "pager-next", href: href(next.file), rel: "next" }, [
        el("span", { class: "pager-dir", text: "Next →" }), el("span", { class: "pager-title", text: next.title })
      ]) : el("span", { class: "pager-spacer" })
    ]);
    shell.main.appendChild(el("div", { class: "done-wrap" }, [btn]));
    shell.main.appendChild(pager);
  }

  /* ------------------------------------------------------------------
     8. Code: copy buttons + highlight.js from cdnjs (silent offline)
     ------------------------------------------------------------------ */
  var HLJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/";
  var EXTRA_LANGS = ["dockerfile", "yaml", "bash", "python", "java", "go", "sql", "json", "properties"];

  function addCopyButtons() {
    $$("pre").forEach(function (pre) {
      if (pre.querySelector(".copy-btn")) return;
      if (getComputedStyle(pre).position === "static") pre.style.position = "relative";
      var btn = el("button", { class: "copy-btn", type: "button", "aria-label": "Copy code", text: "Copy" });
      btn.addEventListener("click", function () {
        var code = pre.querySelector("code") || pre;
        var text = code.innerText.replace(/\n$/, "");
        // terminal blocks: copy only the commands (lines starting with "$ ")
        if (pre.classList.contains("terminal")) {
          var cmds = text.split("\n").filter(function (l) { return /^\s*\$ /.test(l); })
            .map(function (l) { return l.replace(/^\s*\$ /, ""); });
          if (cmds.length) text = cmds.join("\n");
        }
        copyText(text, function (ok) {
          btn.textContent = ok ? "Copied!" : "Press Ctrl+C";
          btn.classList.toggle("copied", ok);
          setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600);
        });
      });
      pre.appendChild(btn);
    });
  }
  function copyText(text, cb) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { cb(true); }, function () { cb(fallbackCopy(text)); });
        return;
      }
    } catch (e) { /* fall through */ }
    cb(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = el("textarea", { style: "position:fixed;top:-1000px;opacity:0" });
      ta.value = text;
      body.appendChild(ta);
      ta.select();
      var ok = doc.execCommand("copy");
      body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  function loadScript(src, cb) {
    var s = doc.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = function () { cb(true); };
    s.onerror = function () { cb(false); };
    doc.head.appendChild(s);
  }
  function setupHighlight() {
    var blocks = $$('pre code[class*="language-"]');
    if (!blocks.length) return;
    if (!doc.getElementById("hljs-theme")) {
      var theme = doc.documentElement.getAttribute("data-theme") === "dark" ? "github-dark" : "github";
      doc.head.appendChild(el("link", { id: "hljs-theme", rel: "stylesheet", href: HLJS_BASE + "styles/" + theme + ".min.css" }));
    }
    function run() {
      try {
        if (!window.hljs) return;
        window.hljs.configure({ ignoreUnescapedHTML: true });
        blocks.forEach(function (b) {
          var m = /language-([\w-]+)/.exec(b.className);
          if (m && !window.hljs.getLanguage(m[1])) return; // unknown language: leave plain
          try { window.hljs.highlightElement(b); } catch (e) { /* ignore */ }
        });
      } catch (e) { /* ignore */ }
    }
    function loadLangs() {
      if (!window.hljs) return;
      var missing = EXTRA_LANGS.filter(function (l) { return !window.hljs.getLanguage(l); });
      if (!missing.length) { run(); return; }
      var left = missing.length;
      missing.forEach(function (l) {
        loadScript(HLJS_BASE + "languages/" + l + ".min.js", function () { if (--left === 0) run(); });
      });
    }
    if (window.hljs) loadLangs();
    else loadScript(HLJS_BASE + "highlight.min.js", function (ok) { if (ok) loadLangs(); });
  }

  /* ------------------------------------------------------------------
     9. Shared SVG arrow markers (#arrow, #arrow-alt)
        Injected into every inline svg that references them but lacks
        them. Fill uses CSS variables so the arrow follows the theme.
     ------------------------------------------------------------------ */
  var SVGNS = "http://www.w3.org/2000/svg";
  function makeMarker(id, fill) {
    var m = doc.createElementNS(SVGNS, "marker");
    m.setAttribute("id", id);
    m.setAttribute("class", "arrowhead " + id);
    m.setAttribute("viewBox", "0 0 10 10");
    m.setAttribute("refX", "9");
    m.setAttribute("refY", "5");
    m.setAttribute("markerWidth", "7");
    m.setAttribute("markerHeight", "7");
    m.setAttribute("orient", "auto-start-reverse");
    var p = doc.createElementNS(SVGNS, "path");
    p.setAttribute("d", "M0,0 L10,5 L0,10 z");
    p.setAttribute("style", "fill:" + fill + ";stroke:none");
    m.appendChild(p);
    return m;
  }
  function injectMarkers() {
    $$("svg").forEach(function (svg) {
      var src = svg.innerHTML;
      var needs = [];
      if (/url\(\s*['"]?#arrow['"]?\s*\)/.test(src) && !svg.querySelector("marker#arrow")) needs.push("arrow");
      if (/url\(\s*['"]?#arrow-alt['"]?\s*\)/.test(src) && !svg.querySelector("marker#arrow-alt")) needs.push("arrow-alt");
      if (!needs.length) return;
      var defs = svg.querySelector("defs");
      if (!defs) { defs = doc.createElementNS(SVGNS, "defs"); svg.insertBefore(defs, svg.firstChild); }
      needs.forEach(function (id) {
        defs.appendChild(makeMarker(id, id === "arrow"
          ? "var(--arrow-color, var(--muted, currentColor))"
          : "var(--arrow-alt-color, var(--accent, currentColor))"));
      });
    });
  }

  /* ------------------------------------------------------------------
     10. Stepper: [data-stepper] with [data-step] / [data-step-only]
     ------------------------------------------------------------------ */
  function setupSteppers() {
    $$("[data-stepper]").forEach(function (box) {
      if (box.getAttribute("data-stepper-ready")) return;
      box.setAttribute("data-stepper-ready", "1");
      var stepEls = $$("[data-step]", box);
      var onlyEls = $$("[data-step-only]", box);
      var captions = $$(".stepper-captions > li", box);
      var total = captions.length;
      stepEls.forEach(function (e) { total = Math.max(total, parseInt(e.getAttribute("data-step"), 10) || 0); });
      onlyEls.forEach(function (e) { total = Math.max(total, parseInt(e.getAttribute("data-step-only"), 10) || 0); });
      if (total < 1) return;
      var cur = 1, timer = null;

      var prevBtn = el("button", { type: "button", class: "step-prev", "aria-label": "Previous step", text: "◀ Prev" });
      var playBtn = el("button", { type: "button", class: "step-play", "aria-label": "Play", text: "▶ Play" });
      var nextBtn = el("button", { type: "button", class: "step-next", "aria-label": "Next step", text: "Next ▶" });
      var resetBtn = el("button", { type: "button", class: "step-reset", "aria-label": "Reset", text: "↺ Reset" });
      var counter = el("span", { class: "step-counter", "aria-live": "polite" });
      var dots = el("div", { class: "stepper-dots" });
      for (var i = 1; i <= total; i++) {
        (function (n) {
          dots.appendChild(el("button", {
            type: "button", class: "dot", "aria-label": "Go to step " + n,
            onclick: function () { stop(); go(n); }
          }));
        })(i);
      }
      var controls = el("div", { class: "stepper-controls" }, [prevBtn, playBtn, nextBtn, resetBtn, counter]);
      var capList = $(".stepper-captions", box);
      if (capList) box.insertBefore(controls, capList); else box.appendChild(controls);
      box.insertBefore(dots, controls.nextSibling);

      function show(node, on) {
        node.classList.toggle("step-visible", on);
        node.classList.toggle("step-hidden", !on);
        if (on) node.removeAttribute("aria-hidden"); else node.setAttribute("aria-hidden", "true");
      }
      function go(n) {
        cur = Math.max(1, Math.min(total, n));
        stepEls.forEach(function (e) { show(e, cur >= (parseInt(e.getAttribute("data-step"), 10) || 0)); });
        onlyEls.forEach(function (e) { show(e, cur === (parseInt(e.getAttribute("data-step-only"), 10) || 0)); });
        captions.forEach(function (li, j) {
          li.classList.toggle("active", j + 1 === cur);
          li.classList.toggle("past", j + 1 < cur);
        });
        $$(".dot", dots).forEach(function (d, j) {
          d.classList.toggle("active", j + 1 === cur);
          d.classList.toggle("past", j + 1 < cur);
        });
        counter.textContent = "Step " + cur + " / " + total;
        prevBtn.disabled = cur === 1;
        nextBtn.disabled = cur === total;
        box.setAttribute("data-current-step", cur);
      }
      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
        playBtn.textContent = "▶ Play";
        playBtn.setAttribute("aria-label", "Play");
        box.classList.remove("playing");
      }
      function play() {
        if (cur >= total) go(1);
        playBtn.textContent = "❚❚ Pause";
        playBtn.setAttribute("aria-label", "Pause");
        box.classList.add("playing");
        timer = setInterval(function () {
          if (cur >= total) { stop(); return; }
          go(cur + 1);
          if (cur >= total) stop();
        }, 2500);
      }
      prevBtn.addEventListener("click", function () { stop(); go(cur - 1); });
      nextBtn.addEventListener("click", function () { stop(); go(cur + 1); });
      resetBtn.addEventListener("click", function () { stop(); go(1); });
      playBtn.addEventListener("click", function () { if (timer) stop(); else play(); });
      captions.forEach(function (li, j) {
        li.addEventListener("click", function () { stop(); go(j + 1); });
      });
      if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "0");
      box.addEventListener("keydown", function (e) {
        if (e.target.tagName === "INPUT") return;
        if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(cur + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(cur - 1); }
        else if (e.key === "Home") { e.preventDefault(); stop(); go(1); }
        else if (e.key === "End") { e.preventDefault(); stop(); go(total); }
      });
      go(1);
    });
  }

  /* ------------------------------------------------------------------
     11. Tabs: [data-tabs] > .tab-panel[data-title]
         data-tabs="group" remembers and syncs every tabs of that group
     ------------------------------------------------------------------ */
  var TABS_KEY = "dojo-tabs";
  function selectTab(tabs, title) {
    var panels = $$(":scope > .tab-panel", tabs);
    var match = panels.filter(function (p) { return p.getAttribute("data-title") === title; })[0];
    if (!match) return false;
    panels.forEach(function (p) {
      var on = p === match;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    $$(":scope > .tab-buttons > .tab-btn", tabs).forEach(function (b) {
      var on = b.getAttribute("data-title") === title;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    return true;
  }
  function setupTabs() {
    var memory = store.get(TABS_KEY, {}) || {};
    $$("[data-tabs]").forEach(function (tabs, ti) {
      if ($(":scope > .tab-buttons", tabs)) return;
      var panels = $$(":scope > .tab-panel", tabs);
      if (!panels.length) return;
      var group = tabs.getAttribute("data-tabs") || "";
      var bar = el("div", { class: "tab-buttons", role: "tablist" });
      panels.forEach(function (p, i) {
        var title = p.getAttribute("data-title") || ("Tab " + (i + 1));
        p.setAttribute("data-title", title);
        p.setAttribute("role", "tabpanel");
        var b = el("button", { type: "button", class: "tab-btn", role: "tab", "data-title": title, text: title });
        b.addEventListener("click", function () {
          if (group) {
            $$('[data-tabs="' + group + '"]').forEach(function (t) { selectTab(t, title); });
            var m = store.get(TABS_KEY, {}) || {};
            m[group] = title;
            store.set(TABS_KEY, m);
          } else selectTab(tabs, title);
        });
        b.addEventListener("keydown", function (e) {
          var btns = $$(".tab-btn", bar), k = btns.indexOf(b);
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            var n = btns[(k + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
            n.focus(); n.click();
          }
        });
        bar.appendChild(b);
      });
      tabs.insertBefore(bar, tabs.firstChild);
      var initial = (group && memory[group]) || panels[0].getAttribute("data-title");
      if (!selectTab(tabs, initial)) selectTab(tabs, panels[0].getAttribute("data-title"));
    });
  }

  /* ------------------------------------------------------------------
     12. Quiz: [data-quiz] > .q[data-answer] > ol > li
     ------------------------------------------------------------------ */
  function setupQuizzes() {
    $$("[data-quiz]").forEach(function (quiz) {
      if (quiz.getAttribute("data-quiz-ready")) return;
      quiz.setAttribute("data-quiz-ready", "1");
      var qs = $$(".q", quiz);
      if (!qs.length) return;
      var score = el("div", { class: "quiz-score", "aria-live": "polite" });
      var retry = el("button", { type: "button", class: "quiz-retry", text: "↺ Retry quiz" });
      var footer = el("div", { class: "quiz-footer" }, [score, retry]);
      quiz.appendChild(footer);

      function update() {
        var answered = qs.filter(function (q) { return q.classList.contains("answered"); });
        var right = answered.filter(function (q) { return q.classList.contains("got-it"); }).length;
        score.textContent = "Score: " + right + " / " + qs.length +
          (answered.length === qs.length ? (right === qs.length ? " - perfect! 🎉" : " - review the red ones and retry") : "");
        footer.classList.toggle("complete", answered.length === qs.length);
      }

      qs.forEach(function (q, qi) {
        var answer = parseInt(q.getAttribute("data-answer"), 10);
        var opts = $$(":scope > ol > li", q);
        var explain = $(".explain", q);
        if (explain) explain.hidden = true;
        q.setAttribute("data-qnum", qi + 1);
        opts.forEach(function (li, i) {
          li.classList.add("option");
          li.setAttribute("role", "button");
          li.setAttribute("tabindex", "0");
          function choose() {
            if (q.classList.contains("answered")) return;
            q.classList.add("answered");
            var ok = i === answer;
            q.classList.toggle("got-it", ok);
            li.classList.add(ok ? "correct" : "wrong");
            li.classList.add("chosen");
            if (!ok && opts[answer]) opts[answer].classList.add("correct");
            opts.forEach(function (o) { o.setAttribute("aria-disabled", "true"); });
            if (explain) { explain.hidden = false; explain.classList.add("revealed"); }
            update();
          }
          li.addEventListener("click", choose);
          li.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
          });
        });
      });
      retry.addEventListener("click", function () {
        qs.forEach(function (q) {
          q.classList.remove("answered", "got-it");
          $$(".option", q).forEach(function (o) {
            o.classList.remove("correct", "wrong", "chosen");
            o.removeAttribute("aria-disabled");
          });
          var ex = $(".explain", q);
          if (ex) { ex.hidden = true; ex.classList.remove("revealed"); }
        });
        update();
        try { quiz.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); } catch (e) { /* ignore */ }
      });
      update();
    });
  }

  /* ------------------------------------------------------------------
     13. Video: .video[data-yt] -> thumbnail card, Play here / Open
     ------------------------------------------------------------------ */
  function setupVideos() {
    var isFile = location.protocol === "file:";
    $$(".video[data-yt]").forEach(function (v) {
      if (v.getAttribute("data-video-ready")) return;
      var id = (v.getAttribute("data-yt") || "").trim();
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      v.setAttribute("data-video-ready", "1");
      var title = v.getAttribute("data-title") || "Video";
      var channel = v.getAttribute("data-channel") || "";
      var mins = v.getAttribute("data-mins");
      var watchUrl = "https://www.youtube.com/watch?v=" + id;

      var thumb = el("div", { class: "video-thumb", role: "button", tabindex: "0", "aria-label": "Play " + title }, [
        el("img", { src: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg", alt: title, loading: "lazy" }),
        el("span", { class: "video-play-icon", "aria-hidden": "true", text: "▶" }),
        mins ? el("span", { class: "video-duration", text: mins + " min" }) : null
      ]);
      var meta = el("div", { class: "video-info" }, [
        el("div", { class: "video-title", text: title }),
        el("div", { class: "video-channel", text: [channel, mins ? mins + " min" : ""].filter(Boolean).join(" · ") })
      ]);
      var playBtn = el("button", { type: "button", class: "video-btn play", text: "▶ Play here" });
      var openLink = el("a", { class: "video-btn open", href: watchUrl, target: "_blank", rel: "noopener", text: "Open on YouTube ↗" });
      var actions = el("div", { class: "video-actions" }, [playBtn, openLink]);

      function play() {
        if (v.querySelector("iframe")) return;
        var frame = el("div", { class: "video-frame" }, [el("iframe", {
          src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0",
          title: title, loading: "lazy", frameborder: "0", allowfullscreen: true,
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
          referrerpolicy: "strict-origin-when-cross-origin"
        })]);
        thumb.parentNode.replaceChild(frame, thumb);
        playBtn.disabled = true;
      }
      playBtn.addEventListener("click", play);
      thumb.addEventListener("click", play);
      thumb.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); } });

      var img = thumb.querySelector("img");
      if (img) img.addEventListener("error", function () { thumb.classList.add("no-thumb"); img.style.visibility = "hidden"; });
      v.innerHTML = "";
      v.appendChild(thumb);
      v.appendChild(meta);
      v.appendChild(actions);
      if (isFile) {
        v.appendChild(el("p", { class: "video-hint", text: "Embedded playback may need the local server: run serve.ps1 (or use Open on YouTube)." }));
      }
    });
  }

  /* ------------------------------------------------------------------
     14. Interview Q&A: chips, expand/collapse all, filter bar
     ------------------------------------------------------------------ */
  var FILTER_MIN = 8; // show the filter bar when a page has at least this many Q&A
  function setupQA() {
    var all = $$("details.qa");
    if (!all.length) return;
    all.forEach(function (d) {
      var sum = $(":scope > summary", d);
      if (!sum || $(".qa-chips", sum)) return;
      var chips = el("span", { class: "qa-chips" });
      var lvl = d.getAttribute("data-level");
      if (lvl) chips.appendChild(el("span", { class: "chip level", "data-level": lvl, text: "L" + lvl + " " + (LEVEL_NAMES[lvl] || "") }));
      if (d.getAttribute("data-priority") === "must") chips.appendChild(el("span", { class: "chip ok must", text: "must know" }));
      (d.getAttribute("data-company") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean)
        .forEach(function (c) { chips.appendChild(el("span", { class: "chip company", text: c })); });
      if (chips.childNodes.length) sum.appendChild(chips);
    });

    var first = all[0];
    var controls = el("div", { class: "qa-controls" });
    var expand = el("button", { type: "button", class: "qa-expand", text: "Expand all" });
    var collapse = el("button", { type: "button", class: "qa-collapse", text: "Collapse all" });
    expand.addEventListener("click", function () { visibleQA().forEach(function (d) { d.open = true; }); });
    collapse.addEventListener("click", function () { all.forEach(function (d) { d.open = false; }); });
    var buttons = el("div", { class: "qa-buttons" }, [expand, collapse]);
    controls.appendChild(buttons);
    function visibleQA() { return all.filter(function (d) { return !d.hidden; }); }

    if (all.length >= FILTER_MIN) {
      var levels = {}, companies = {}, topics = {};
      all.forEach(function (d) {
        var l = d.getAttribute("data-level"); if (l) levels[l] = 1;
        var t = d.getAttribute("data-topic"); if (t) t.split(",").forEach(function (x) { x = x.trim(); if (x) topics[x] = 1; });
        (d.getAttribute("data-company") || "").split(",").forEach(function (c) { c = c.trim(); if (c) companies[c] = 1; });
      });
      function select(label, values, fmt) {
        var s = el("select", { "aria-label": label }, [el("option", { value: "", text: label + ": all" })]);
        values.forEach(function (v) { s.appendChild(el("option", { value: v, text: fmt ? fmt(v) : v })); });
        return s;
      }
      var lvlSel = select("Level", Object.keys(levels).sort(), function (v) { return "L" + v + " " + (LEVEL_NAMES[v] || ""); });
      var topicKeys = Object.keys(topics).sort();
      var topicSel = topicKeys.length > 1 ? select("Topic", topicKeys) : null;
      var compSel = select("Company", Object.keys(companies).sort());
      var hasPriority = all.some(function (d) { return d.hasAttribute("data-priority"); });
      var prioSel = hasPriority ? select("Priority", ["must"], function () { return "Must know only"; }) : null;
      var text = el("input", { type: "search", placeholder: "Filter questions...", "aria-label": "Filter questions by text" });
      var count = el("span", { class: "qa-count", "aria-live": "polite" });
      var bar = el("div", { class: "qa-filter" }, [lvlSel, topicSel, compSel, prioSel, text, count]);
      controls.insertBefore(bar, buttons);

      var apply = function () {
        var lv = lvlSel.value, tp = topicSel ? topicSel.value : "", cp = compSel.value.toLowerCase(), pr = prioSel ? prioSel.value : "";
        var q = text.value.trim().toLowerCase();
        var shown = 0;
        all.forEach(function (d) {
          var ok = true;
          if (lv && d.getAttribute("data-level") !== lv) ok = false;
          if (ok && tp && (d.getAttribute("data-topic") || "").split(",").map(function (x) { return x.trim(); }).indexOf(tp) === -1) ok = false;
          if (ok && cp && (d.getAttribute("data-company") || "").toLowerCase().split(",").map(function (x) { return x.trim(); }).indexOf(cp) === -1) ok = false;
          if (ok && pr && d.getAttribute("data-priority") !== pr) ok = false;
          if (ok && q && d.textContent.toLowerCase().indexOf(q) === -1) ok = false;
          d.hidden = !ok;
          if (ok) shown++;
        });
        count.textContent = "Showing " + shown + " of " + all.length;
      };
      [lvlSel, topicSel, compSel, prioSel].forEach(function (s) { if (s) s.addEventListener("change", apply); });
      text.addEventListener("input", apply);
      apply();
    }
    first.parentNode.insertBefore(controls, first);
  }

  /* ------------------------------------------------------------------
     15. Small things: external links, smooth scroll, back-to-top
     ------------------------------------------------------------------ */
  function setupLinks() {
    $$("a[href]").forEach(function (a) {
      var h = a.getAttribute("href") || "";
      if (/^https?:\/\//i.test(h)) {
        var external = true;
        try { external = new URL(h).host !== location.host || location.protocol === "file:"; } catch (e) { /* keep */ }
        if (external) {
          a.setAttribute("target", "_blank");
          var rel = (a.getAttribute("rel") || "").split(/\s+/);
          if (rel.indexOf("noopener") === -1) rel.push("noopener");
          a.setAttribute("rel", rel.join(" ").trim());
          a.classList.add("external");
        }
      }
    });
  }
  function setupSmoothScroll() {
    if (!reduceMotion) doc.documentElement.style.scrollBehavior = "smooth";
    // open a <details> if the URL hash points inside it
    function openHash() {
      try {
        if (!location.hash) return;
        var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
        var d = t && t.closest("details");
        if (d) { d.open = true; t.scrollIntoView(); }
      } catch (e) { /* ignore */ }
    }
    window.addEventListener("hashchange", openHash);
    openHash();
  }
  function setupBackToTop() {
    if ($(".back-to-top")) return;
    var btn = el("button", { type: "button", class: "back-to-top", "aria-label": "Back to top", text: "↑" });
    btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); });
    body.appendChild(btn);
    var onScroll = function () { btn.classList.toggle("show", window.scrollY > 600); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------
     16. Boot
     ------------------------------------------------------------------ */
  function boot() {
    if (!doc.body) return;
    body = doc.body;
    doc.documentElement.classList.add("js");
    var shell = null;
    safe("layout", function () { shell = ensureLayout(); });
    safe("topbar", buildTopbar);
    safe("theme", function () { applyTheme(preferredTheme()); });
    safe("sidebar", function () { buildSidebar(shell); });
    safe("toc", function () { buildToc(shell); });
    safe("pager", function () { buildPager(shell); });
    safe("progress", refreshProgress);
    safe("markers", injectMarkers);
    safe("steppers", setupSteppers);
    safe("tabs", setupTabs);
    safe("quiz", setupQuizzes);
    safe("videos", setupVideos);
    safe("qa", setupQA);
    safe("copy", addCopyButtons);
    safe("highlight", setupHighlight);
    safe("links", setupLinks);
    safe("scroll", setupSmoothScroll);
    safe("backtotop", setupBackToTop);
    // other tabs/windows marking pages done
    safe("storage-sync", function () {
      window.addEventListener("storage", function (e) {
        if (e.key === DONE_KEY) refreshProgress();
        if (e.key === THEME_KEY) applyTheme(preferredTheme());
      });
    });
    body.classList.add("dojo-ready");
  }

  // apply theme as early as possible to reduce a flash of the wrong theme
  safe("early-theme", function () { doc.documentElement.setAttribute("data-theme", preferredTheme()); });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();

  // tiny public hook for debugging / other scripts
  window.Dojo = { refresh: function () { safe("refresh", function () {
    injectMarkers(); setupSteppers(); setupTabs(); setupQuizzes(); setupVideos(); addCopyButtons();
  }); }, pages: PAGES, current: CURRENT };
})();
