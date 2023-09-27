// spirit search

export { SpiritSearch }

function placeCaretAtEnd(elem) {
    elem.focus();
    let sel = window.getSelection();
    sel.selectAllChildren(elem);
    sel.collapseToEnd();
}

class SpiritSearch extends EventTarget {
    constructor(search) {
        super();
        this.search = search;
        this.window = search.querySelector('#search-window');
        this.query = search.querySelector('#search-query');
        this.results = search.querySelector('#search-results');
    }

    toggle() {
        this.search.classList.toggle('active');
        if (this.search.classList.contains('active')) {
            placeCaretAtEnd(this.query);
        }
    }
}
