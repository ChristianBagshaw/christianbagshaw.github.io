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
  setStatus('Loading stacks...');

  try {
    const index = await fetch('cards/index.json').then(r => {
      if (!r.ok) throw new Error(`Could not load cards/index.json (${r.status})`);
      return r.json();
    });

    deck = await Promise.all(
      index.map(file => fetch(`cards/${file}`).then(r => {
        if (!r.ok) throw new Error(`Could not load cards/${file} (${r.status})`);
        return r.json();
      }))
    );

    if (!deck.length) {
      showEmptyState();
      return;
    }

    selectStack(0, 0);
    setStatus('');
  } catch (error) {
    stackTitle.textContent = 'Could not load stacks';
    stackMeta.textContent = 'Run a local server, then refresh this page.';
    browseView.innerHTML = `<div class="empty-state">${error.message}</div>`;
    setStatus('');
  }
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
    <optgroup label="${topic.topic}">
      ${topic.stacks.map((stack, si) => `
        <option value="${ti}-${si}" ${ti === selectedTopic && si === selectedStack ? 'selected' : ''}>
          ${stack.name}
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
          <span>${stack.name}</span>
          <small>${count} ${count === 1 ? 'card' : 'cards'}</small>
        </button>
      `;
    }).join('');

    return `
      <section class="topic-group">
        <h3>${topic.topic}</h3>
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
  stackMeta.textContent = `${count} ${count === 1 ? 'card' : 'cards'} - ${stack.description || 'No description yet.'}`;
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
        <p class="mini-answer">${card.back}</p>
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
  // Force a reflow so re-adding the class restarts the animation.
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
  crumb.textContent = 'No deck';
  stackTitle.textContent = 'No stacks yet';
  stackMeta.textContent = 'Add topic files to cards/ and list them in cards/index.json.';
  browseView.innerHTML = '<div class="empty-state">cards.json is empty.</div>';
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

// Touch swipe navigation
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
