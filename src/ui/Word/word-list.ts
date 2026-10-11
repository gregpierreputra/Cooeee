// The real words Cooee Word accepts as guesses, one file per length, shipped
// with the app and stored ahead by the service worker, so a guess is checked
// with no signal. Each file is one string: the sorted words end to end.

const lists = new Map<number, Promise<string>>();

export function fetchWordList(length: number): Promise<string> {
  let list = lists.get(length);
  if (!list) {
    list = fetch(`${import.meta.env.BASE_URL}word/words-${length}.json`).then(async (response) => {
      if (!response.ok) throw new Error(`word list ${length}: ${response.status}`);
      const words: unknown = await response.json();
      if (typeof words !== 'string') throw new Error(`word list ${length} is not a string`);
      return words;
    });
    // A failed load is tried again next time, not remembered.
    list.catch(() => lists.delete(length));
    lists.set(length, list);
  }
  return list;
}
