let deck = [];
let selectedTopic = 0;
let selectedStack = 0;
let studyCards = [];
let originalCards = [];
let cardIndex = 0;
let showingBack = false;
let mode = 'browse';
let showBrowseAnswers = false;
let largeBrowseCards = false;

const stackList = document.getElementById('stack-list');
const crumb = document.getElementById('crumb');
const stackTitle = document.getElementById('stack-title');
const stackMeta = document.getElementById('stack-meta');
const browseView = document.getElementById('browse-view');
const studyView = document.getElementById('study-view');
const browseModeButton = document.getElementById('browse-mode');
const studyModeButton = document.getElementById('study-mode');
const front = document.getElementById('front');
const back = document.getElementById('back');
const counter = document.getElementById('counter');
const showButton = document.getElementById('show');
const progressBar = document.getElementById('progress-bar');
const statusText = document.getElementById('status');
const studyCard = document.getElementById('study-card');
const browseToolbar = document.getElementById('browse-toolbar');
const toggleAnswersButton = document.getElementById('toggle-answers');
const toggleSizeButton = document.getElementById('toggle-size');
const stackSelect = document.getElementById('stack-select');

stackSelect.addEventListener('change', () => {
  const [ti, si] = stackSelect.value.split('-').map(Number);
  selectStack(ti, si);
});

async function loadDeck() {
  setStatus('Loading cards...');

  try {
    const response = await fetch('cards.tsv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load cards.tsv (${response.status})`);

    const rows = parseTsv(await response.text());
    deck = buildDeck(rows);

    if (!deck.length) {
      showEmptyState();
      return;
    }

    selectStack(0, 0);
    setStatus('');
  } catch (error) {
    stackTitle.textContent = 'Could not load cards';
    stackMeta.textContent = 'The flashcard TSV could not be loaded.';
    browseView.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    setStatus('');
  }
}

function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
  if (!lines.length) return [];

  const headers = lines[0].split('\t').map(value => value.trim());
  const required = ['ID', 'Front', 'Back', 'Topic', 'Subtopic'];
  const missing = required.filter(name => !headers.includes(name));
  if (missing.length) throw new Error(`cards.tsv is missing columns: ${missing.join(', ')}`);

  return lines.slice(1).map((line, index) => {
    const values = line.split('\t');
    if (values.length !== headers.length) {
      throw new Error(`Malformed cards.tsv row ${index + 2}`);
    }

    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
  });
}

