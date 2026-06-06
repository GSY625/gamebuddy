const DEFAULT_WORDS = [
  '傻逼',
  '操你',
  '去死',
  '赌博',
  '色情',
  '习近平',
  '共产党',
];

let extraWords: string[] = [];

export function setSensitiveWords(words: string[]) {
  extraWords = words;
}

export function filterSensitive(text: string): string {
  let result = text;
  const all = [...DEFAULT_WORDS, ...extraWords];
  for (const word of all) {
    if (!word) continue;
    const stars = '*'.repeat(word.length);
    result = result.split(word).join(stars);
  }
  return result;
}

export function containsSensitive(text: string): boolean {
  const filtered = filterSensitive(text);
  return filtered !== text;
}
