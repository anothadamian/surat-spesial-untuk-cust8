(() => {
const byId = (id) => document.getElementById(id);

const sections = ['intro', 'game', 'reflex', 'puzzle', 'pin', 'story'];
const transitionWash = byId('transitionWash');
const progressKey = 'dlynn-birthday-progress-v1';
const readProgress = () => {
  try { return JSON.parse(window.sessionStorage.getItem(progressKey) || '{}'); } catch { return {}; }
};
const saveProgress = (patch) => {
  try { window.sessionStorage.setItem(progressKey, JSON.stringify({ ...readProgress(), ...patch })); } catch { /* Storage may be unavailable. */ }
};
const savedProgress = readProgress();
let currentSection = sections.includes(savedProgress.section) ? savedProgress.section : 'intro';
let transitionCleanupTimer = null;
let storyWheelLocked = false;
let storyScrollSaveTimer = null;

byId('story').addEventListener('scroll', () => {
  if (currentSection !== 'story') return;
  window.clearTimeout(storyScrollSaveTimer);
  storyScrollSaveTimer = window.setTimeout(() => saveProgress({ storyScroll: byId('story').scrollTop }), 120);
}, { passive: true });

byId('story').addEventListener('wheel', (event) => {
  if (window.innerWidth <= 820 || Math.abs(event.deltaY) < 8) return;
  event.preventDefault();
  if (storyWheelLocked) return;

  const story = byId('story');
  const pages = [...story.querySelectorAll('.story-hero, .memories, .letter-section, .celebration-lab, .wish-section')];
  const currentIndex = pages.reduce((closest, page, index) => (
    Math.abs(page.offsetTop - story.scrollTop) < Math.abs(pages[closest].offsetTop - story.scrollTop) ? index : closest
  ), 0);
  const nextIndex = Math.max(0, Math.min(pages.length - 1, currentIndex + Math.sign(event.deltaY)));
  if (nextIndex === currentIndex) return;

  storyWheelLocked = true;
  story.scrollTo({ top: pages[nextIndex].offsetTop, behavior: 'smooth' });
  window.setTimeout(() => { storyWheelLocked = false; }, 720);
}, { passive: false });

function goTo(next) {
  if (next === currentSection) return;
  if (currentSection === 'puzzle' && next !== 'puzzle') hidePuzzleClue();
  transitionWash.classList.remove('is-moving');
  void transitionWash.offsetWidth;
  transitionWash.classList.add('is-moving');
  window.clearTimeout(transitionCleanupTimer);
  transitionCleanupTimer = window.setTimeout(() => transitionWash.classList.remove('is-moving'), 1300);

  window.setTimeout(() => {
    sections.forEach((id) => { byId(id).hidden = id !== next; });
    currentSection = next;
    saveProgress({ section: next, storyScroll: next === 'story' ? 0 : savedProgress.storyScroll || 0 });
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (next === 'game') startGame();
    if (next === 'reflex') startSignalGame();
    if (next === 'puzzle') schedulePuzzleClue();
    if (next === 'story') {
      storyWheelLocked = false;
      byId('story').scrollTop = 0;
      playAudio();
      observeReveals();
      byId('story').querySelector('.story-hero').classList.add('is-visible');
    }
  }, 540);
}

const audio = byId('audio');
const soundButton = byId('soundButton');
const soundLabel = byId('soundLabel');
const tracks = [
  { src: 'assets/birds-of-a-feather.mp3', label: 'BIRDS OF A FEATHER' },
  { src: 'assets/wildflower.mp3', label: 'WILDFLOWER' },
  { src: 'assets/pillowtalk.mp3', label: 'PILLOWTALK' },
];
let activeTrack = 0;

function syncSoundButton() {
  const playing = !audio.paused;
  soundButton.setAttribute('aria-pressed', String(playing));
  soundButton.setAttribute('aria-label', playing ? 'Jeda musik' : 'Putar musik');
  soundLabel.textContent = playing ? tracks[activeTrack].label : 'play our song';
  document.querySelectorAll('.track').forEach((track, index) => {
    track.classList.toggle('is-selected', index === activeTrack);
    track.querySelector('b').textContent = index === activeTrack && playing ? 'pause' : 'play';
  });
  document.querySelector('.mixtape-player')?.classList.toggle('is-playing', playing);
}

async function playAudio() {
  try { await audio.play(); } catch { /* Browser may still require a direct gesture. */ }
  syncSoundButton();
}

soundButton.addEventListener('click', () => {
  if (audio.paused) playAudio(); else audio.pause();
  syncSoundButton();
});
audio.addEventListener('play', syncSoundButton);
audio.addEventListener('pause', syncSoundButton);
window.addEventListener('load', playAudio);
document.addEventListener('pointerdown', () => { if (audio.paused) playAudio(); }, { once: true });

byId('startButton').addEventListener('click', () => {
  playAudio();
  goTo('game');
});

document.querySelectorAll('.track').forEach((button) => {
  button.addEventListener('click', () => {
    const index = Number(button.dataset.track);
    if (activeTrack === index && !audio.paused) {
      audio.pause();
      return;
    }
    activeTrack = index;
    audio.src = tracks[index].src;
    playAudio();
  });
});

const catchField = byId('catchField');
const basket = byId('basket');
const scoreLabel = byId('score');
const goodWords = ['deeptalk', 'kuliner', 'dlynn', 'tawa', 'jalan', 'makan', 'bestie'];
let basketPosition = 50;
let score = 0;
let spawnTimer = null;
let collisionTimer = null;
let gameRunning = false;

function setBasket(position) {
  basketPosition = Math.max(10, Math.min(90, position));
  basket.style.left = `${basketPosition}%`;
}

function spawnJoy() {
  if (!gameRunning) return;
  const item = document.createElement('span');
  item.className = 'falling-item';
  item.textContent = Math.random() > .45 ? '✦' : '♡';
  item.dataset.word = goodWords[Math.floor(Math.random() * goodWords.length)];
  item.style.left = `${5 + Math.random() * 87}%`;
  item.style.animationDuration = `${4.6 + Math.random() * 2.2}s`;
  item.style.setProperty('--fall-distance', `${Math.max(430, catchField.clientHeight + 80)}px`);
  item.addEventListener('animationend', () => item.remove());
  catchField.appendChild(item);
}

function checkCollisions() {
  const basketRect = basket.getBoundingClientRect();
  catchField.querySelectorAll('.falling-item').forEach((item) => {
    const rect = item.getBoundingClientRect();
    const overlaps = rect.bottom >= basketRect.top && rect.top <= basketRect.bottom && rect.right >= basketRect.left && rect.left <= basketRect.right;
    if (!overlaps) return;
    item.remove();
    score += 1;
    scoreLabel.textContent = score;
    basket.animate([{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(1.12)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 260 });
    if (score >= 7) finishGame();
  });
}

function startGame() {
  stopGame();
  score = 0;
  scoreLabel.textContent = '0';
  setBasket(50);
  gameRunning = true;
  spawnJoy();
  spawnTimer = window.setInterval(spawnJoy, 620);
  collisionTimer = window.setInterval(checkCollisions, 70);
  window.setTimeout(() => catchField.focus(), 650);
}

function stopGame() {
  gameRunning = false;
  window.clearInterval(spawnTimer);
  window.clearInterval(collisionTimer);
  catchField.querySelectorAll('.falling-item').forEach((item) => item.remove());
}

function finishGame() {
  if (!gameRunning) return;
  stopGame();
  window.setTimeout(() => goTo('reflex'), 350);
}

catchField.addEventListener('pointermove', (event) => {
  if (!gameRunning) return;
  const rect = catchField.getBoundingClientRect();
  setBasket(((event.clientX - rect.left) / rect.width) * 100);
});
catchField.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); setBasket(basketPosition - 7); }
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); setBasket(basketPosition + 7); }
});
byId('gameSkip').addEventListener('click', () => { stopGame(); goTo('reflex'); });

