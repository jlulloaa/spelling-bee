# Buzzy Spelling Bee

A fun web app that helps non-native English speakers (Chilean kids, around 10 years old) practise English dictation and get ready for spelling bee contests. Buzz the bee guides the flash card; Dotty the ladybird looks after the results and the settings.

> **🐝 Buzz:** "Bzzz! Hi, friend! Do you want to become a spelling champion? Listen to the word, spell it out loud, and I'll tell you how you did!"
>
> **🐞 Dotty:** "And I'll keep count of every word you get right, so you can watch your honeycomb fill up. Come and play with us!"
>
> ### 👉 [**Play now: jlulloaa.github.io/spelling-bee**](https://jlulloaa.github.io/spelling-bee/)

It is a plain HTML/CSS/JavaScript single-page app: no build step, no dependencies, ready for GitHub Pages.

## How to play

1. **Listen**: tap the speaker to hear the word (a recorded pronunciation when the dictionary has one, otherwise the browser's English voice).
2. **Check the meaning** (optional): tap the dictionary. The word is hidden in the definition.
3. **Spell**: tap the bee and say each letter. The letters appear in the word box. Tap the box once to stop; the app also stops after a few seconds of silence. Typing is always available through the keyboard button under the card.
4. **Check**: a pop-up asks you to double-tap the word box. The card flips and shows your spelling (right letters green, wrong ones red), the correct word, its definition, and Buzz saying "Well done!" or "Better luck next time!".
5. **Next**: tap the card to flip it back and get the next word.

Each word comes up once per session, in random order. When the list is finished you can practise the missed words or play again.

## Tabs

| Tab | What it does |
| --- | --- |
| HOME (Inicio) | The flash card. |
| RESULTS (Resultados) | Dotty shows words right and left, mistakes to practise, streaks, a level and a honeycomb with one cell per word. |
| CONFIG (Ajustes) | App language (Spanish by default, or English), English accent (American or British), sound effects, and the word list: edit, add, remove, upload (CSV or JSON), download, reset. |

Everything is kept only for the current browser session (it uses `sessionStorage`): reloading the page keeps your progress and list, closing the tab starts fresh.

## Word list

The default list is [`data/word-list-default.json`](data/word-list-default.json): a JSON array of words.

Uploads in CONFIG (CSV or JSON) can either replace the list (this starts a new game) or be added to it.

```json
["Moon", "Camel", { "word": "Eagle", "definition": "A big bird of prey", "partOfSpeech": "noun", "example": "The eagle flew high." }]
```

```csv
word,definition,partOfSpeech,example
Camel,"A large animal with humps",noun,"The camel crossed the desert."
Moon,,,
```

- Only `word` is required. CSV files without a header are read as one word per row (comma, semicolon or tab separated).
- A definition in the file always wins over the online dictionary.
- Words with spaces or hyphens ("Coral Reef", "Double-Decker") are fine: spaces, hyphens and capitals are ignored when checking the spelling.

## Where things come from

- **Pronunciation**: recordings from [dictionaryapi.dev](https://dictionaryapi.dev) (American or British, as chosen in CONFIG), falling back to the browser's text-to-speech.
- **Definitions**: [dictionaryapi.dev](https://dictionaryapi.dev) (Wiktionary data, CC BY-SA), then the Wikipedia summary API when a word is not found. Cambridge and Oxford do not offer free public APIs.
- **Listening to the spelling**: the browser's Web Speech API, set to English. Letter names and common mis-hearings are mapped back to letters ("double you" becomes W). It works in Chrome, Edge and Safari and needs an internet connection; Firefox has no support, so the keyboard is used there.

### Troubleshooting the microphone

Add `?debug` to the address (for example `https://jlulloaa.github.io/spelling-bee/?debug`) to show a small panel with what the browser's speech recogniser hears, letter by letter. It helps to see whether a missing letter was not heard or was heard as another word.

## Run it locally

Opening `index.html` directly from disk will not load the word list (browsers block `fetch` on `file://`). Use any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Speech recognition needs `https://` or `localhost` and microphone permission.

## Publish with GitHub Pages

Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**. The app is then served at <https://jlulloaa.github.io/spelling-bee/>.

## Tests

```sh
node tests/parsers.test.js
```

Covers word-file parsing (JSON and CSV), the spoken-letter parser and the Spanish/English texts.

## Project layout

```
index.html                    page structure
css/styles.css                look and feel
data/word-list-default.json   default words
js/i18n.js                    Spanish and English texts
js/mascots.js                 bee, ladybird and icons (inline SVG)
js/core.js                    word-list parsing and the session store
js/voice.js                   speech recognition, pronunciation, dictionary look-ups
js/app.js                     tabs, flash card, results, settings
tests/parsers.test.js         unit tests
```

## License

MIT, see [LICENSE](LICENSE).
