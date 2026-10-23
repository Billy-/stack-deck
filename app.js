import {DEFAULT_PREFS, normalisePreferences, eligibleCards, createSession, nextCard, previousCard, validSession, sameDeck} from './deck.js';

const $ = id => document.getElementById(id);
const cardButton = $('category-card');
const settingsDialog = $('settings-dialog');
const helpDialog = $('help-dialog');
const storageKey = `stack-deck:v1:${new URL('.', location.href).pathname}`;
const colours = {everyday:'#f2df7a', food:'#f6af88', people:'#d6c7e9', world:'#b9d9cd', wild:'#edbdc6'};
let catalogue, cardsById, packsById, preferences, session;
let ready = false;
let storageAvailable = true;
let offlineReady = false;
let wakeLock = null;
let wakePending = false;
let toastTimer, animationTimer;
let previousFocus = null;
let lastAdvance = -Infinity;

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({version:1, preferences, session}));
  } catch {
    if (storageAvailable) notify('This browser can’t save your place. You can still play.');
    storageAvailable = false;
  }
}

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved?.version === 1 ? saved : null;
  } catch { return null; }
}

function currentIds(prefs = preferences) {
  return eligibleCards(catalogue, prefs).map(card => card.id);
}

function setPrompt(text) {
  $('prompt').textContent = text;
  $('opposite-prompt').textContent = text;
  const long = text.length > 31;
  $('prompt').classList.toggle('long', long);
  $('opposite-prompt').classList.toggle('long', long);
}

function render({animate = false, announce = false} = {}) {
  const complete = session.cursor >= session.order.length;
  const card = complete ? null : cardsById.get(session.order[session.cursor]);
  const pack = card ? packsById.get(card.pack) : null;
  document.body.classList.toggle('table-mode', preferences.tabletop && !complete);
  $('table-mode').setAttribute('aria-pressed', String(preferences.tabletop));
  $('table-mode').disabled = complete;
  $('back').disabled = session.cursor === 0;
  $('pack-name').textContent = pack ? pack.name : 'Every card played';
  cardButton.dataset.pack = card ? card.pack : 'complete';
  $('card-count').textContent = `${String(Math.min(session.cursor + 1, session.order.length)).padStart(2, '0')} / ${session.order.length}`;
  $('card-eyebrow').textContent = complete ? 'Nicely played' : 'Your category';
  setPrompt(complete ? 'That’s the deck.' : card.prompt);
  $('end-note').hidden = !complete;
  $('end-note').textContent = complete ? 'Same good company. A whole new order. Tap to shuffle and play again.' : '';
  $('difficulty').textContent = complete ? 'Ready for another?' : card.difficulty === 'challenge' ? 'A little trickier' : pack.adult ? 'Adults only · 18+' : 'Say it. Stack it.';
  const label = complete ? 'Shuffle & play again' : 'Tap for the next category';
  $('advance-label').firstChild.textContent = `${label} `;
  cardButton.setAttribute('aria-label', complete ? 'Deck complete. Shuffle and play again' : `${card.prompt}. ${pack.name}${pack.adult ? ', adults only' : ''}. Tap for the next category.`);
  const packCount = preferences.packs.length + (preferences.adult ? 1 : 0);
  $('deck-summary').textContent = `${session.order.length} categories · ${preferences.adult ? 'After dark included' : `${packCount} ${packCount === 1 ? 'pack' : 'packs'} in play`}`;
  if (announce) $('announcement').textContent = complete ? 'Deck complete. Tap to shuffle and play again.' : `Card ${session.cursor + 1} of ${session.order.length}: ${card.prompt}`;
  if (animate) {
    clearTimeout(animationTimer);
    cardButton.classList.remove('dealing');
    requestAnimationFrame(() => {
      cardButton.classList.add('dealing');
      animationTimer = setTimeout(() => cardButton.classList.remove('dealing'), 220);
    });
  }
}

function shuffleDeck(prefs = preferences) {
  const previousId = session?.order[Math.min(session.cursor, session.order.length - 1)];
  preferences = prefs;
  session = createSession(currentIds(), {avoidFirst:previousId});
  save();
  render({animate:true, announce:true});
}

function advance() {
  if (!ready || settingsDialog.open || helpDialog.open) return;
  const now = performance.now();
  // A double tap on a shared phone should not silently skip two categories.
  if (now - lastAdvance < 280) return;
  lastAdvance = now;
  if (session.cursor >= session.order.length) shuffleDeck();
  else {
    session = nextCard(session);
    save();
    render({animate:true, announce:true});
  }
  requestAwake();
}

