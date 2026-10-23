import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  FAMILY_PACKS, DEFAULT_PREFS, normalisePreferences, eligibleCards,
  shuffle, createSession, nextCard, previousCard, validSession, sameDeck,
} from '../deck.js';

const catalogue = JSON.parse(await readFile(new URL('../data/cards.json', import.meta.url), 'utf8'));
const cardIds = cards => cards.map(card => card.id);
const familyIds = cardIds(eligibleCards(catalogue, DEFAULT_PREFS));
const normaliseText = text => text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test('catalogue has unique cards, valid packs, readable prompts and declared difficulty', () => {
  const packIds = catalogue.packs.map(pack => pack.id);
  assert.equal(new Set(packIds).size, packIds.length);
  assert.equal(new Set(cardIds(catalogue.cards)).size, catalogue.cards.length);
  const prompts = catalogue.cards.map(card => normaliseText(card.prompt));
  assert.equal(new Set(prompts).size, prompts.length, 'duplicate category prompts');
  for (const pack of catalogue.packs) {
    assert.equal(typeof pack.adult, 'boolean', `${pack.id} must explicitly classify adult content`);
    assert.ok(catalogue.cards.some(card => card.pack === pack.id), `${pack.id} is empty`);
  }
  for (const card of catalogue.cards) {
    assert.ok(packIds.includes(card.pack), `${card.id} refers to a missing pack`);
    assert.ok(['easy', 'standard', 'challenge'].includes(card.difficulty), `${card.id} has no usable difficulty`);
    assert.equal(card.prompt, card.prompt.trim());
    assert.ok(card.prompt.length > 0 && card.prompt.length <= 80, `${card.id} is unsuitable for a phone card`);
    assert.ok(!/[<>\n\r]/.test(card.prompt), `${card.id} contains markup or line breaks`);
  }
});

test('all nine user-supplied examples remain available in the family catalogue', () => {
  const expected = [
    'Ways to say “goodbye”', 'Things in your bedroom', 'Things that smell',
    'Asian countries', 'Sports teams', 'Common girl’s names', 'Big things',
    'US towns & cities', 'UK towns & cities',
  ];
  const prompts = new Set(eligibleCards(catalogue, DEFAULT_PREFS).map(card => normaliseText(card.prompt)));
  for (const prompt of expected) assert.ok(prompts.has(normaliseText(prompt)), `Missing example: ${prompt}`);
});

test('the default deck contains every family pack and no adult cards', () => {
  const selected = eligibleCards(catalogue, DEFAULT_PREFS);
  const adultPacks = new Set(catalogue.packs.filter(pack => pack.adult).map(pack => pack.id));
  assert.ok(selected.length >= 200, 'expanded family catalogue should be substantial');
  assert.deepEqual(new Set(selected.map(card => card.pack)), new Set(FAMILY_PACKS));
  assert.ok(selected.every(card => !adultPacks.has(card.pack)));
});

test('restored preferences cannot select adult content without explicit boolean opt-in', () => {
  const adultIds = catalogue.packs.filter(pack => pack.adult).map(pack => pack.id);
  for (const adult of [undefined, false, 0, 1, 'true', 'false', null]) {
    const selected = eligibleCards(catalogue, {packs: [...FAMILY_PACKS, ...adultIds], adult});
    assert.ok(selected.every(card => !adultIds.includes(card.pack)), `unsafe saved adult value: ${String(adult)}`);
  }
  const adultOnly = eligibleCards(catalogue, {packs: [], adult: true});
  assert.ok(adultOnly.length >= 25);
  assert.ok(adultOnly.every(card => adultIds.includes(card.pack)));
});

test('preferences discard unknown and repeated packs without mutating saved data', () => {
  const saved = {packs: ['food', 'food', 'unknown', 'after-dark', 'world'], adult: false};
  const original = structuredClone(saved);
  const prefs = normalisePreferences(saved);
  assert.deepEqual(saved, original);
  assert.deepEqual(prefs.packs, ['food', 'world']);
  assert.equal(prefs.adult, false);
  const selected = eligibleCards(catalogue, prefs);
  assert.ok(selected.length > 0);
  assert.ok(selected.every(card => ['food', 'world'].includes(card.pack)));
});

test('tricky-category switch removes only challenges from the selected packs', () => {
  const full = eligibleCards(catalogue, {packs: ['world', 'food'], adult: true});
  const simple = eligibleCards(catalogue, {packs: ['world', 'food'], adult: true, includeChallenge: false});
  assert.ok(simple.length > 0 && simple.length < full.length);
  assert.deepEqual(cardIds(simple), cardIds(full.filter(card => card.difficulty !== 'challenge')));
  assert.ok(simple.every(card => card.difficulty !== 'challenge'));
});