const signalTarget = byId('signalTarget');
const signalScore = byId('signalScore');
let signalHits = 0;
let signalRunning = false;
let signalPositionIndex = 0;
const signalPositions = [[50,50],[23,28],[74,24],[68,67],[31,73],[47,22],[81,48],[18,57],[52,72]];

function moveSignal() {
  signalPositionIndex = (signalPositionIndex + 1) % signalPositions.length;
  const [left, top] = signalPositions[signalPositionIndex];
  signalTarget.style.left = `${left}%`;
  signalTarget.style.top = `${top}%`;
}

function startSignalGame() {
  signalHits = 0;
  signalRunning = true;
  signalPositionIndex = 0;
  signalScore.textContent = '0';
  signalTarget.style.left = '50%';
  signalTarget.style.top = '50%';
  signalTarget.disabled = false;
  byId('signalProgress').style.width = '0%';
  byId('signalMessage').textContent = 'signal ready';
  window.setTimeout(() => signalTarget.focus(), 650);
}

function finishSignalGame() {
  if (!signalRunning) return;
  signalRunning = false;
  window.setTimeout(() => goTo('puzzle'), 420);
}

signalTarget.addEventListener('click', () => {
  if (!signalRunning) return;
  signalHits += 1;
  signalScore.textContent = signalHits;
  byId('signalProgress').style.width = `${(signalHits / 7) * 100}%`;
  byId('signalMessage').textContent = signalHits < 7 ? ['nice hit', 'locked on', 'keep going'][signalHits % 3] : 'all signals locked ✓';
  signalTarget.classList.remove('is-hit');
  void signalTarget.offsetWidth;
  signalTarget.classList.add('is-hit');
  if (signalHits >= 7) {
    signalTarget.disabled = true;
    finishSignalGame();
    return;
  }
  moveSignal();
});
byId('signalSkip').addEventListener('click', () => { signalRunning = false; goTo('puzzle'); });