function goBack() {
  if (!ready || session.cursor === 0 || settingsDialog.open || helpDialog.open) return;
  session = previousCard(session);
  lastAdvance = -Infinity;
  save();
  render({animate:true, announce:true});
}

function openDialog(dialog) {
  previousFocus = document.activeElement;
  dialog.showModal();
  dialog.scrollTop = 0;
}

function closeDialog(dialog) {
  dialog.close();
  previousFocus?.focus();
}

function draftPreferences() {
  return normalisePreferences({
    ...preferences,
    packs:[...document.querySelectorAll('.pack-option input:checked')].map(input => input.value),
    adult:$('adult-toggle').checked,
    includeChallenge:$('challenge-toggle').checked,
    keepAwake:$('awake-toggle').checked,
  });
}

function updateSelection() {
  const count = currentIds(draftPreferences()).length;
  $('selection-summary').textContent = count ? `${count} categories, ready to play` : 'Pick at least one pack to play';
  $('settings-apply').disabled = count === 0;
  $('reshuffle').disabled = count === 0;
}

function buildPackOptions() {
  $('pack-options').replaceChildren();
  for (const pack of catalogue.packs.filter(pack => !pack.adult)) {
    const label = document.createElement('label');
    label.className = 'pack-option';
    label.title = pack.description;
    label.style.setProperty('--chip', colours[pack.id] || '#d4d9c8');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'packs';
    input.value = pack.id;
    input.id = `pack-${pack.id}`;
    const chip = document.createElement('span');
    chip.className = 'pack-chip';
    chip.setAttribute('aria-hidden','true');
    const copy = document.createElement('span');
    copy.className = 'pack-copy';
    const name = document.createElement('strong');
    name.textContent = pack.name;
    const quantity = document.createElement('span');
    quantity.className = 'pack-qty';
    quantity.textContent = `${catalogue.cards.filter(card => card.pack === pack.id).length} categories`;
    copy.append(name, quantity);
    const check = document.createElement('span');
    check.className = 'checkmark';
    check.setAttribute('aria-hidden','true');
    check.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';
    label.append(input,chip,copy,check);
    $('pack-options').append(label);
  }
}

function openSettings() {
  if (!ready) return;
  for (const input of document.querySelectorAll('.pack-option input')) input.checked = preferences.packs.includes(input.value);
  $('adult-toggle').checked = preferences.adult;
  $('challenge-toggle').checked = preferences.includeChallenge;
  $('awake-toggle').checked = preferences.keepAwake;
  $('awake-toggle').disabled = !('wakeLock' in navigator) || !window.isSecureContext;
  if ($('awake-toggle').disabled) $('awake-note').textContent = 'Unavailable in this browser. Adjust your phone’s auto-lock if needed.';
  updateSelection();
  openDialog(settingsDialog);
}

async function requestAwake() {
  if (!preferences?.keepAwake || !('wakeLock' in navigator) || !window.isSecureContext || document.visibilityState !== 'visible' || wakeLock || wakePending) return;
  wakePending = true;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (!preferences.keepAwake || document.visibilityState !== 'visible') { await lock.release(); return; }
    wakeLock = lock;
    $('awake-note').textContent = 'Screen is staying awake while this app is visible.';
    lock.addEventListener('release', () => {
      if (wakeLock === lock) wakeLock = null;
      $('awake-note').textContent = 'Your phone may release this in the background or on low battery.';
    });
  } catch { $('awake-note').textContent = 'Your phone declined. Check auto-lock or battery-saving settings.'; }
  finally { wakePending = false; }
}

function updateConnectivity() {
  $('offline-status').classList.toggle('ready', offlineReady);
  $('offline-status').textContent = !navigator.onLine ? (offlineReady ? 'Playing offline' : 'Connection offline') : offlineReady ? 'Ready offline' : 'Made for game night';
}

