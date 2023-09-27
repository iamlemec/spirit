// spirit search

export { SpiritSearch }

function placeCaretAtEnd(elem) {
    elem.focus();
    let sel = window.getSelection();
    sel.selectAllChildren(elem);
    sel.collapseToEnd();
}

class SpiritSearch extends EventTarget {
    constructor(search, extern) {
        super();

        // references
        this.search = search;
        this.extern = extern;

        // elements
        this.window = search.querySelector('#search-window');
        this.query = search.querySelector('#search-query');
        this.results = search.querySelector('#search-results');

        // events
        this.sender = null;
        this.query.addEventListener('input', evt => {
            if (this.sender != null) {
                return;
            }
            this.sender = setTimeout(async () => {
                let query = this.query.textContent;
                console.log(`query: ${query}`);
                let resp = await this.extern.search(query);
                console.log(`response: ${resp}`);
                this.populateResults(resp);
                this.sender = null;
            }, 250);
        }, {passive: true});

        // state
        this.active = false;
    }

    toggle() {
        if (this.active) {
            this.hide();
        } else {
            this.show();
        }
        return this.active;
    }

    show() {
        if (this.active) return;
        this.active = true;

        // visual
        this.search.classList.add('active');
        placeCaretAtEnd(this.query);
    }

    hide() {
        if (!this.active) return;
        this.active = false;

        this.search.classList.remove('active');
    }

    populateResults(results) {
        this.results.innerHTML = '';
        for (let text of results) {
            let line = document.createElement('div');
            line.classList.add('result-line');
            line.textContent = text;
            this.results.appendChild(line);
        }
    }
}