const size = 10;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => alphabet[Math.floor(Math.random() * alphabet.length)]));
const wordPlacements = [
  { word: 'DEEPTALK', row: 1, col: 1, dr: 0, dc: 1 },
  { word: 'KULINER', row: 2, col: 8, dr: 1, dc: 0 },
  { word: 'DLYNN', row: 8, col: 1, dr: -1, dc: 1 },
];
wordPlacements.forEach(({ word, row, col, dr, dc }) => {
  [...word].forEach((letter, index) => { grid[row + dr * index][col + dc * index] = letter; });
});

const wordGrid = byId('wordGrid');
grid.flat().forEach((letter, index) => {
  const cell = document.createElement('span');
  cell.className = 'letter-cell';
  cell.textContent = letter;
  cell.dataset.row = Math.floor(index / size);
  cell.dataset.col = index % size;
  cell.setAttribute('aria-hidden', 'true');
  wordGrid.appendChild(cell);
});

let dragStart = null;
let currentSelection = [];
const foundWords = new Set();
let puzzleClueTimer = null;
let activeClueWord = '';

function cellAt(row, col) { return wordGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`); }
function selectionBetween(start, end) {
  const drRaw = end.row - start.row;
  const dcRaw = end.col - start.col;
  const straight = drRaw === 0 || dcRaw === 0 || Math.abs(drRaw) === Math.abs(dcRaw);
  if (!straight) return [];
  const length = Math.max(Math.abs(drRaw), Math.abs(dcRaw));
  const dr = Math.sign(drRaw);
  const dc = Math.sign(dcRaw);
  return Array.from({ length: length + 1 }, (_, index) => cellAt(start.row + dr * index, start.col + dc * index));
}
function paintSelection(cells) {
  currentSelection.forEach((cell) => cell.classList.remove('is-selecting'));
  currentSelection = cells.filter(Boolean);
  currentSelection.forEach((cell) => cell.classList.add('is-selecting'));
}
function updateFoundList() {
  byId('foundList').innerHTML = [...foundWords].map((word) => `<span class="found-word">${word}</span>`).join('');
  byId('gridHint').textContent = `${foundWords.size} dari 3 ditemukan`;
}
function hidePuzzleClue() {
  window.clearTimeout(puzzleClueTimer);
  puzzleClueTimer = null;
  activeClueWord = '';
  byId('clueLine').classList.remove('is-visible');
  byId('clueNote').textContent = '';
}
function drawPuzzleClue(placement) {
  if (!placement || foundWords.has(placement.word) || currentSection !== 'puzzle') return;
  const start = cellAt(placement.row, placement.col);
  const endIndex = placement.word.length - 1;
  const end = cellAt(placement.row + placement.dr * endIndex, placement.col + placement.dc * endIndex);
  const wrapRect = wordGrid.parentElement.getBoundingClientRect();
  const startRect = start.getBoundingClientRect();
  const endRect = end.getBoundingClientRect();
  const x1 = startRect.left + startRect.width / 2 - wrapRect.left;
  const y1 = startRect.top + startRect.height / 2 - wrapRect.top;
  const x2 = endRect.left + endRect.width / 2 - wrapRect.left;
  const y2 = endRect.top + endRect.height / 2 - wrapRect.top;
  const line = byId('clueLine');
  line.style.left = `${x1}px`;
  line.style.top = `${y1 - 2.5}px`;
  line.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
  line.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
  line.classList.add('is-visible');
  activeClueWord = placement.word;
  byId('clueNote').textContent = 'psst… ikuti garis kuning yang berkedip';
}
function schedulePuzzleClue(delay = 20000) {
  window.clearTimeout(puzzleClueTimer);
  puzzleClueTimer = window.setTimeout(() => {
    drawPuzzleClue(wordPlacements.find(({ word }) => !foundWords.has(word)));
  }, delay);
}
function finishSelection() {
  if (!dragStart) return;
  const chosen = currentSelection.map((cell) => cell.textContent).join('');
  const reversed = [...chosen].reverse().join('');
  const match = wordPlacements.find(({ word }) => word === chosen || word === reversed);
  if (match && !foundWords.has(match.word)) {
    foundWords.add(match.word);
    currentSelection.forEach((cell) => cell.classList.add('is-found'));
    updateFoundList();
    if (match.word === activeClueWord) {
      hidePuzzleClue();
      if (foundWords.size < wordPlacements.length) schedulePuzzleClue(20000);
    }
    if (foundWords.size === wordPlacements.length) {
      hidePuzzleClue();
      window.setTimeout(() => goTo('pin'), 800);
    }
  }
  currentSelection.forEach((cell) => cell.classList.remove('is-selecting'));
  currentSelection = [];
  dragStart = null;
}

wordGrid.addEventListener('pointerdown', (event) => {
  const cell = event.target.closest('.letter-cell');
  if (!cell) return;
  event.preventDefault();
  dragStart = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
  paintSelection([cell]);
});
wordGrid.addEventListener('pointermove', (event) => {
  if (!dragStart) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.letter-cell');
  if (!target || !wordGrid.contains(target)) return;
  paintSelection(selectionBetween(dragStart, { row: Number(target.dataset.row), col: Number(target.dataset.col) }));
});
window.addEventListener('pointerup', finishSelection);
window.addEventListener('resize', () => {
  if (activeClueWord) drawPuzzleClue(wordPlacements.find(({ word }) => word === activeClueWord));
});

let pinValue = '';
const pinDots = [...byId('pinDots').children];
function renderPin() { pinDots.forEach((dot, index) => dot.classList.toggle('filled', index < pinValue.length)); }
document.querySelectorAll('[data-digit]').forEach((button) => {
  button.addEventListener('click', () => {
    if (pinValue.length < 4) pinValue += button.dataset.digit;
    byId('pinError').textContent = '';
    renderPin();
  });
});
byId('pinDelete').addEventListener('click', () => { pinValue = pinValue.slice(0, -1); renderPin(); });
byId('unlockButton').addEventListener('click', () => {
  if (pinValue === '2709') {
    byId('pinError').textContent = 'That’s the one ♡';
    window.setTimeout(() => goTo('story'), 450);
  } else {
    byId('pinError').textContent = pinValue.length < 4 ? 'Masukkan 4 angka dulu.' : 'Belum tepat. Clue: hari paling spesial buat kamu, tanggal + bulan.';
    pinValue = '';
    renderPin();
  }
});

function observeReveals() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: .14 });
  document.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => observer.observe(element));
}

document.querySelectorAll('.memory-card').forEach((card) => {
  card.addEventListener('click', () => {
    const flipped = card.classList.toggle('is-flipped');
    card.setAttribute('aria-pressed', String(flipped));
  });
});

const blowButton = byId('blowButton');
const flame = byId('flame');
const giftBox = byId('giftBox');
let blowTimer = null;
let candleOut = false;
let blowProgress = 0;

function startBlowing() {
  if (candleOut || blowTimer) return;
  blowButton.querySelector('strong').textContent = 'Terus tahan…';
  flame.style.transform = 'rotate(18deg) scale(.72)';
  blowTimer = window.setInterval(() => {
    blowProgress = Math.min(100, blowProgress + 3);
    blowButton.style.setProperty('--blow-progress', `${blowProgress}%`);
    if (blowProgress < 100) return;
    window.clearInterval(blowTimer);
    candleOut = true;
    blowTimer = null;
    flame.classList.add('is-out');
    blowButton.querySelector('span').textContent = '✓';
    blowButton.querySelector('strong').textContent = 'Harapan terkirim';
    blowButton.disabled = true;
    byId('blowStatus').textContent = 'wish accepted';
    byId('cakeStation').classList.add('is-complete');
    byId('candleMessage').classList.add('is-visible');
    giftBox.disabled = false;
    byId('giftLabel').textContent = 'sekarang buka kadonya';
    launchConfetti(86);
  }, 45);
}

function stopBlowing() {
  if (candleOut) return;
  window.clearInterval(blowTimer);
  blowTimer = null;
  blowProgress = 0;
  blowButton.style.setProperty('--blow-progress', '0%');
  blowButton.querySelector('strong').textContent = 'Tahan untuk meniup';
  flame.style.transform = '';
}

blowButton.addEventListener('pointerdown', (event) => { event.preventDefault(); startBlowing(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach((eventName) => blowButton.addEventListener(eventName, stopBlowing));
blowButton.addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); startBlowing(); }
});
blowButton.addEventListener('keyup', (event) => {
  if (event.key === 'Enter' || event.key === ' ') stopBlowing();
});

giftBox.addEventListener('click', () => {
  if (giftBox.disabled) return;
  const open = giftBox.classList.toggle('is-open');
  giftBox.setAttribute('aria-expanded', String(open));
  byId('giftLabel').textContent = open ? 'one more thing…' : 'buka lagi';
  byId('giftMessage').textContent = open ? 'Hadiahnya sederhana: sahabat yang akan selalu ada di sisimu.' : '';
  if (open) {
    launchBlueHearts();
    launchConfetti(36);
  } else {
    byId('giftHearts').innerHTML = '';
  }
});

function launchBlueHearts() {
  const field = byId('giftHearts');
  field.innerHTML = '';
  const colors = ['#d59b22', '#f3c94e', '#ffe998', '#9e711b', '#fff5c9'];
  for (let index = 0; index < 26; index += 1) {
    const heart = document.createElement('span');
    heart.className = 'blue-heart';
    heart.textContent = index % 3 === 0 ? '♡' : '♥';
    const angle = (Math.PI * 2 * index) / 26 + Math.random() * .2;
    const distance = 75 + Math.random() * 120;
    heart.style.setProperty('--heart-x', `${Math.cos(angle) * distance}px`);
    heart.style.setProperty('--heart-y', `${Math.sin(angle) * distance - 45}px`);
    heart.style.setProperty('--heart-r', `${-80 + Math.random() * 160}deg`);
    heart.style.setProperty('--heart-size', `${.75 + Math.random() * 1.2}rem`);
    heart.style.setProperty('--heart-color', colors[index % colors.length]);
    heart.style.animationDelay = `${Math.random() * .18}s`;
    field.appendChild(heart);
  }
  window.setTimeout(() => { field.innerHTML = ''; }, 2300);
}

function launchConfetti(total = 70) {
  const confetti = byId('confetti');
  confetti.innerHTML = '';
  const colors = ['#fff6cf', '#f0c64b', '#ffffff', '#d79b2b', '#ffe58a'];
  for (let index = 0; index < total; index += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * .7}s`;
    piece.style.setProperty('--drift', `${-120 + Math.random() * 240}px`);
    confetti.appendChild(piece);
  }
  window.setTimeout(() => { confetti.innerHTML = ''; }, 3800);
}

