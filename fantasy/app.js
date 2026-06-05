/* ============================================================
   Fantasy Measure — Rankings Board
   Static single-page app. No build step, no backend.
   Reads manifest.json + overall/ + positions/ relative to this page.
   ============================================================ */

(() => {
  "use strict";

  // ---- Constants ----------------------------------------------------------
  const POSITIONS = ["QB", "RB", "WR", "TE"];
  const VIEWS = ["Overall", ...POSITIONS];
  const SCORINGS = ["ppr", "standard"];
  const FORMATS = ["normal", "superflex"];
  const SIZES = [8, 10, 12];

  const SCORING_LABEL = { ppr: "PPR", standard: "Standard" };
  const FORMAT_LABEL = { normal: "Normal", superflex: "Superflex" };

  // ---- State --------------------------------------------------------------
  let manifest = null;
  let overallKeys = new Set();   // `${format}_${size}_${scoring}`
  let positionKeys = new Set();  // `${scoring}_${position}`
  const cache = new Map();       // path -> Promise<data>

  const state = {
    view: "Overall",
    scoring: "ppr",
    format: "normal",
    league_size: 12,
    q: "",
    sortKey: null,
    sortDir: "asc",
  };

  // ---- DOM handles --------------------------------------------------------
  const el = {};

  // ---- Formatting helpers -------------------------------------------------
  const DASH = "–"; // en dash

  function isMissing(v) {
    return v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
  }

  function formatNumber(v, decimals = 1) {
    if (isMissing(v)) return DASH;
    const n = Number(v);
    if (Number.isNaN(n)) return DASH;
    return n.toFixed(decimals);
  }

  function formatPercent(v, decimals = 1) {
    if (isMissing(v)) return DASH;
    const n = Number(v);
    if (Number.isNaN(n)) return DASH;
    let s = (n * 100).toFixed(decimals);
    if (decimals > 0) s = s.replace(/\.0+$/, ""); // trim trailing .0
    return s + "%";
  }

  function formatGenerated(iso) {
    if (!iso) return DASH;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return DASH;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  // Decimals for the Value column: 1 if large magnitudes present, else 2.
  function valueDecimalsFor(rows) {
    const maxAbs = rows.reduce((m, r) => {
      const v = Number(r.value);
      return Number.isFinite(v) ? Math.max(m, Math.abs(v)) : m;
    }, 0);
    return maxAbs >= 10 ? 1 : 2;
  }

  function tierClass(tier) {
    if (isMissing(tier)) return "";
    let idx;
    if (typeof tier === "number") idx = tier;
    else {
      const c = String(tier).trim().toUpperCase().charCodeAt(0);
      idx = c >= 65 && c <= 90 ? c - 64 : parseInt(tier, 10);
    }
    if (!Number.isFinite(idx) || idx < 1) return "";
    return "tier-" + Math.min(idx, 6);
  }

  // ---- Data loading -------------------------------------------------------
  async function loadManifest() {
    const res = await fetch("manifest.json");
    if (!res.ok) throw new Error(`manifest.json ${res.status}`);
    manifest = await res.json();

    (manifest.datasets?.overall || []).forEach((d) => {
      overallKeys.add(`${d.format}_${d.league_size}_${d.scoring}`);
    });
    (manifest.datasets?.positions || []).forEach((d) => {
      positionKeys.add(`${d.scoring}_${d.position}`);
    });
    return manifest;
  }

  function getDatasetPath(s = state) {
    if (s.view === "Overall") {
      return `overall/${s.format}_${s.league_size}_${s.scoring}.json`;
    }
    return `positions/${s.scoring}/${s.view}.json`;
  }

  function datasetAvailable(s = state) {
    if (s.view === "Overall") return overallKeys.has(`${s.format}_${s.league_size}_${s.scoring}`);
    return positionKeys.has(`${s.scoring}_${s.view}`);
  }

  function loadDataset(path) {
    if (cache.has(path)) return cache.get(path);
    const p = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`${path} ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        cache.delete(path); // allow retry on transient failure
        throw err;
      });
    cache.set(path, p);
    return p;
  }

  // ---- Column definitions -------------------------------------------------
  // align: l|c|r  · sortKey: raw field used for sorting · render(row, ctx)
  const OVERALL_COLUMNS = [
    { key: "overall_rank", label: "Rank", align: "c", sortKey: "overall_rank",
      render: (r) => formatNumber(r.overall_rank, 0) },
    { key: "tier", label: "Tier", align: "c", sortKey: "tier",
      render: (r) => tierBadge(r.tier) },
    { key: "player_name", label: "Player", align: "l", sortKey: "player_name", cls: "col-player",
      render: (r) => playerCell(r) },
    { key: "team", label: "Team", align: "c", sortKey: "team", cls: "col-team",
      render: (r) => teamCell(r.team) },
    { key: "position", label: "Pos", align: "c", sortKey: "position",
      render: (r) => `<span class="pos-chip pos-${r.position}">${r.position || DASH}</span>` },
    { key: "position_rank_label", label: "Pos Rank", align: "c", sortKey: "position_rank",
      render: (r) => r.position_rank_label || (r.position && r.position_rank != null ? `${r.position}${r.position_rank}` : DASH) },
    { key: "projected_ppg", label: "PPG", align: "r", sortKey: "projected_ppg", cls: "num",
      render: (r) => formatNumber(r.projected_ppg, 1) },
    { key: "value", label: "Value", align: "r", sortKey: "value", cls: "num",
      render: (r, ctx) => formatNumber(r.value, ctx.valueDecimals) },
    { key: "top12_prob", label: "Top 12", align: "r", sortKey: "top12_prob", cls: "num prob",
      render: (r) => probCell(r.top12_prob, "good") },
    { key: "top24_prob", label: "Top 24", align: "r", sortKey: "top24_prob", cls: "num prob",
      render: (r) => probCell(r.top24_prob, "good") },
  ];

  const POSITION_COLUMNS = [
    { key: "rank", label: "Rank", align: "c", sortKey: "rank",
      render: (r) => formatNumber(r.rank, 0) },
    { key: "tier", label: "Tier", align: "c", sortKey: "tier",
      render: (r) => tierBadge(r.tier) },
    { key: "player_name", label: "Player", align: "l", sortKey: "player_name", cls: "col-player",
      render: (r) => playerCell(r) },
    { key: "team", label: "Team", align: "c", sortKey: "team", cls: "col-team",
      render: (r) => teamCell(r.team) },
    { key: "projected_ppg", label: "PPG", align: "r", sortKey: "projected_ppg", cls: "num",
      render: (r) => formatNumber(r.projected_ppg, 1) },
    { key: "top12_prob", label: "Top 12", align: "r", sortKey: "top12_prob", cls: "num prob",
      render: (r) => probCell(r.top12_prob, "good") },
    { key: "top24_prob", label: "Top 24", align: "r", sortKey: "top24_prob", cls: "num prob",
      render: (r) => probCell(r.top24_prob, "good") },
    { key: "top36_prob", label: "Top 36", align: "r", sortKey: "top36_prob", cls: "num prob",
      render: (r) => probCell(r.top36_prob, "good") },
  ];

  function columnsFor(view) {
    if (view === "Overall") return OVERALL_COLUMNS;
    // QB pool is only 32 deep, so Top 36 is meaningless there.
    if (view === "QB") return POSITION_COLUMNS.filter((c) => c.key !== "top36_prob");
    return POSITION_COLUMNS;
  }

  // ---- Cell renderers -----------------------------------------------------
  function tierBadge(tier) {
    if (isMissing(tier)) return DASH;
    return `<span class="tier-badge ${tierClass(tier)}">${tier}</span>`;
  }

  function playerCell(r) {
    const name = r.player_name || DASH;
    let markers = "";
    const inj = (r.injury_status || "").toString().trim();
    if (inj) markers += ` <span class="chip chip-inj chip-${inj.toLowerCase()}">${inj}</span>`;
    if (r.is_speculative_ufa === true) markers += ` <span class="chip chip-ufa" title="Speculative free agent">UFA</span>`;
    return `<span class="player-name">${escapeHtml(name)}</span>${markers}`;
  }

  function teamCell(team) {
    if (!team) return DASH;
    const t = String(team).toUpperCase();
    return `<span class="team-tag${t === "FA" ? " team-fa" : ""}">${t}</span>`;
  }

  function probCell(v, kind) {
    if (isMissing(v)) return DASH;
    const n = Math.max(0, Math.min(1, Number(v)));
    return `<span class="probwrap probwrap-${kind}" style="--p:${n}"><span class="probval">${formatPercent(v, 1)}</span></span>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // ---- Sorting & filtering ------------------------------------------------
  function sortRows(rows, col, dir) {
    if (!col) return rows.slice();
    const key = col.sortKey;
    const mult = dir === "desc" ? -1 : 1;
    const copy = rows.slice();
    copy.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const am = isMissing(av);
      const bm = isMissing(bv);
      if (am && bm) return 0;
      if (am) return 1;  // missing always last
      if (bm) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        return mult * String(av).localeCompare(String(bv));
      }
      return mult * (av - bv);
    });
    return copy;
  }

  function filterRows(rows, q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      return (
        (r.player_name && r.player_name.toLowerCase().includes(needle)) ||
        (r.team && r.team.toLowerCase().includes(needle)) ||
        (r.position && r.position.toLowerCase().includes(needle))
      );
    });
  }

  // ---- URL state ----------------------------------------------------------
  // Best-guess dataset path from the URL (or documented defaults) BEFORE the
  // manifest has loaded, so the big dataset download can start in parallel.
  function speculativePath() {
    const p = new URLSearchParams(window.location.search);
    const view = VIEWS.includes(p.get("view")) ? p.get("view") : "Overall";
    const scoring = SCORINGS.includes(p.get("scoring")) ? p.get("scoring") : "ppr";
    const format = FORMATS.includes(p.get("format")) ? p.get("format") : "normal";
    const sizeRaw = parseInt(p.get("league_size"), 10);
    const league_size = SIZES.includes(sizeRaw) ? sizeRaw : 12;
    return getDatasetPath({ view, scoring, format, league_size });
  }

  function readUrlState() {
    const p = new URLSearchParams(window.location.search);
    const view = p.get("view");
    if (view && VIEWS.includes(view)) state.view = view;
    const scoring = p.get("scoring");
    if (scoring && SCORINGS.includes(scoring)) state.scoring = scoring;
    const format = p.get("format");
    if (format && FORMATS.includes(format)) state.format = format;
    const size = parseInt(p.get("league_size"), 10);
    if (SIZES.includes(size)) state.league_size = size;
    const q = p.get("q");
    if (q) state.q = q;
  }

  function applyDefaults() {
    const d = manifest.defaults || {};
    if (d.position) state.view = d.position; // "Overall" or a position
    if (d.scoring) state.scoring = d.scoring;
    if (d.format) state.format = d.format;
    if (d.league_size) state.league_size = d.league_size;
  }

  function writeUrlState() {
    const p = new URLSearchParams();
    p.set("view", state.view);
    p.set("scoring", state.scoring);
    p.set("format", state.format);
    p.set("league_size", String(state.league_size));
    if (state.q) p.set("q", state.q);
    const url = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState(null, "", url);
  }

  function resetSortForView() {
    state.sortKey = state.view === "Overall" ? "overall_rank" : "rank";
    state.sortDir = "asc";
  }

  // ---- Rendering: controls ------------------------------------------------
  function renderControls() {
    const isOverall = state.view === "Overall";

    // View tabs
    el.viewTabs.innerHTML = VIEWS.map((v) =>
      `<button class="fm-tab${v === state.view ? " is-active" : ""}" data-view="${v}">${v}</button>`
    ).join("");

    // Segmented controls
    el.segScoring.innerHTML = SCORINGS.map((s) =>
      `<button class="fm-segbtn${s === state.scoring ? " is-active" : ""}" data-control="scoring" data-value="${s}">${SCORING_LABEL[s]}</button>`
    ).join("");

    el.segFormat.innerHTML = FORMATS.map((f) =>
      `<button class="fm-segbtn${f === state.format ? " is-active" : ""}" data-control="format" data-value="${f}">${FORMAT_LABEL[f]}</button>`
    ).join("");

    el.segSize.innerHTML = SIZES.map((n) =>
      `<button class="fm-segbtn${n === state.league_size ? " is-active" : ""}" data-control="league_size" data-value="${n}">${n}</button>`
    ).join("");

    // Soften format + size on position tabs (they only affect Overall)
    el.overallControls.classList.toggle("is-muted", !isOverall);
    el.overallControls.setAttribute("title", isOverall ? "" : "Format and league size only affect the Overall board");

    if (el.fmSearch.value !== state.q) el.fmSearch.value = state.q;
  }

  // ---- Rendering: metadata ------------------------------------------------
  function renderMeta(dsMeta) {
    const season = manifest.season ?? dsMeta?.season ?? DASH;
    const chips = [
      ["Season", season],
      ["Scoring", SCORING_LABEL[state.scoring]],
    ];
    if (state.view === "Overall") {
      chips.push(["Format", FORMAT_LABEL[state.format]]);
      chips.push(["League", `${state.league_size}-team`]);
    } else {
      chips.push(["Position", state.view]);
    }

    el.fmMeta.innerHTML = chips.map(([k, v]) =>
      `<span class="meta-chip"><span class="meta-k">${k}</span><span class="meta-v">${v}</span></span>`
    ).join("");

    // Subtitle
    let sub;
    if (state.view === "Overall") {
      sub = `Preseason ROS simulation board · ${state.league_size}-team ${SCORING_LABEL[state.scoring]} · ${FORMAT_LABEL[state.format]}`;
    } else {
      sub = `${state.view} position board · ${SCORING_LABEL[state.scoring]} · ROS PPG distributions & finish odds`;
    }
    el.fmSubtitle.textContent = sub;
  }

  // ---- Rendering: states --------------------------------------------------
  function showTableMessage(kind, message) {
    el.tableWrap.classList.add("is-hidden");
    el.fmMessage.className = `fm-message fm-message-${kind}`;
    el.fmMessage.innerHTML = message;
    el.fmMessage.classList.remove("is-hidden");
  }

  function hideTableMessage() {
    el.fmMessage.classList.add("is-hidden");
    el.tableWrap.classList.remove("is-hidden");
  }

  // ---- Rendering: table ---------------------------------------------------
  let currentRows = [];      // raw rows for current dataset
  let currentColumns = [];
  let currentCtx = {};

  function renderTable() {
    const cols = currentColumns;
    const col = cols.find((c) => c.sortKey === state.sortKey) || null;
    const filtered = filterRows(currentRows, state.q);
    const sorted = sortRows(filtered, col, state.sortDir);

    // Head
    const thead = `<thead><tr>${cols.map((c) => {
      const isSorted = c.sortKey === state.sortKey;
      const arrow = isSorted ? (state.sortDir === "asc" ? "▲" : "▼") : "";
      const titleAttr = c.title ? ` title="${escapeHtml(c.title)}"` : "";
      return `<th class="al-${c.align}${c.cls ? " " + c.cls : ""}${isSorted ? " is-sorted" : ""}" data-sortkey="${c.sortKey}"${titleAttr}>` +
        `<span class="th-label">${c.label}</span><span class="th-arrow">${arrow}</span></th>`;
    }).join("")}</tr></thead>`;

    // Body
    let tbody;
    if (sorted.length === 0) {
      tbody = `<tbody><tr><td class="fm-emptyrow" colspan="${cols.length}">No players match “${escapeHtml(state.q)}”.</td></tr></tbody>`;
    } else {
      tbody = "<tbody>" + sorted.map((r) => {
        return `<tr>` + cols.map((c) => {
          const al = `al-${c.align}`;
          const extra = c.cls ? " " + c.cls : "";
          return `<td class="${al}${extra}">${c.render(r, currentCtx)}</td>`;
        }).join("") + `</tr>`;
      }).join("") + "</tbody>";
    }

    el.table.innerHTML = thead + tbody;

    // Count
    const showing = sorted.length;
    const total = currentRows.length;
    el.fmCount.textContent = state.q
      ? `Showing ${showing} of ${total} players`
      : `Showing ${showing} player${showing === 1 ? "" : "s"}`;
  }

  // ---- Main render cycle --------------------------------------------------
  let loadToken = 0;

  async function render() {
    renderControls();
    writeUrlState();

    // Availability check
    if (!datasetAvailable()) {
      renderMeta(null);
      el.fmCount.textContent = "";
      showTableMessage("missing",
        `<div class="msg-title">Not exported</div>
         <p>This rankings slice has not been exported yet.</p>`);
      return;
    }

    const path = getDatasetPath();
    const token = ++loadToken;

    // Loading state (skip flash if already cached)
    if (!cache.has(path)) {
      showTableMessage("loading", `<div class="fm-spinner"></div><p>Loading rankings…</p>`);
    }

    try {
      const data = await loadDataset(path);
      if (token !== loadToken) return; // a newer request superseded this one

      currentRows = Array.isArray(data.rows) ? data.rows : [];
      currentColumns = columnsFor(state.view);
      currentCtx = { valueDecimals: valueDecimalsFor(currentRows) };

      renderMeta(data.metadata);
      hideTableMessage();
      renderTable();
    } catch (err) {
      if (token !== loadToken) return;
      console.error(err);
      renderMeta(null);
      el.fmCount.textContent = "";
      showTableMessage("error",
        `<div class="msg-title">Couldn’t load data</div>
         <p>There was a problem loading this rankings file. Check your connection and try again.</p>`);
    }
  }

  // ---- Event wiring -------------------------------------------------------
  function wireEvents() {
    el.viewTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-view]");
      if (!btn) return;
      const v = btn.dataset.view;
      if (v === state.view) return;
      state.view = v;
      resetSortForView();
      render();
    });

    const segHandler = (e) => {
      const btn = e.target.closest("[data-control]");
      if (!btn) return;
      const control = btn.dataset.control;
      let value = btn.dataset.value;
      if (control === "league_size") value = parseInt(value, 10);
      if (state[control] === value) return;
      state[control] = value;
      render();
    };
    el.segScoring.addEventListener("click", segHandler);
    el.segFormat.addEventListener("click", segHandler);
    el.segSize.addEventListener("click", segHandler);

    el.fmSearch.addEventListener("input", () => {
      state.q = el.fmSearch.value;
      writeUrlState();
      renderTable();
    });

    // Sortable headers
    el.table.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sortkey]");
      if (!th) return;
      const key = th.dataset.sortkey;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        // sensible default direction: descending for value/prob/ppg, ascending for rank/name
        state.sortDir = /rank|player_name|team|position$/.test(key) ? "asc" : "desc";
      }
      renderTable();
    });

    window.addEventListener("popstate", () => {
      readUrlState();
      resetSortForView();
      render();
    });
  }

  // ---- Boot ---------------------------------------------------------------
  function cacheDom() {
    el.viewTabs = document.getElementById("fmViewTabs");
    el.segScoring = document.getElementById("fmSegScoring");
    el.segFormat = document.getElementById("fmSegFormat");
    el.segSize = document.getElementById("fmSegSize");
    el.overallControls = document.getElementById("fmOverallControls");
    el.fmSearch = document.getElementById("fmSearch");
    el.fmMeta = document.getElementById("fmMeta");
    el.fmSubtitle = document.getElementById("fmSubtitle");
    el.fmTitle = document.getElementById("fmTitle");
    el.fmCount = document.getElementById("fmCount");
    el.table = document.getElementById("fmTable");
    el.tableWrap = document.getElementById("fmTableWrap");
    el.fmMessage = document.getElementById("fmMessage");
  }

  async function init() {
    cacheDom();
    wireEvents();
    showTableMessage("loading", `<div class="fm-spinner"></div><p>Loading…</p>`);

    // Kick off the most-likely dataset download immediately, in parallel with
    // the manifest. render() reuses this in-flight promise from the cache.
    loadDataset(speculativePath());

    try {
      await loadManifest();
    } catch (err) {
      console.error(err);
      showTableMessage("error",
        `<div class="msg-title">Couldn’t load manifest</div>
         <p>The rankings manifest failed to load. Please try again later.</p>`);
      return;
    }

    if (el.fmTitle && manifest.title) {
      el.fmTitle.textContent = manifest.title;
      document.title = `Christian Bagshaw - ${manifest.title}`;
    }

    applyDefaults();   // manifest defaults first
    readUrlState();    // URL overrides defaults
    resetSortForView();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
