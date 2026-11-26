
    /* Home only: fill page counts and totals from the SITEMAP so they never go stale. */
    (function () {
      var sm = window.SITEMAP; if (!sm || !sm.sections) return;
      var pages = 0, mins = 0;
      sm.sections.forEach(function (s) {
        pages += s.pages.length;
        s.pages.forEach(function (p) { mins += p.mins || 0; });
        document.querySelectorAll('[data-count="' + s.id + '"]').forEach(function (el) { el.textContent = s.pages.length; });
      });
      var tp = document.querySelector('[data-total-pages]'); if (tp) tp.textContent = pages;
      var th = document.querySelector('[data-total-hours]'); if (th) th.textContent = Math.round(mins / 60) + '+';
    })();
  