const jarStars = [...document.querySelectorAll('.jar-star')];
let collectedStars = Math.max(0, Math.min(jarStars.length, Number(savedProgress.collectedStars) || 0));

function addSavedStar(index) {
  const savedStar = document.createElement('span');
  savedStar.textContent = index % 2 ? '♥' : '★';
  byId('jarFill').appendChild(savedStar);
}

function syncJarProgress() {
  byId('jarFill').innerHTML = '';
  jarStars.forEach((star, index) => {
    const isCollected = index < collectedStars;
    star.classList.toggle('collected', isCollected);
    star.disabled = isCollected;
    if (isCollected) addSavedStar(index);
  });
  byId('jarCount').textContent = `${collectedStars}/5`;
  if (collectedStars === jarStars.length) {
    byId('starJarGame').classList.add('is-complete');
    byId('jarReveal').textContent = 'Semua bintang sudah terkumpul. Sekarang buat satu harapan.';
    byId('wishButton').disabled = false;
  }
}

jarStars.forEach((star) => {
  star.addEventListener('click', () => {
    if (star.classList.contains('collected')) return;
    const starRect = star.getBoundingClientRect();
    const jarRect = byId('starJarGame').querySelector('img').getBoundingClientRect();
    star.style.setProperty('--collect-x', `${jarRect.left + jarRect.width / 2 - starRect.left - starRect.width / 2}px`);
    star.style.setProperty('--collect-y', `${jarRect.top + jarRect.height * .73 - starRect.top - starRect.height / 2}px`);
    star.classList.add('collected');
    star.disabled = true;
    collectedStars += 1;
    addSavedStar(collectedStars - 1);
    saveProgress({ collectedStars });
    byId('jarCount').textContent = `${collectedStars}/5`;
    if (collectedStars === jarStars.length) {
      byId('starJarGame').classList.add('is-complete');
      byId('jarReveal').textContent = 'Semua bintang sudah terkumpul. Sekarang buat satu harapan.';
      byId('wishButton').disabled = false;
    }
  });
});

