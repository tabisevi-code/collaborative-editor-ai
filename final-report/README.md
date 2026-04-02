# Final Report Workspace

This directory contains the submission-ready report source for AI1220 Assignment 1.

It is intentionally separate from the implementation docs so the report can evolve without
changing the MVP-facing README, OpenAPI, or demo docs.

## Layout

- `main.tex`: LaTeX entry point
- `sections/`: report chapters and appendices
- `tables/`: reusable LaTeX tables
- `figures/mermaid-src/`: editable Mermaid diagram sources for required architecture artifacts
- `figures/rendered/`: PNG exports rendered from Mermaid for the final PDF

## Build

First install the local report tooling:

```bash
cd final-report
npm install
```

If TinyTeX was installed in user space, make sure the binaries are on PATH:

```bash
export PATH="$HOME/Library/TinyTeX/bin/universal-darwin:$PATH"
```

Render the editable Mermaid sources into PNGs:

```bash
make diagrams
```

If `latexmk` is available:

```bash
cd final-report
make pdf
```

Fallback:

```bash
cd final-report
pdflatex main.tex
pdflatex main.tex
```

## Diagram Sources

The report keeps editable Mermaid sources alongside the rendered PNG exports so the diagrams remain
versionable and easy to update. If a diagram changes, re-run `make diagrams` before rebuilding the PDF.
