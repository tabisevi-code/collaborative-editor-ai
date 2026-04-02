PDF=main.pdf

.PHONY: diagrams pdf clean

diagrams:
	npm run render:diagrams

pdf:
	latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex

clean:
	latexmk -C
	rm -f *.bbl *.bcf *.blg *.run.xml *.toc *.out *.lof *.lot
