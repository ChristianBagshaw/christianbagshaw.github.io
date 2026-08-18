let deck = [];
let selectedStack = 0;
let studyCards = [];
let originalCards = [];
let cardIndex = 0;
let showingBack = false;
let mode = 'browse';
let showBrowseAnswers = false;
let largeBrowseCards = false;

const $ = (id) => document.getElementById(id);
const stackList = $('stack-list');
const crumb = $('crumb');
const stackTitle = $('stack-title');
const stackMeta = $('stack-meta');
const browseView = $('browse-view');
const studyView = $('study-view');
const browseModeButton = $('browse-mode');
const studyModeButton = $('study-mode');
const front = $('front');
const back = $('back');
const counter = $('counter');
const showButton = $('show');
const progressBar = $('progress-bar');
const statusText = $('status');
const studyCard = $('study-card');
const browseToolbar = $('browse-toolbar');
const toggleAnswersButton = $('toggle-answers');
const toggleSizeButton = $('toggle-size');
const stackSelect = $('stack-select');

async function loadDeck() {
  setStatus('Loading cards...');
  try {
    const response = await fetch('cards.tsv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load cards.tsv (${response.status})`);
    deck = buildDeck(parseTsv(await response.text()));
    if (!deck.length) return showEmptyState();
    selectStack(0);
    setStatus('');
  } catch (error) {
    stackTitle.textContent = 'Could not load cards';
    stackMeta.textContent = 'The flashcard TSV could not be loaded.';
    browseView.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    setStatus('');
  }
}

function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split('\t').map(x => x.trim());
  const required = ['ID', 'Front', 'Back', 'Topic'];
  const missing = required.filter(x => !headers.includes(x));
  if (missing.length) throw new Error(`cards.tsv is missing columns: ${missing.join(', ')}`);

  return lines.slice(1).map((line, i) => {
    const values = line.split('\t');
    if (values.length !== headers.length) throw new Error(`Malformed cards.tsv row ${i + 2}`);
    return Object.fromEntries(headers.map((header, j) => [header, values[j] ?? '']));
  });
}

