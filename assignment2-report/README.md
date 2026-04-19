# Assignment 2 Report Package

This directory contains the Assignment 2 report package.

Files:

- `main.tex` — LaTeX entry point
- `main.pdf` — compiled Assignment 2 report
- `sections/` — report sections

Build locally:

```bash
cd assignment2-report
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
```

This package is the authoritative report for Assignment 2.
The older `final-report/` directory remains only as a historical Assignment 1 artifact.