test('shuffling preserves all source IDs without changing the source', () => {
  const input = Object.freeze([...familyIds]);
  for (let seed = 0; seed < 32; seed++) {
    const result = shuffle(input, seededRandom(seed));
    assert.notEqual(result, input);
    assert.equal(result.length, input.length);
    assert.deepEqual(new Set(result), new Set(input));
  }
});

test('a complete play-through has no repeated or missing cards', () => {
  for (let seed = 1; seed <= 24; seed++) {
    let session = createSession([...familyIds, familyIds[0]], {random: seededRandom(seed)});
    const seen = [];
    while (session.cursor < session.order.length) {
      seen.push(session.order[session.cursor]);
      session = nextCard(session);
    }
    assert.equal(seen.length, familyIds.length);
    assert.deepEqual(new Set(seen), new Set(familyIds));
    assert.equal(session.cursor, session.order.length);
    assert.deepEqual(nextCard(session), session, 'next at exhaustion must not walk beyond the deck');
  }
});

test('Back undoes a tap and Next follows the same history without reshuffling', () => {
  const initial = createSession(familyIds, {random: seededRandom(42)});
  const first = initial.order[0];
  const secondSession = nextCard(initial);
  const second = secondSession.order[secondSession.cursor];
  const undone = previousCard(secondSession);
  assert.equal(undone.order[undone.cursor], first);
  assert.equal(nextCard(undone).order[nextCard(undone).cursor], second);
  assert.deepEqual(previousCard(initial), initial);
  assert.equal(initial.cursor, 0, 'navigation must not mutate the previous state');
});

test('exhausted decks survive saving and Back restores the final category', () => {
  const session = createSession(familyIds, {random: seededRandom(5)});
  session.cursor = session.order.length;
  const restored = JSON.parse(JSON.stringify(session));
  assert.equal(validSession(restored, familyIds), true);
  const previous = previousCard(restored);
  assert.equal(previous.order[previous.cursor], session.order.at(-1));
  assert.equal(nextCard(previous).cursor, session.order.length);
});

test('a saved game restores the same card, previous card and remaining order', () => {
  const session = createSession(familyIds, {random: seededRandom(91)});
  session.cursor = 12;
  const restored = JSON.parse(JSON.stringify(session));
  assert.equal(validSession(restored, familyIds), true);
  assert.deepEqual(restored, session);
  assert.equal(previousCard(restored).order[11], session.order[11]);
  assert.deepEqual(restored.order.slice(restored.cursor), session.order.slice(session.cursor));
});

test('invalid, outdated or adult-containing saved sessions are rejected for a family deck', () => {
  const valid = createSession(familyIds, {random: seededRandom(8)});
  const adultCard = catalogue.cards.find(card => catalogue.packs.some(pack => pack.id === card.pack && pack.adult));
  const duplicate = structuredClone(valid);
  duplicate.order[1] = duplicate.order[0];
  const adultInserted = structuredClone(valid);
  adultInserted.order[0] = adultCard.id;
  const invalidCases = [
    null, {}, {order: null, cursor: 0}, duplicate, adultInserted,
    {...valid, order: valid.order.slice(1)},
    {...valid, order: [...valid.order, 'deleted-category']},
    {...valid, cursor: -1}, {...valid, cursor: 1.5},
    {...valid, cursor: valid.order.length + 1}, {...valid, cursor: '1'},
  ];
  for (const invalid of invalidCases) assert.equal(validSession(invalid, familyIds), false);
  assert.equal(validSession(valid, familyIds.slice(1)), false, 'changing the deck invalidates the old session');
  assert.equal(validSession(valid, []), false);
});

test('fresh shuffles avoid immediately repeating the previous category', () => {
  for (let seed = 0; seed < 64; seed++) {
    const previous = familyIds[seed % familyIds.length];
    const session = createSession(familyIds, {random: seededRandom(seed), avoidFirst: previous});
    assert.notEqual(session.order[0], previous);
    assert.deepEqual(new Set(session.order), new Set(familyIds));
  }
  const oneCard = createSession(['only'], {avoidFirst: 'only'});
  assert.deepEqual(oneCard.order, ['only'], 'a one-card deck must remain playable');
});

test('a requested opening card is retained without dropping or repeating other cards', () => {
  const opening = catalogue.cards.find(card => card.prompt === 'Things in your bedroom').id;
  for (let seed = 0; seed < 12; seed++) {
    const session = createSession(familyIds, {random: seededRandom(seed), first: opening});
    assert.equal(session.order[0], opening);
    assert.deepEqual(new Set(session.order), new Set(familyIds));
  }
});

test('deck comparison ignores order but detects category additions and removals', () => {
  assert.equal(sameDeck(familyIds, [...familyIds].reverse()), true);
  assert.equal(sameDeck(familyIds, familyIds.slice(1)), false);
  assert.equal(sameDeck(familyIds, [...familyIds.slice(1), 'new-card']), false);
  assert.equal(sameDeck([], []), true);
});
