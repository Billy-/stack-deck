/** Pure deck logic, shared by the browser and the small regression suite. */
export const FAMILY_PACKS = ['everyday', 'food', 'people', 'world', 'wild'];
export const DEFAULT_PREFS = {packs: FAMILY_PACKS, adult: false, includeChallenge: true, tabletop: false, keepAwake: false};

export function normalisePreferences(raw = {}) {
  const selected = Array.isArray(raw.packs) ? [...new Set(raw.packs.filter(id => FAMILY_PACKS.includes(id)))] : [...FAMILY_PACKS];
  return {
    packs: selected,
    adult: raw.adult === true,
    includeChallenge: raw.includeChallenge !== false,
    tabletop: raw.tabletop === true,
    keepAwake: raw.keepAwake === true,
  };
}

export function eligibleCards(catalogue, preferences) {
  const prefs = normalisePreferences(preferences);
  const packs = new Map(catalogue.packs.map(pack => [pack.id, pack]));
  return catalogue.cards.filter(card => {
    const pack = packs.get(card.pack);
    if (!pack) return false;
    const selected = pack.adult ? prefs.adult : prefs.packs.includes(pack.id);
    return selected && (prefs.includeChallenge || card.difficulty !== 'challenge');
  });
}

export function shuffle(ids, random = Math.random) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createSession(ids, {random = Math.random, avoidFirst = null, first = null} = {}) {
  const order = shuffle([...new Set(ids)], random);
  const firstIndex = first ? order.indexOf(first) : -1;
  if (firstIndex > 0) [order[0], order[firstIndex]] = [order[firstIndex], order[0]];
  else if (order.length > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
  return {order, cursor: 0};
}

export function nextCard(session) {
  return {...session, cursor: Math.min(session.order.length, session.cursor + 1)};
}

export function previousCard(session) {
  return {...session, cursor: Math.max(0, session.cursor - 1)};
}

export function validSession(session, eligibleIds) {
  if (!session || !Array.isArray(session.order) || !Number.isInteger(session.cursor)) return false;
  if (!eligibleIds.length || session.order.length !== eligibleIds.length || session.cursor < 0 || session.cursor > session.order.length) return false;
  const allowed = new Set(eligibleIds);
  return new Set(session.order).size === allowed.size && session.order.every(id => allowed.has(id));
}

export function sameDeck(a, b) {
  return a.length === b.length && new Set(a).size === new Set(b).size && a.every(id => b.includes(id));
}
