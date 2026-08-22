// Test the keyword matching locally
const KEYWORD_RULES: Array<[RegExp, string[]]> = [
  [/restaur|restaurant.*order|order.*food|ordering/i, ['food-vocabulary', 'ordering', 'polite-requests']],
  [/coffee|café|cafe|drinks?|bebida/i, ['food-vocabulary', 'ordering']],
  [/food|comida|cuisine|eat|meal|breakfast|lunch|dinner|menu/i, ['food-vocabulary']],
  [/direction|giving.*direction|finding.*way|navigate/i, ['directions', 'transportation']],
  [/hotel|check.?in|accommodation/i, ['travel', 'formal-requests']],
  [/shopping|at.*store|buying/i, ['shopping', 'prices-money']],
];

function keywordTag(name: string, description: string): string[] {
  const text = `${name} ${description}`;
  const matched = new Set<string>();
  for (const [pattern, slugs] of KEYWORD_RULES) {
    if (pattern.test(text)) {
      for (const s of slugs) matched.add(s);
    }
  }
  return [...matched];
}

const tests = [
  ['Let\'s Chat: Restaurant Ordering', 'Order a full meal confidently!'],
  ['Let\'s Chat: Giving Directions', 'Guide someone to their destination!'],
  ['Let\'s Chat: Hotel Check-in', 'Book a room, ask about amenities'],
  ['New Words: Food Favorites', 'Learn delicious food vocabulary!'],
  ['Let\'s Chat: At the Store', 'Shop like a pro! Ask prices'],
];

for (const [name, desc] of tests) {
  const topics = keywordTag(name, desc);
  console.log(`"${name}" → ${topics.length >= 2 ? '✓' : '✗'} [${topics.join(', ')}]`);
}