function buildDeck(rows) {
  const topics = new Map();
  for (const row of rows) {
    const frontText = (row.Front || '').trim();
    const backText = (row.Back || '').trim();
    if (!frontText || !backText) continue;
    const topic = (row.Topic || '').trim() || 'General';
    if (!topics.has(topic)) topics.set(topic, []);
    topics.get(topic).push({
      id: (row.ID || '').trim(),
      front: frontText,
      back: backText,
      subtopic: (row.Subtopic || '').trim(),
      tags: (row.Tags || '').trim(),
      type: (row.Type || '').trim(),
      session: (row.Session || '').trim()
    });
  }
  return [...topics.entries()].map(([name, cards]) => ({
    name,
    description: 'All active cards in this topic.',
    cards
  }));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function selectStack(index, nextMode = mode) {
  selectedStack = index;
  originalCards = [...deck[index].cards];
  studyCards = [...deck[index].cards];
  cardIndex = 0;
  showingBack = false;
  instantUnflip();
  mode = nextMode;
  render();
}

function render() {
  renderStackList();
  renderStackSelect();
  renderHeader();
  renderMode();
  renderBrowse();
  renderStudy();
  typesetMath();
}

function renderStackList() {
  stackList.innerHTML = `
    <section class="topic-group">
      <h3>Topics</h3>
      ${deck.map((stack, i) => `
        <button class="stack-button ${i === selectedStack ? 'active' : ''}" type="button" data-stack="${i}">
          <span>${escapeHtml(stack.name)}</span>
          <small>${stack.cards.length} ${stack.cards.length === 1 ? 'card' : 'cards'}</small>
        </button>
      `).join('')}
    </section>`;

  stackList.querySelectorAll('.stack-button').forEach(button => {
    button.addEventListener('click', () => selectStack(Number(button.dataset.stack), 'browse'));
  });
}

function renderStackSelect() {
  stackSelect.innerHTML = deck.map((stack, i) => `
    <option value="${i}" ${i === selectedStack ? 'selected' : ''}>${escapeHtml(stack.name)}</option>
  `).join('');
}

function renderHeader() {
  const stack = deck[selectedStack];
  crumb.textContent = 'Topic';
  stackTitle.textContent = stack.name;
  stackMeta.textContent = `${stack.cards.length} ${stack.cards.length === 1 ? 'card' : 'cards'} · ${stack.description}`;
}

function renderMode() {
  browseView.classList.toggle('hidden', mode !== 'browse');
  browseToolbar.classList.toggle('hidden', mode !== 'browse');
  studyView.classList.toggle('hidden', mode !== 'study');
  browseModeButton.classList.toggle('active', mode === 'browse');
  studyModeButton.classList.toggle('active', mode === 'study');
}

function renderBrowse() {
  const cards = deck[selectedStack].cards;
  browseView.innerHTML = cards.map((card, i) => `
    <button class="mini-card${showBrowseAnswers ? ' is-flipped' : ''}" type="button">
      <div class="mini-face mini-front"><span class="mini-card-number">${i + 1}</span><strong>${card.front}</strong></div>
      <div class="mini-face mini-back-face"><span class="mini-card-number">${i + 1}</span><div class="mini-answer">${card.back}</div></div>
    </button>
  `).join('');
  browseView.classList.toggle('large-cards', largeBrowseCards);
  browseView.querySelectorAll('.mini-card').forEach(card => card.addEventListener('click', () => {
    card.classList.toggle('is-flipped');
    typesetMath();
  }));
}

function renderStudy() {
  if (!studyCards.length) return;
  const current = studyCards[cardIndex];
  front.innerHTML = current.front;
  back.innerHTML = current.back;
  studyCard.classList.toggle('is-flipped', showingBack);
  showButton.textContent = showingBack ? 'Hide answer' : 'Show answer';
  counter.textContent = `${cardIndex + 1} / ${studyCards.length}`;
  progressBar.style.width = `${((cardIndex + 1) / studyCards.length) * 100}%`;
}

function instantUnflip() {
  studyCard.style.transition = 'none';
  studyCard.classList.remove('is-flipped');
  void studyCard.offsetWidth;
  studyCard.style.transition = '';
}

function showAnswer() {
  if (mode !== 'study' || !studyCards.length) return;
  showingBack = !showingBack;
  renderStudy();
  typesetMath();
}

function moveCard(delta) {
  if (mode !== 'study' || !studyCards.length) return;
  showingBack = false;
  instantUnflip();
  cardIndex = (cardIndex + delta + studyCards.length) % studyCards.length;
  renderStudy();
  typesetMath();
}

function shuffleCards() {
  studyCards = [...studyCards].sort(() => Math.random() - 0.5);
  cardIndex = 0;
  showingBack = false;
  instantUnflip();
  renderStudy();
  setStatus('Stack shuffled.');
  typesetMath();
}

function resetCards() {
  studyCards = [...originalCards];
  cardIndex = 0;
  showingBack = false;
  instantUnflip();
  renderStudy();
  setStatus('Stack reset.');
  typesetMath();
}

function showEmptyState() {
  crumb.textContent = 'No cards';
  stackTitle.textContent = 'Deck is empty';
  stackMeta.textContent = 'No active cards were found in cards.tsv.';
  browseView.innerHTML = '<div class="empty-state">Add cards in ds-study, then publish the TSV copy.</div>';
  stackSelect.innerHTML = '';
  setStatus('');
}

function setStatus(message) { statusText.textContent = message; }
function typesetMath() { if (window.MathJax?.typesetPromise) MathJax.typesetPromise(); }

stackSelect.addEventListener('change', () => selectStack(Number(stackSelect.value)));
browseModeButton.addEventListener('click', () => { mode = 'browse'; render(); });
studyModeButton.addEventListener('click', () => { mode = 'study'; render(); });
toggleAnswersButton.addEventListener('click', () => { showBrowseAnswers = !showBrowseAnswers; renderBrowse(); typesetMath(); });
toggleSizeButton.addEventListener('click', () => {
  largeBrowseCards = !largeBrowseCards;
  renderBrowse();
  const label = toggleSizeButton.querySelector('span');
  if (label) label.textContent = largeBrowseCards ? 'Compact' : 'Large';
});
$('next').onclick = () => moveCard(1);
$('prev').onclick = () => moveCard(-1);
$('shuffle').onclick = shuffleCards;
$('reset').onclick = resetCards;
showButton.onclick = showAnswer;
studyCard.onclick = showAnswer;

let touchStartX = 0;
studyCard.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
studyCard.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 44) dx < 0 ? moveCard(1) : moveCard(-1);
}, { passive: true });

document.addEventListener('keydown', e => {
  if (e.key === ' ') { e.preventDefault(); showAnswer(); }
  if (e.key === 'ArrowRight') moveCard(1);
  if (e.key === 'ArrowLeft') moveCard(-1);
});

window.addEventListener('load', typesetMath);
loadDeck();
