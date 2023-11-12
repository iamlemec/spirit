// spirit search

export { SpiritSearch }

import { EventTargetPlus } from './utils.js';

function placeCaretAtEnd(elem) {
    elem.focus();
    let sel = window.getSelection();
    sel.selectAllChildren(elem);
    sel.collapseToEnd();
}

class SpiritSearch extends EventTargetPlus {
    constructor(search, extern) {
        super();

        // references
        this.search = search;
        this.extern = extern;

        // elements
        this.window = search.querySelector('#search-window');
        this.query = search.querySelector('#search-query');
        this.results = search.querySelector('#search-results');
        this.create = search.querySelector('#search-create');

        // events
        this.sender = null;
        this.query.addEventListener('input', evt => {
            if (this.sender != null) {
                return;
            }
            this.sender = setTimeout(async () => {
                let text = this.getQuery();
                this.runQuery(text);
                this.sender = null;
            }, 250);
        }, {passive: true});

        // prevent newline
        this.query.addEventListener('keydown', evt => {
            if (evt.key == 'Enter') {
                let doc = this.getDocument();
                if (doc != null) {
                    doc = (doc == '/') ? null : doc;
                    this.emit('open', doc);
                    this.hide();
                }
                this.hide();
                evt.preventDefault();
            } else if (evt.key == 'Escape') {
                this.hide();
            } else if (evt.key == 'ArrowDown') {
                this.moveDown();
            } else if (evt.key == 'ArrowUp') {
                this.moveUp();
            }
        });

        // create file
        this.create.addEventListener('click', evt => {
            let text = this.getQuery();
            if (text.trim() == '') {
                return;
            }
            this.emit('create', text);
            this.hide();
        });

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

        // query
        let text = this.getQuery();
        this.runQuery(text);
    }

    hide() {
        if (!this.active) return;
        this.active = false;

        this.search.classList.remove('active');
    }

    getQuery() {
        return this.query.textContent;
    }

    async runQuery(text) {
        let resp = await this.extern.search(text);
        if (text.length == 0) {
            resp.unshift([null, 'Scratch']);
        }
        this.populateResults(resp);
    }

    populateResults(results) {
        this.results.innerHTML = '';
        for (let [doc, title] of results) {
            let line = document.createElement('div');
            line.classList.add('result-line');
            line.addEventListener('click', evt => {
                this.emit('open', doc);
                this.hide();
            });

            let dtag = document.createElement('span');
            dtag.classList.add('result-doc');
            dtag.textContent = doc ?? '/';

            let ttag = document.createElement('span');
            ttag.classList.add('result-title');
            ttag.textContent = title;

            line.appendChild(ttag);
            line.appendChild(dtag);
            this.results.appendChild(line);
        }
    }

    getSelected() {
        return this.results.querySelector('.result-line.selected');
    }

    getDocument() {
        let curr = this.getSelected();
        if (curr) {
            let item = curr.querySelector('.result-doc');
            let doc = item.textContent;
            return doc;
        }
        return null;
    }

    moveDown() {
        let curr = this.getSelected();
        if (curr) {
            let next = curr.nextElementSibling;
            if (next) {
                curr.classList.remove('selected');
                next.classList.add('selected');
            }
        } else {
            let first = this.results.querySelector('.result-line');
            if (first) {
                first.classList.add('selected');
            }
        }
    }

    moveUp() {
        let curr = this.getSelected();
        if (curr) {
            let prev = curr.previousElementSibling;
            curr.classList.remove('selected');
            if (prev) {
                prev.classList.add('selected');
            }
        }
    }
}