function buildDeck(rows) {
  const topics = new Map();

  for (const row of rows) {
    const frontText = (row.Front || '').trim();
    const backText = (row.Back || '').trim();
    if (!frontText || !backText) continue;

    const topicName = (row.Topic || '').trim() || 'General';
    const stackName = (row.Subtopic || '').trim() || 'General';

    if (!topics.has(topicName)) topics.set(topicName, new Map());
    const stacks = topics.get(topicName);
    if (!stacks.has(stackName)) stacks.set(stackName, []);

    stacks.get(stackName).push({
      id: (row.ID || '').trim(),
      front: frontText,
      back: backText,
      tags: (row.Tags || '').trim(),
      type: (row.Type || '').trim(),
      added: (row.Added || '').trim(),
      session: (row.Session || '').trim()
    });
  }

  return [...topics.entries()].map(([topic, stacks]) => {
    const groupedStacks = [...stacks.entries()].map(([name, cards]) => ({
      name,
      description: 'Synced from the ds-study flashcard deck.',
      cards
    }));

    if (groupedStacks.length > 1) {
      groupedStacks.unshift({
        name: 'All cards',
        description: 'All active cards in this topic.',
        cards: groupedStacks.flatMap(stack => stack.cards)
      });
    }

    return { topic, stacks: groupedStacks };
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function instantUnflip() {
  studyCard.style.transition = 'none';
  studyCard.classList.remove('is-flipped');
  void studyCard.offsetWidth;
  studyCard.style.transition = '';
}

function selectStack(topicIndex, stackIndex, nextMode = mode) {
  selectedTopic = topicIndex;
  selectedStack = stackIndex;
  const stack = getCurrentStack();

  originalCards = [...stack.cards];
  studyCards = [...stack.cards];
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

function renderStackSelect() {
  stackSelect.innerHTML = deck.map((topic, ti) => `
    <optgroup label="${escapeHtml(topic.topic)}">
      ${topic.stacks.map((stack, si) => `
        <option value="${ti}-${si}" ${ti === selectedTopic && si === selectedStack ? 'selected' : ''}>
          ${escapeHtml(stack.name)}
        </option>
      `).join('')}
    </optgroup>
  `).join('');
}

function renderStackList() {
  stackList.innerHTML = deck.map((topic, topicIndex) => {
    const stacks = topic.stacks.map((stack, stackIndex) => {
      const active = topicIndex === selectedTopic && stackIndex === selectedStack;
      const count = stack.cards.length;

      return `
        <button class="stack-button ${active ? 'active' : ''}" type="button" data-topic="${topicIndex}" data-stack="${stackIndex}">
          <span>${escapeHtml(stack.name)}</span>
          <small>${count} ${count === 1 ? 'card' : 'cards'}</small>
        </button>
      `;
    }).join('');

    return `
      <section class="topic-group">
        <h3>${escapeHtml(topic.topic)}</h3>
        ${stacks}
      </section>
    `;
  }).join('');

  stackList.querySelectorAll('.stack-button').forEach((button) => {
    button.addEventListener('click', () => {
      selectStack(Number(button.dataset.topic), Number(button.dataset.stack), 'browse');
    });
  });
}

function renderHeader() {
  const topic = deck[selectedTopic];
  const stack = getCurrentStack();
  const count = stack.cards.length;

  crumb.textContent = topic.topic;
  stackTitle.textContent = stack.name;
  stackMeta.textContent = `${count} ${count === 1 ? 'card' : 'cards'} · ${stack.description}`;
}

function renderMode() {
  browseView.classList.toggle('hidden', mode !== 'browse');
  browseToolbar.classList.toggle('hidden', mode !== 'browse');
  studyView.classList.toggle('hidden', mode !== 'study');
  browseModeButton.classList.toggle('active', mode === 'browse');
  studyModeButton.classList.toggle('active', mode === 'study');
}

function renderBrowse() {
  const stack = getCurrentStack();

  browseView.innerHTML = stack.cards.map((card, index) => `
    <button class="mini-card${showBrowseAnswers ? ' is-flipped' : ''}" type="button" data-index="${index}">
      <div class="mini-face mini-front">
        <span class="mini-card-number">${index + 1}</span>
        <strong>${card.front}</strong>
      </div>
      <div class="mini-face mini-back-face">
        <span class="mini-card-number">${index + 1}</span>
        <div class="mini-answer">${card.back}</div>
      </div>
    </button>
  `).join('');

  browseView.classList.toggle('large-cards', largeBrowseCards);

  browseView.querySelectorAll('.mini-card').forEach((cardButton) => {
    cardButton.addEventListener('click', () => {
      cardButton.classList.toggle('is-flipped');
      typesetMath();
    });
  });
}

function renderStudy() {
  if (!studyCards.length) {
    front.textContent = 'No cards in this stack yet.';
    back.textContent = '';
    counter.textContent = '0 / 0';
    progressBar.style.width = '0%';
    showButton.disabled = true;
    return;
  }

  const current = studyCards[cardIndex];
  front.innerHTML = current.front;
  back.innerHTML = current.back;
  studyCard.classList.toggle('is-flipped', showingBack);
  showButton.textContent = showingBack ? 'Hide answer' : 'Show answer';
  showButton.disabled = false;
  counter.textContent = `${cardIndex + 1} / ${studyCards.length}`;
  progressBar.style.width = `${((cardIndex + 1) / studyCards.length) * 100}%`;
}

function showAnswer() {
  if (mode !== 'study' || !studyCards.length) return;
  showingBack = !showingBack;
  renderStudy();
  typesetMath();
}

function nextCard() {
  if (mode !== 'study' || !studyCards.length) return;
  showingBack = false;
  instantUnflip();
  cardIndex = (cardIndex + 1) % studyCards.length;
  renderStudy();
  typesetMath();
  animateCard('next');
}

function prevCard() {
  if (mode !== 'study' || !studyCards.length) return;
  showingBack = false;
  instantUnflip();
  cardIndex = (cardIndex - 1 + studyCards.length) % studyCards.length;
  renderStudy();
  typesetMath();
  animateCard('prev');
}

function animateCard(direction) {
  studyCard.classList.remove('slide-next', 'slide-prev');
  void studyCard.offsetWidth;
  studyCard.classList.add(direction === 'prev' ? 'slide-prev' : 'slide-next');
}

function shuffleCards() {
  studyCards = [...studyCards]
    .map((card) => ({ card, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ card }) => card);
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

function getCurrentStack() {
  return deck[selectedTopic].stacks[selectedStack];
}

function showEmptyState() {
  crumb.textContent = 'No cards';
  stackTitle.textContent = 'Deck is empty';
  stackMeta.textContent = 'No active cards were found in cards.tsv.';
  browseView.innerHTML = '<div class="empty-state">Add cards in ds-study, then publish the TSV mirror.</div>';
  stackSelect.innerHTML = '';
  setStatus('');
}

function setStatus(message) {
  statusText.textContent = message;
}

function typesetMath() {
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise();
  }
}

browseModeButton.addEventListener('click', () => {
  mode = 'browse';
  render();
});

studyModeButton.addEventListener('click', () => {
  mode = 'study';
  render();
});

toggleAnswersButton.addEventListener('click', () => {
  showBrowseAnswers = !showBrowseAnswers;
  applyBrowseAnswers();
});

toggleSizeButton.addEventListener('click', () => {
  largeBrowseCards = !largeBrowseCards;
  browseView.classList.toggle('large-cards', largeBrowseCards);
  toggleSizeButton.setAttribute('aria-pressed', String(largeBrowseCards));
  const label = toggleSizeButton.querySelector('span');
  if (label) label.textContent = largeBrowseCards ? 'Compact' : 'Large';
});

function applyBrowseAnswers() {
  browseView.querySelectorAll('.mini-card').forEach((card) => {
    card.classList.toggle('is-flipped', showBrowseAnswers);
  });
  toggleAnswersButton.classList.toggle('is-hidden', !showBrowseAnswers);
  toggleAnswersButton.setAttribute('aria-pressed', String(showBrowseAnswers));
  const label = toggleAnswersButton.querySelector('.toggle-label');
  if (label) label.textContent = showBrowseAnswers ? 'Hide answers' : 'Show answers';
}

document.getElementById('next').onclick = nextCard;
document.getElementById('prev').onclick = prevCard;
document.getElementById('shuffle').onclick = shuffleCards;
document.getElementById('reset').onclick = resetCards;
showButton.onclick = showAnswer;
studyCard.onclick = showAnswer;

let touchStartX = 0;
let touchStartY = 0;
let didSwipe = false;

studyCard.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  didSwipe = false;
}, { passive: true });

studyCard.addEventListener('touchmove', (e) => {
  const dx = Math.abs(e.touches[0].clientX - touchStartX);
  const dy = Math.abs(e.touches[0].clientY - touchStartY);
  if (dx > dy && dx > 8) didSwipe = true;
}, { passive: true });

studyCard.addEventListener('touchend', (e) => {
  if (!didSwipe) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 44) {
    e.preventDefault();
    dx < 0 ? nextCard() : prevCard();
  }
  didSwipe = false;
});

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    showAnswer();
  }
  if (e.key === 'ArrowRight') nextCard();
  if (e.key === 'ArrowLeft') prevCard();
});

window.addEventListener('load', typesetMath);
loadDeck();
