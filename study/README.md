# Flashcards

Mobile-friendly MathJax flashcards for the `ds-study` deck.

## Data source

The study page reads one file: `study/cards.tsv`.

`ds-study/flashcards/cards.tsv` is the canonical source of truth. Because `ds-study` is private while this GitHub Pages site is public, the browser cannot fetch the private repository directly without exposing credentials. `study/cards.tsv` is therefore a published mirror of the canonical deck.

When the study system commits cards, the mirror should be refreshed from the canonical TSV. Do not edit card content in this repository independently.

Expected columns:

```text
ID	Front	Back	Tags	Topic	Subtopic	Type	Added	Session
```

Math uses MathJax-compatible LaTeX. Use `<br>` instead of literal line breaks inside TSV fields.

## UI

The page groups cards by `Topic` and `Subtopic`. On phones, use the stack selector at the top. Study mode supports tap-to-reveal and swipe navigation.
