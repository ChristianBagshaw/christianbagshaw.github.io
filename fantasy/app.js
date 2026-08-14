/* ============================================================
   Fantasy Football — Rankings Board
   Static single-page app. No build step, no backend.
   Reads manifest.json + overall/ + positions/ + weekly/ relative to this page.
   ============================================================ */

(() => {
  "use strict";

  // ---- Constants ----------------------------------------------------------
  const ROS_POSITIONS = ["QB", "RB", "WR", "TE"];
  const WEEKLY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
  const ALL_VIEWS = ["Overall", ...WEEKLY_POSITIONS];
  const SCORINGS = ["ppr", "standard"];
  const FORMATS = ["normal", "superflex"];
  const SIZES = [8, 10, 12];

  const SCORING_LABEL = { ppr: "PPR", standard: "Standard" };
  const FORMAT_LABEL = { normal: "Normal", superflex: "Superflex" };
  const SCOPE_LABEL = { ros: "Season", weekly: "Week" };

  // ---- State --------------------------------------------------------------
  let manifest = null;
  let overallKeys = new Set();   // `${format}_${size}_${scoring}`
  let positionKeys = new Set();  // `${scoring}_${position}`
  let weeklyPaths = new Map();   // `${week}_${scoring}_${position}` -> path
  const cache = new Map();       // path -> Promise<data>

  const state = {
    scope: "ros",
    week: null,
    view: "Overall",
    scoring: "ppr",
    format: "normal",
    league_size: 12,
    q: "",
    sortKey: null,
    sortDir: "asc",
  };

  let lastRosPosition = "QB";
  const expandedRows = new Set();

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

  function formatInjuryOverlay(iso) {
    if (!iso) return "Injury status unavailable";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Injury status unavailable";
    const label = d.toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
    const ageDays = (Date.now() - d.getTime()) / 86400000;
    return ageDays > 7
      ? `Injury data may be outdated · last checked ${label}`
      : `Injury status cached ${label}`;
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
    (manifest.datasets?.weekly || []).forEach((d) => {
      weeklyPaths.set(`${d.week}_${d.scoring}_${d.position}`, d.path);
    });
    return manifest;
  }

  function getDatasetPath(s = state) {
    if (s.scope === "weekly") {
      return weeklyPaths.get(`${s.week}_${s.scoring}_${s.view}`) || null;
    }
    if (s.view === "Overall") {
      return `overall/${s.format}_${s.league_size}_${s.scoring}.json`;
    }
    return `positions/${s.scoring}/${s.view}.json`;
  }

  function datasetAvailable(s = state) {
    if (s.scope === "weekly") {
      return weeklyPaths.has(`${s.week}_${s.scoring}_${s.view}`);
    }
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

  // Sorts on injury_3plus_prob (the raw signal behind the meter) so ordering
  // is stable within a level instead of alphabetical on the label.
  const INJURY_RISK_COLUMN = {
    key: "injury_risk", label: "Inj Risk", align: "c", sortKey: "injury_3plus_prob",
    title: "Rest-of-season injury risk, relative to players at the same position",
    render: (r) => riskBadge(r.injury_risk),
  };

  const OVERALL_COLUMNS = [
    { key: "overall_rank", label: "Rank", align: "c", sortKey: "overall_rank",
      render: (r) => formatNumber(r.overall_rank, 0) },
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
    INJURY_RISK_COLUMN,
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
    INJURY_RISK_COLUMN,
  ];

  const WEEKLY_COLUMNS = [
    { key: "rank", label: "Rank", align: "c", sortKey: "rank",
      render: (r) => formatNumber(r.rank, 0) },
    { key: "tier", label: "Tier", align: "c", sortKey: "tier",
      render: (r) => tierBadge(r.tier) },
    { key: "player_name", label: "Player", align: "l", sortKey: "player_name", cls: "col-player col-player-weekly",
      render: (r, ctx) => weeklyPlayerCell(r, ctx) },
    { key: "team", label: "Team", align: "c", sortKey: "team", cls: "col-team",
      render: (r) => teamCell(r.team) },
    { key: "model_points", label: "Projection", align: "r", sortKey: "model_points", cls: "num",
      helpKey: "model_points",
      render: (r) => formatNumber(r.model_points, 1) },
    { key: "top12_prob", label: "Top 12", align: "r", sortKey: "top12_prob", cls: "num prob",
      helpKey: "top12_prob",
      render: (r) => probCell(r.top12_prob, "good") },
    { key: "top24_prob", label: "Top 24", align: "r", sortKey: "top24_prob", cls: "num prob",
      helpKey: "top24_prob",
      render: (r) => probCell(r.top24_prob, "good") },
  ];

  function columnsFor(s = state) {
    if (s.scope === "weekly") return WEEKLY_COLUMNS;
    return s.view === "Overall" ? OVERALL_COLUMNS : POSITION_COLUMNS;
  }

  // ---- Cell renderers -----------------------------------------------------
  function tierBadge(tier) {
    if (isMissing(tier)) return DASH;
    return `<span class="tier-badge ${tierClass(tier)}">${tier}</span>`;
  }

  function riskBadge(risk) {
    if (isMissing(risk) || String(risk).trim() === "") return DASH;
    const cls = "risk-" + String(risk).trim().toLowerCase().replace(/\s+/g, "-");
    return `<span class="risk-badge ${cls}">${escapeHtml(risk)}</span>`;
  }

  function playerCell(r) {
    const name = r.player_name || DASH;
    let markers = "";
    const inj = (r.injury_status || "").toString().trim();
    if (inj) markers += ` <span class="chip chip-inj chip-${inj.toLowerCase()}">${inj}</span>`;
    if (r.is_speculative_ufa === true) markers += ` <span class="chip chip-ufa" title="Speculative free agent">UFA</span>`;
    return `<span class="player-name">${escapeHtml(name)}</span>${markers}`;
  }

  function weeklyPlayerCell(r, ctx) {
    const name = escapeHtml(r.player_name || DASH);
    const inj = (r.injury_status || "").toString().trim().toUpperCase();
    const injChip = inj
      ? ` <span class="chip chip-inj chip-${escapeHtml(inj.toLowerCase())}">${escapeHtml(inj)}</span>`
      : "";
    return `<button class="weekly-player" type="button" data-expand="${escapeHtml(ctx.rowKey(r))}" aria-expanded="${ctx.isExpanded(r)}">` +
      `<span class="weekly-player-main"><span class="expand-caret" aria-hidden="true">›</span>` +
      `<span class="player-name">${name}</span>${injChip}</span></button>`;
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

  function metricExplanation(key) {
    const weeklyMetricHelp = {
      model_points: "The model's projected fantasy points for this week. The board is ranked by this value.",
      top12_prob: "Chance of finishing among the top 12 players at this position this week.",
      top24_prob: "Chance of finishing among the top 24 players at this position this week.",
      odds_up: "Chance of scoring more points than the player ranked directly above. This does not apply to rank 1.",
    };
    if (weeklyMetricHelp[key]) return weeklyMetricHelp[key];

    const defaults = {
      bust_prob: "<= 5",
      good_prob: ">= 10",
      great_prob: ">= 20",
      boom_prob: ">= 25",
    };
    const raw = manifest?.weekly_outcome_thresholds?.[key] || defaults[key] || "";
    const amount = raw.match(/[\d.]+/)?.[0] || "the threshold";
    const threshold = raw.trim().startsWith("<=")
      ? `${amount} points or fewer`
      : `${amount} points or more`;
    const cumulative = key === "good_prob"
      ? " Great and boom games are included in this probability."
      : key === "great_prob"
        ? " Boom games are included in this probability."
        : "";
    return `Chance of scoring ${threshold}.${cumulative}`;
  }

  function metricHelp(key, label) {
    const explanation = metricExplanation(key);
    return `<span class="outcome-help" tabindex="0" role="note" aria-label="${escapeHtml(`${label}: ${explanation}`)}" data-tip="${escapeHtml(explanation)}">i</span>`;
  }

  let floatingTip = null;

  function showMetricTip(target) {
    if (!target?.dataset?.tip) return;
    if (!floatingTip) {
      floatingTip = document.createElement("div");
      floatingTip.id = "fmMetricTooltip";
      floatingTip.className = "fm-floating-tip";
      floatingTip.setAttribute("role", "tooltip");
      document.body.appendChild(floatingTip);
    }

    floatingTip.textContent = target.dataset.tip;
    floatingTip.hidden = false;
    floatingTip.style.visibility = "hidden";

    const anchor = target.getBoundingClientRect();
    const tip = floatingTip.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const gutter = 10;
    let left = anchor.left + (anchor.width - tip.width) / 2;
    left = Math.max(gutter, Math.min(left, viewportWidth - tip.width - gutter));

    let top = anchor.bottom + 8;
    if (top + tip.height > viewportHeight - gutter) top = anchor.top - tip.height - 8;
    top = Math.max(gutter, top);

    floatingTip.style.left = `${Math.round(left)}px`;
    floatingTip.style.top = `${Math.round(top)}px`;
    floatingTip.style.visibility = "visible";
  }

  function hideMetricTip() {
    if (floatingTip) floatingTip.hidden = true;
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
    if (p.get("scope") === "weekly") return null;
    const view = ["Overall", ...ROS_POSITIONS].includes(p.get("view")) ? p.get("view") : "Overall";
    const scoring = SCORINGS.includes(p.get("scoring")) ? p.get("scoring") : "ppr";
    const format = FORMATS.includes(p.get("format")) ? p.get("format") : "normal";
    const sizeRaw = parseInt(p.get("league_size"), 10);
    const league_size = SIZES.includes(sizeRaw) ? sizeRaw : 12;
    if (view === "Overall") return `overall/${format}_${league_size}_${scoring}.json`;
    return `positions/${scoring}/${view}.json`;
  }

  function scopeOptions() {
    const scopes = manifest?.options?.scopes;
    return Array.isArray(scopes) && scopes.length ? scopes : ["ros"];
  }

  function weekOptions() {
    const weeks = manifest?.options?.weeks;
    return Array.isArray(weeks) ? weeks.map(Number).filter(Number.isFinite) : [];
  }

  function positionsForScope(scope = state.scope) {
    const key = scope === "weekly" ? "weekly_positions" : "positions";
    const fallback = scope === "weekly" ? WEEKLY_POSITIONS : ROS_POSITIONS;
    const positions = manifest?.options?.[key];
    return Array.isArray(positions) && positions.length ? positions : fallback;
  }

  function viewsForScope(scope = state.scope) {
    return scope === "weekly" ? positionsForScope(scope) : ["Overall", ...positionsForScope(scope)];
  }

  function normalizeState() {
    if (!scopeOptions().includes(state.scope)) state.scope = scopeOptions()[0] || "ros";

    const weeks = weekOptions();
    if (state.scope === "weekly" && !weeks.includes(Number(state.week))) {
      state.week = weeks.includes(Number(manifest?.defaults?.week))
        ? Number(manifest.defaults.week)
        : (weeks.at(-1) ?? null);
    }

    const views = viewsForScope();
    if (!views.includes(state.view)) {
      const availablePositions = positionsForScope();
      state.view = availablePositions.includes(lastRosPosition)
        ? lastRosPosition
        : (availablePositions[0] || "QB");
    }
    if (state.scope === "ros" && state.view !== "Overall") lastRosPosition = state.view;
  }

  function readUrlState() {
    const p = new URLSearchParams(window.location.search);
    const scope = p.get("scope");
    if (scope && scopeOptions().includes(scope)) state.scope = scope;
    const week = parseInt(p.get("week"), 10);
    if (weekOptions().includes(week)) state.week = week;
    const view = p.get("view");
    if (view && ALL_VIEWS.includes(view)) state.view = view;
    const scoring = p.get("scoring");
    if (scoring && SCORINGS.includes(scoring)) state.scoring = scoring;
    const format = p.get("format");
    if (format && FORMATS.includes(format)) state.format = format;
    const size = parseInt(p.get("league_size"), 10);
    if (SIZES.includes(size)) state.league_size = size;
    const q = p.get("q");
    if (q !== null) state.q = q;
    normalizeState();
  }

  function applyDefaults() {
    const d = manifest.defaults || {};
    if (d.scope) state.scope = d.scope;
    if (d.week != null) state.week = Number(d.week);
    if (d.position) state.view = d.position; // "Overall" or a position
    if (d.scoring) state.scoring = d.scoring;
    if (d.format) state.format = d.format;
    if (d.league_size) state.league_size = d.league_size;
    normalizeState();
  }

  function writeUrlState() {
    const p = new URLSearchParams();
    p.set("scope", state.scope);
    if (state.scope === "weekly" && state.week != null) p.set("week", String(state.week));
    p.set("view", state.view);
    p.set("scoring", state.scoring);
    p.set("format", state.format);
    p.set("league_size", String(state.league_size));
    if (state.q) p.set("q", state.q);
    const url = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState(null, "", url);
  }

  function resetSortForView() {
    state.sortKey = state.scope === "ros" && state.view === "Overall" ? "overall_rank" : "rank";
    state.sortDir = "asc";
  }

  // Sensible default direction for a freshly-picked sort column:
  // ascending for rank/name/team/position, descending for stats.
  function defaultDirFor(key) {
    return /rank|player_name|team|position$/.test(key) ? "asc" : "desc";
  }

  // ---- Rendering: controls ------------------------------------------------
  function renderControls() {
    const isOverall = state.scope === "ros" && state.view === "Overall";
    const views = viewsForScope();

    el.segScope.innerHTML = scopeOptions().map((scope) =>
      `<button class="fm-segbtn${scope === state.scope ? " is-active" : ""}" data-scope="${scope}" aria-pressed="${scope === state.scope}">${SCOPE_LABEL[scope] || scope}</button>`
    ).join("");

    const weeks = weekOptions();
    el.weekControl.classList.toggle("is-hidden", state.scope !== "weekly");
    el.fmWeek.innerHTML = weeks.map((week) =>
      `<option value="${week}"${week === state.week ? " selected" : ""}>Week ${week}</option>`
    ).join("");

    // View tabs
    el.viewTabs.style.setProperty("--view-count", views.length);
    el.viewTabs.innerHTML = views.map((v) =>
      `<button class="fm-tab${v === state.view ? " is-active" : ""}" data-view="${v}" role="tab" aria-selected="${v === state.view}">${v}</button>`
    ).join("");

    // Segmented controls
    el.segScoring.innerHTML = SCORINGS.map((s) =>
      `<button class="fm-segbtn${s === state.scoring ? " is-active" : ""}" data-control="scoring" data-value="${s}">${SCORING_LABEL[s]}</button>`
    ).join("");

    el.segFormat.innerHTML = FORMATS.map((f) =>
      `<button class="fm-segbtn${f === state.format ? " is-active" : ""}" data-control="format" data-value="${f}"${isOverall ? "" : " disabled"}>${FORMAT_LABEL[f]}</button>`
    ).join("");

    el.segSize.innerHTML = SIZES.map((n) =>
      `<button class="fm-segbtn${n === state.league_size ? " is-active" : ""}" data-control="league_size" data-value="${n}"${isOverall ? "" : " disabled"}>${n}</button>`
    ).join("");

    // Soften format + size on position tabs (they only affect Overall)
    el.overallControls.classList.toggle("is-muted", !isOverall);
    el.overallControls.setAttribute("title", isOverall ? "" : "Format and league size only affect the Season Overall board");

    if (el.fmSearch.value !== state.q) el.fmSearch.value = state.q;
  }

  // ---- Rendering: metadata ------------------------------------------------
  function renderMeta(dsMeta) {
    const season = manifest.season ?? dsMeta?.season ?? DASH;
    const chips = [
      ["Season", season],
      ["Scope", SCOPE_LABEL[state.scope]],
      ["Scoring", SCORING_LABEL[state.scoring]],
    ];
    if (state.scope === "weekly") {
      chips.push(["Week", dsMeta?.week ?? state.week ?? DASH]);
      chips.push(["Position", state.view]);
    } else if (state.view === "Overall") {
      chips.push(["Format", FORMAT_LABEL[state.format]]);
      chips.push(["League", `${state.league_size}-team`]);
    } else {
      chips.push(["Position", state.view]);
    }
    if (state.scope === "ros" && manifest.anchor_week != null) {
      chips.push(["Anchor", `Week ${manifest.anchor_week}`]);
    }

    el.fmMeta.innerHTML = chips.map(([k, v]) =>
      `<span class="meta-chip"><span class="meta-k">${k}</span><span class="meta-v">${v}</span></span>`
    ).join("");

    // Subtitle
    let sub;
    if (state.scope === "weekly") {
      sub = `Week ${state.week} Start/Sit · ${state.view} · ${SCORING_LABEL[state.scoring]}`;
    } else if (state.view === "Overall") {
      sub = `Draft Rankings · ${state.league_size}-team ${SCORING_LABEL[state.scoring]} · ${FORMAT_LABEL[state.format]}`;
    } else {
      sub = `${state.view} Rankings · ${SCORING_LABEL[state.scoring]} · Projections`;
    }
    el.fmSubtitle.textContent = sub;

    el.fmHint.textContent = state.scope === "weekly"
      ? formatInjuryOverlay(manifest.injury_overlay_as_of_utc)
      : `Updated ${formatGenerated(manifest.generated_at_utc)}`;

    el.fmMethod.innerHTML = state.scope === "weekly"
      ? `Weekly ranks follow the model forecast; outcome and finish probabilities come from simulations. Injury tags are a cached overlay and do not change rank. For more information, see <a href="../Projects/index.html">here</a>.`
      : `Overall ranks use simulation-based value over replacement for the selected format, league size, and scoring. Position tables show rest-of-season PPG distributions and top-k finish probabilities. For more information, see <a href="../Projects/index.html">here</a>.`;
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

  function expandedDetails(r) {
    const details = [
      ["Bust", formatPercent(r.bust_prob, 1), "bust_prob"],
      ["Good game", formatPercent(r.good_prob, 1), "good_prob"],
      ["Great game", formatPercent(r.great_prob, 1), "great_prob"],
      ["Boom", formatPercent(r.boom_prob, 1), "boom_prob"],
      ["Beats rank above", formatPercent(r.odds_up, 1), "odds_up"],
    ];
    return `<div class="weekly-details">${details.map(([label, value, helpKey]) =>
      `<span class="weekly-detail"><span class="weekly-detail-label">${label}${metricHelp(helpKey, label)}</span><span class="weekly-detail-value">${value}</span></span>`
    ).join("")}</div>`;
  }

  function renderTable() {
    hideMetricTip();
    const cols = currentColumns;
    const col = cols.find((c) => c.sortKey === state.sortKey) || null;
    const filtered = filterRows(currentRows, state.q);
    const sorted = sortRows(filtered, col, state.sortDir);

    // Head
    const thead = `<thead><tr>${cols.map((c) => {
      const isSorted = c.sortKey === state.sortKey;
      const arrow = isSorted ? (state.sortDir === "asc" ? "▲" : "▼") : "↕";
      const arrowCls = isSorted ? "th-arrow" : "th-arrow th-arrow-ghost";
      const title = c.helpKey ? "" : c.title;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<th class="al-${c.align}${c.cls ? " " + c.cls : ""}${isSorted ? " is-sorted" : ""}" data-sortkey="${c.sortKey}"${titleAttr}>` +
        `<span class="th-label">${c.label}${c.helpKey ? metricHelp(c.helpKey, c.label) : ""}</span><span class="${arrowCls}">${arrow}</span></th>`;
    }).join("")}</tr></thead>`;

    // Body
    let tbody;
    if (sorted.length === 0) {
      tbody = `<tbody><tr><td class="fm-emptyrow" colspan="${cols.length}">No players match “${escapeHtml(state.q)}”.</td></tr></tbody>`;
    } else {
      // Mark tier boundaries so position views read as visual groups — only
      // when the order actually follows tiers (rank or tier sort).
      const tierGrouped = state.view !== "Overall" &&
        (state.sortKey === "rank" || state.sortKey === "tier");
      let prevTier = null;
      tbody = "<tbody>" + sorted.map((r) => {
        const rowClasses = [];
        if (tierGrouped && !isMissing(r.tier)) {
          if (prevTier !== null && r.tier !== prevTier) rowClasses.push("is-tier-break");
          prevTier = r.tier;
        }
        const injury = String(r.injury_status || "").toUpperCase();
        if (state.scope === "weekly" && ["OUT", "IR", "SUS"].includes(injury)) {
          rowClasses.push("is-unavailable");
        }
        const rowKey = currentCtx.rowKey(r);
        const isExpanded = state.scope === "weekly" && expandedRows.has(rowKey);
        if (isExpanded) rowClasses.push("is-expanded");
        const rowCls = rowClasses.length ? ` class="${rowClasses.join(" ")}"` : "";
        const mainRow = `<tr${rowCls}>` + cols.map((c) => {
          const al = `al-${c.align}`;
          const extra = c.cls ? " " + c.cls : "";
          return `<td class="${al}${extra}">${c.render(r, currentCtx)}</td>`;
        }).join("") + `</tr>`;
        if (!isExpanded) return mainRow;
        return mainRow + `<tr class="weekly-details-row"><td colspan="${cols.length}">${expandedDetails(r)}</td></tr>`;
      }).join("") + "</tbody>";
    }

    el.table.innerHTML = thead + tbody;

    // Count
    const showing = sorted.length;
    const total = currentRows.length;
    el.fmCount.textContent = state.q
      ? `Showing ${showing} of ${total} players`
      : `Showing ${showing} player${showing === 1 ? "" : "s"}`;

    fitTable();
  }

  // On narrow (mobile) viewports, scale the whole table down so every column
  // fits the available width — no horizontal scroll. Uses transform:scale
  // (universally supported, unlike `zoom`) and reserves only the scaled height
  // on the wrapper so there's no empty space below. Full size on wider screens.
  function fitTable() {
    if (!el.table || !el.tableWrap) return;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    // Reset before measuring the table's natural (unscaled) size.
    el.table.style.transform = "";
    el.table.style.transformOrigin = "";
    el.tableWrap.style.height = "";
    if (!isMobile) return;
    // Weekly boards have more decision columns. Keep them at a readable size
    // and let the wrapper scroll horizontally instead of shrinking the text.
    if (state.scope === "weekly") return;

    const avail = el.tableWrap.clientWidth;
    // getBoundingClientRect gives sub-pixel width (offsetWidth rounds down,
    // which can leave the table a hair too wide once scaled).
    const natural = el.table.getBoundingClientRect().width;
    if (natural <= avail || natural <= 0) return;

    let scale = (avail / natural) * 0.99;
    el.table.style.transformOrigin = "top left";
    el.table.style.transform = `scale(${scale})`;

    // Verify against the ACTUAL rendered width and correct once if still over —
    // covers measurement/rounding/text-rendering discrepancies on real devices.
    const rendered = el.table.getBoundingClientRect().width;
    if (rendered > avail) {
      scale = Math.max(0.4, scale * (avail / rendered) * 0.99);
      el.table.style.transform = `scale(${scale})`;
    }

    // Pin the wrapper to the scaled height (the transformed element keeps its
    // full unscaled layout box, which would otherwise reserve empty space).
    el.tableWrap.style.height = Math.ceil(el.table.getBoundingClientRect().height) + "px";
  }

  // ---- Main render cycle --------------------------------------------------
  let loadToken = 0;

  async function render() {
    renderControls();
    writeUrlState();
    el.tableWrap.classList.toggle("is-weekly", state.scope === "weekly");
    const token = ++loadToken;

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

    // Loading state (skip flash if already cached)
    if (!cache.has(path)) {
      showTableMessage("loading", `<div class="fm-spinner"></div><p>Loading rankings…</p>`);
    }

    try {
      const data = await loadDataset(path);
      if (token !== loadToken) return; // a newer request superseded this one

      currentRows = Array.isArray(data.rows) ? data.rows : [];
      currentColumns = columnsFor();
      currentCtx = {
        valueDecimals: valueDecimalsFor(currentRows),
        rowKey: (r) => `${path}:${r.player_id || `${r.rank}:${r.player_name || "player"}`}`,
        isExpanded: (r) => expandedRows.has(`${path}:${r.player_id || `${r.rank}:${r.player_name || "player"}`}`),
      };

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
    el.segScope.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-scope]");
      if (!btn || btn.dataset.scope === state.scope) return;
      if (state.scope === "ros" && state.view !== "Overall") lastRosPosition = state.view;
      state.scope = btn.dataset.scope;
      normalizeState();
      resetSortForView();
      render();
    });

    el.fmWeek.addEventListener("change", () => {
      const week = Number(el.fmWeek.value);
      if (!weekOptions().includes(week) || week === state.week) return;
      state.week = week;
      resetSortForView();
      render();
    });

    el.viewTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-view]");
      if (!btn) return;
      const v = btn.dataset.view;
      if (v === state.view) return;
      state.view = v;
      if (state.scope === "ros" && v !== "Overall") lastRosPosition = v;
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

    el.table.addEventListener("mouseover", (e) => {
      const help = e.target.closest(".outcome-help");
      if (help) showMetricTip(help);
    });
    el.table.addEventListener("mouseout", (e) => {
      const help = e.target.closest(".outcome-help");
      if (help) hideMetricTip();
    });
    el.table.addEventListener("focusin", (e) => {
      const help = e.target.closest(".outcome-help");
      if (help) showMetricTip(help);
    });
    el.table.addEventListener("focusout", (e) => {
      if (e.target.closest(".outcome-help")) hideMetricTip();
    });
    el.tableWrap.addEventListener("scroll", hideMetricTip, { passive: true });

    // Sortable headers
    el.table.addEventListener("click", (e) => {
      if (e.target.closest(".outcome-help")) return;
      const expand = e.target.closest("[data-expand]");
      if (expand) {
        const key = expand.dataset.expand;
        if (expandedRows.has(key)) expandedRows.delete(key);
        else expandedRows.add(key);
        renderTable();
        return;
      }
      const th = e.target.closest("th[data-sortkey]");
      if (!th) return;
      const key = th.dataset.sortkey;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = defaultDirFor(key);
      }
      renderTable();
    });

    // Re-fit the table when the viewport changes (rotation, resize, etc.)
    let resizeRaf = 0;
    window.addEventListener("resize", () => {
      hideMetricTip();
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(fitTable);
    });
    window.addEventListener("scroll", hideMetricTip, { passive: true });

    // The initial fit happens with fallback fonts; once the web fonts (Inter /
    // JetBrains Mono) load, the table gets wider, so re-measure. On a real phone
    // the fonts arrive over the network after first render — without this the
    // table is under-scaled and overflows on the right.
    window.addEventListener("load", fitTable);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitTable);
    }

    window.addEventListener("popstate", () => {
      readUrlState();
      resetSortForView();
      render();
    });
  }

  // ---- Boot ---------------------------------------------------------------
  function cacheDom() {
    el.viewTabs = document.getElementById("fmViewTabs");
    el.segScope = document.getElementById("fmSegScope");
    el.weekControl = document.getElementById("fmWeekControl");
    el.fmWeek = document.getElementById("fmWeek");
    el.segScoring = document.getElementById("fmSegScoring");
    el.segFormat = document.getElementById("fmSegFormat");
    el.segSize = document.getElementById("fmSegSize");
    el.overallControls = document.getElementById("fmOverallControls");
    el.fmSearch = document.getElementById("fmSearch");
    el.fmMeta = document.getElementById("fmMeta");
    el.fmSubtitle = document.getElementById("fmSubtitle");
    el.fmTitle = document.getElementById("fmTitle");
    el.fmCount = document.getElementById("fmCount");
    el.fmHint = document.getElementById("fmHint");
    el.fmMethod = document.getElementById("fmMethod");
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
    const earlyPath = speculativePath();
    if (earlyPath) loadDataset(earlyPath);

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
