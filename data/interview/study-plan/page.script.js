    /* Study plan checkboxes: saved per browser in localStorage (key "dojo-plan"). Safe if storage is blocked. */
    (function () {
      var KEY = "dojo-plan", state = {};
      try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }
      function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
      var boxes = Array.prototype.slice.call(document.querySelectorAll('ul.plan-list input[type="checkbox"]'));
      function refresh() {
        var done = boxes.filter(function (b) { return b.checked; }).length;
        var pct = boxes.length ? Math.round(100 * done / boxes.length) : 0;
        var c = document.getElementById("plan-count"), t = document.getElementById("plan-total"), p = document.getElementById("plan-pct"), bar = document.getElementById("plan-bar");
        if (c) c.textContent = done; if (t) t.textContent = boxes.length; if (p) p.textContent = "(" + pct + "%)"; if (bar) bar.style.width = pct + "%";
        Array.prototype.forEach.call(document.querySelectorAll("details.plan-day"), function (d) {
          var bs = d.querySelectorAll('input[type="checkbox"]'), all = bs.length > 0;
          Array.prototype.forEach.call(bs, function (b) { if (!b.checked) all = false; });
          d.classList.toggle("complete", all);
        });
      }
      boxes.forEach(function (b) {
        var k = b.getAttribute("data-key");
        if (state[k]) b.checked = true;
        b.addEventListener("change", function () { if (b.checked) state[k] = 1; else delete state[k]; save(); refresh(); });
      });
      var ex = document.getElementById("plan-expand"), open = false;
      if (ex) ex.addEventListener("click", function () {
        open = !open;
        Array.prototype.forEach.call(document.querySelectorAll("details.plan-day"), function (d) { d.open = open; });
        ex.textContent = open ? "Close all days" : "Open all days";
      });
      var rs = document.getElementById("plan-reset");
      if (rs) rs.addEventListener("click", function () {
        if (!window.confirm("Clear all ticks on this plan?")) return;
        state = {}; save(); boxes.forEach(function (b) { b.checked = false; }); refresh();
      });
      refresh();
    })();
  