byId('wishButton').addEventListener('click', () => {
  if (collectedStars < jarStars.length) return;
  document.querySelector('.wish-section').classList.add('is-wished');
  byId('wishFinal').classList.add('is-visible');
  byId('wishResult').textContent = 'Semoga yang kamu bisikkan tadi pelan-pelan menemukan jalannya.';
  saveProgress({ wished: true });
  launchConfetti(48);
});

function restoreExperience() {
  sections.forEach((id) => { byId(id).hidden = id !== currentSection; });
  syncJarProgress();

  if (savedProgress.wished) {
    document.querySelector('.wish-section').classList.add('is-wished');
    byId('wishFinal').classList.add('is-visible');
    byId('wishResult').textContent = 'Semoga yang kamu bisikkan tadi pelan-pelan menemukan jalannya.';
  }

  if (currentSection === 'game') startGame();
  if (currentSection === 'reflex') startSignalGame();
  if (currentSection === 'puzzle') schedulePuzzleClue();
  if (currentSection === 'story') {
    observeReveals();
    window.requestAnimationFrame(() => {
      byId('story').scrollTop = Math.max(0, Number(savedProgress.storyScroll) || 0);
      byId('story').querySelector('.story-hero').classList.add('is-visible');
    });
  }
}

restoreExperience();
syncSoundButton();
})();
