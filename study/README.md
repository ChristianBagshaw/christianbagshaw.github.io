# LaTeX Flashcards

Static flashcard site with MathJax, topic stacks, sub-stacks, browse mode, and study mode.

## Add cards

Edit `cards.json`. The structure is two levels deep: topics contain stacks, and stacks contain cards.

```json
[
  {
    "topic": "Machine Learning",
    "stacks": [
      {
        "name": "Optimisation",
        "description": "Core update rules.",
        "cards": [
          {
            "front": "Question here",
            "back": "Answer with \\(x^2\\) or \\[x^2 + y^2 = z^2\\]"
          }
        ]
      }
    ]
  }
]
```

## Run locally

Use any tiny local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

Put these files in a public repo, then enable GitHub Pages for the repo.
