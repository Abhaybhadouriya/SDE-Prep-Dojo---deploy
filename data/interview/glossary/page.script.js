    /* Glossary only: recount rows so the totals in the text always match the table. */
    (function () {
      var rows = document.querySelectorAll('section[id^="letter-"] tbody tr[id]');
      var c = { total: rows.length, must: 0, docker: 0, k8s: 0, kafka: 0, accent: 0, company: 0, warn: 0 };
      rows.forEach(function (tr) {
        var cell = tr.cells[0]; if (!cell) return;
        var chip = cell.querySelector('.chip:not(.ok)');
        if (chip) ['docker', 'k8s', 'kafka', 'accent', 'company', 'warn'].forEach(function (k) { if (chip.classList.contains(k)) c[k]++; });
        if (cell.querySelector('.chip.ok')) c.must++;
      });
      document.querySelectorAll('[data-gloss]').forEach(function (el) { var k = el.getAttribute('data-gloss'); if (c[k] !== undefined) el.textContent = c[k]; });
      document.querySelectorAll('nav.filters a.filter-chip[href^="#letter-"]').forEach(function (a) {
        var sec = document.querySelector(a.getAttribute('href')); var sm = a.querySelector('small');
        if (sec && sm) sm.textContent = sec.querySelectorAll('tbody tr[id]').length;
      });
    })();
  