async function setupOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !['http:','https:'].includes(location.protocol)) return;
  try {
    // Register relative to the project, so GitHub Pages /repository/ paths work.
    const registration = await navigator.serviceWorker.register('./sw.js');
    const checkCache = async () => {
      if (!('caches' in window)) return;
      const names = await caches.keys();
      const prefix = `stack-deck:${new URL('.', location.href).pathname}:`;
      for (const name of names.filter(name => name.startsWith(prefix))) {
        const cache = await caches.open(name);
        if (await cache.match(new URL('./data/cards.json', location.href).href)) { offlineReady = true; break; }
      }
      updateConnectivity();
    };
    navigator.serviceWorker.addEventListener('controllerchange', checkCache);
    if (registration.active) await checkCache();
    const installing = registration.installing;
    if (installing) installing.addEventListener('statechange', () => {
      if (installing.state === 'activated' || installing.state === 'installed') checkCache();
    });
    navigator.serviceWorker.ready.then(checkCache).catch(() => {});
  } catch { /* Offline installation is optional; the loaded deck still plays. */ }
}

cardButton.addEventListener('click', advance);
$('back').addEventListener('click', goBack);
$('settings-open').addEventListener('click', openSettings);
$('help-open').addEventListener('click', () => openDialog(helpDialog));
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => closeDialog($(button.dataset.close)));
for (const dialog of [settingsDialog, helpDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  });
  dialog.addEventListener('cancel', () => previousFocus?.focus());
}
$('settings-form').addEventListener('change', updateSelection);
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  const next = draftPreferences();
  const ids = currentIds(next);
  if (!ids.length) return;
  const changed = !sameDeck(ids, currentIds());
  if (changed) shuffleDeck(next);
  else { preferences = next; save(); render(); }
  closeDialog(settingsDialog);
  if (!preferences.keepAwake && wakeLock) wakeLock.release().catch(() => {});
  else requestAwake();
  if (changed) notify(`Fresh deck. ${ids.length} categories in play.`);
});
$('reshuffle').addEventListener('click', () => {
  const next = draftPreferences();
  if (!currentIds(next).length) return;
  shuffleDeck(next);
  closeDialog(settingsDialog);
  if (!preferences.keepAwake && wakeLock) wakeLock.release().catch(() => {});
  else requestAwake();
  notify('Shuffled. Here’s to another good round.');
});
$('table-mode').addEventListener('click', () => {
  if (!ready) return;
  preferences.tabletop = !preferences.tabletop;
  save();
  render();
  requestAwake();
});
if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
  $('fullscreen').hidden = false;
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { notify('Full screen isn’t available here. Try adding the app to your home screen.'); }
  });
  document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'));
}
document.addEventListener('keydown', event => {
  if (!ready || settingsDialog.open || helpDialog.open || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); advance(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goBack(); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestAwake(); });
window.addEventListener('online', updateConnectivity);
window.addEventListener('offline', updateConnectivity);
// Each intentional change is already saved immediately. Do not save again on
// pagehide: an older background tab could otherwise overwrite newer progress.

async function start() {
  try {
    const response = await fetch('./data/cards.json');
    if (!response.ok) throw new Error('Category catalogue unavailable');
    catalogue = await response.json();
    if (!catalogue.cards?.length || !catalogue.packs?.length) throw new Error('Empty category catalogue');
    cardsById = new Map(catalogue.cards.map(card => [card.id,card]));
    packsById = new Map(catalogue.packs.map(pack => [pack.id,pack]));
    const saved = readSaved();
    preferences = normalisePreferences(saved?.preferences || DEFAULT_PREFS);
    let ids = currentIds();
    if (!ids.length) { preferences = normalisePreferences(DEFAULT_PREFS); ids = currentIds(); }
    const first = !saved ? catalogue.cards.find(card => card.prompt === 'Things in your bedroom')?.id : null;
    session = validSession(saved?.session, ids) ? saved.session : createSession(ids, {first});
    buildPackOptions();
    ready = true;
    cardButton.disabled = false;
    render();
    save();
    updateConnectivity();
    requestAwake();
    setupOffline();
  } catch {
    cardButton.dataset.pack = 'error';
    $('pack-name').textContent = 'Couldn’t load the deck';
    $('card-count').textContent = '';
    $('card-eyebrow').textContent = 'Let’s try that again';
    setPrompt('A little connection hiccup.');
    $('end-note').hidden = false;
    $('end-note').textContent = 'Open the hosted app with a connection once to download your cards.';
    $('difficulty').textContent = '';
    $('advance-label').firstChild.textContent = 'Tap to retry ';
    cardButton.disabled = false;
    cardButton.setAttribute('aria-label','Could not load category cards. Tap to retry.');
    cardButton.addEventListener('click', () => { cardButton.disabled = true; start(); }, {once:true});
  }
}

start();
