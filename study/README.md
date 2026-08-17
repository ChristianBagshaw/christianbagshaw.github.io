# Flashcards

Mobile-friendly MathJax flashcards for the `ds-study` deck.

## Data source

The study page reads one file: `study/cards.tsv`.

`ds-study/flashcards/cards.tsv` is the canonical source of truth. Because `ds-study` is private while this GitHub Pages site is public, the browser cannot fetch the private repository directly without exposing credentials.

There is deliberately **no automatic sync between the repositories**. The website TSV is just a manually published copy of the canonical deck.

When you want the website cards refreshed:

1. Copy `ds-study/flashcards/cards.tsv` over `christianbagshaw.github.io/study/cards.tsv`.
2. Commit and push the website repository.

For example, if the repositories are checked out beside each other:

```bash
cp ../ds-study/flashcards/cards.tsv study/cards.tsv
git add study/cards.tsv
git commit -m "Update study flashcards"
git push
```

`commit session` in `ds-study` should update the canonical TSV only. It does **not** update the website repository. Do not edit card content independently in the website copy.

Expected columns:

```text
ID	Front	Back	Tags	Topic	Subtopic	Type	Added	Session
```

Math uses MathJax-compatible LaTeX. Use `<br>` instead of literal line breaks inside TSV fields.

## UI

The page groups cards by `Topic` and `Subtopic`. On phones, use the stack selector at the top. Study mode supports tap-to-reveal and swipe navigation.
