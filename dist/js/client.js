import { enableResize, SpiritEditor } from './editor.js';
import { SpiritSearch } from './search.js';
import { ChangeSet } from '../node_modules/@codemirror/state/dist/index.js';

// spirit client


class Connection extends EventTarget {
    constructor(url) {
        super();

        // initialize websocket
        this.ws = new WebSocket(url);

        // track connectivity
        this.ws.addEventListener('open', evt => {
            console.log('connected');
            this.dispatchEvent(new Event('open'));
        });

        // connect real events
        this.ws.addEventListener('message', evt => {
            console.log(`received: ${evt.data}`);
            let {cmd, doc, data} = JSON.parse(evt.data);
            if (cmd == 'load') {
                this.dispatchEvent(
                    new CustomEvent('load', {detail: {doc, text: data}})
                );
            } else if (cmd == 'flash') {
                console.log(`flash: ${data}`);
                this.dispatchEvent(
                    new CustomEvent('flash', {detail: data})
                );
            } else if (cmd == 'readonly') {
                this.dispatchEvent(
                    new CustomEvent('readonly', {detail: data})
                );
            } else if (cmd == 'update') {
                let chg = ChangeSet.fromJSON(data);
                this.dispatchEvent(
                    new CustomEvent('update', {detail: chg})
                );
            } else {
                console.log(`unknown command: ${cmd}`);
            }
        });
    }

    loadDocument(doc) {
        this.ws.send(JSON.stringify({
            cmd: 'load', doc
        }));
    }

    sendUpdates(upd) {
        if (this.ws.readyState) {
            this.ws.send(JSON.stringify({
                cmd: 'update', data: upd.changes.toJSON()
            }));
        }
    }

    saveDocument() {
        this.ws.send(JSON.stringify({
            cmd: 'save'
        }));
    }

    createDocument(doc) {
        this.ws.send(JSON.stringify({
            cmd: 'create', doc
        }));
    }

    reloadIndex() {
        this.ws.send(JSON.stringify({
            cmd: 'reindex'
        }));
    }
}

class External {
    constructor() {
        this.imgs = new Map();
        this.refs = new Map();
        this.pops = new Map();
        this.cits = new Map();
    }

    async getImg(id) {
        if (this.imgs.has(id)) {
            return this.imgs.get(id);
        } else {
            let resp = await fetch(`/img/${id}`);
            let blob = await resp.blob();
            let url = URL.createObjectURL(blob);
            this.imgs.set(id, url);
            return url;
        }
    }

    async getRef(id) {
        if (this.refs.has(id)) {
            return this.refs.get(id);
        } else {
            let resp = await fetch(`/ref/${id}`);
            if (resp.ok) {
                let text = await resp.text();
                this.refs.set(id, text);
                return text;
            } else {
                return null;
            }
        }
    }

    async getPop(id) {
        if (this.pops.has(id)) {
            return this.pops.get(id);
        } else {
            let resp = await fetch(`/pop/${id}`);
            if (resp.ok) {
                let html = await resp.text();
                this.pops.set(id, html);
                return html;
            } else {
                return null;
            }
        }
    }

    async getCit(id) {
        if (this.cits.has(id)) {
            return this.cits.get(id);
        } else {
            let resp = await fetch(`/cit/${id}`);
            if (resp.ok) {
                let info = await resp.json();
                this.cits.set(id, info);
                return info;
            } else {
                return null;
            }
        }
    }

    async search(query) {
        let resp = await fetch(`/search/${query}`);
        if (resp.ok) {
            let data = await resp.json();
            return data;
        }
    }

    invalidate() {
        this.imgs.clear();
        this.refs.clear();
        this.pops.clear();
        this.cits.clear();
    }
}

function setDocument(doc) {
    history.replaceState({}, null, `?doc=${doc}`);
}

function initSpirit(doc) {
    console.log(`initSpirit: ${doc}`);

    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');
    let mdn = document.querySelector('#markdown-button');
    let tex = document.querySelector('#latex-button');
    let pdf = document.querySelector('#pdf-button');
    enableResize(left, right, mid);

    // gets created either way
    let extern = new External();
    let editor = new SpiritEditor(left, right, extern);

    // connect with server
    let [host, port] = [location.hostname, location.port];
    let connect = new Connection(`ws://${host}:${port}`);

    // make search interface
    let search_element = document.querySelector('#search');
    let search = new SpiritSearch(search_element, extern);

    // when search results in a document load request
    search.addEventListener('open', evt => {
        let doc1 = evt.detail;
        connect.loadDocument(doc1);
    });

    // when search results in a document create request
    search.addEventListener('create', evt => {
        let text = evt.detail;
        connect.createDocument(text);
    });

    // when our own editor registers a text update (to send to server)
    editor.addEventListener('update', evt => {
        let chg = evt.detail;
        connect.sendUpdates(chg);
    });

    // user interface keybindings
    document.addEventListener('keydown', evt => {
        if (!editor.readonly) {
            if (evt.key == 'F5') {
                console.log('reindexing');
                connect.reloadIndex();
                extern.invalidate();
                evt.preventDefault();
            } else if (evt.ctrlKey && evt.key == 's') {
                console.log('saving');
                connect.saveDocument();
                evt.preventDefault();
            }
        }
        if (evt.key == 'F1') {
            console.log('search');
            if (!search.toggle()) {
                editor.edit.focus();
            }
            return false;
        }
    });

    // when receive a load new document command from the server
    connect.addEventListener('load', evt => {
        let {doc, text} = evt.detail;
        setDocument(doc);
        editor.loadDocument(text);
    });

    // when we receive document updates from the server (from other clients)
    connect.addEventListener('update', evt => {
        let chg = evt.detail;
        editor.applyUpdate(chg);
    });

    // when we are toggled readonly/editable by the server
    connect.addEventListener('readonly', evt => {
        let ro = evt.detail;
        editor.setReadOnly(ro);
    });

    // when we establish the websocket connection
    connect.addEventListener('open', evt => {
        connect.loadDocument(doc);
    });

    // connect export button handlers
    mdn.addEventListener('click', evt => {
        window.location = `/md/${doc}`;
    });
    tex.addEventListener('click', evt => {
        window.location = `/latex/${doc}`;
    });
    pdf.addEventListener('click', evt => {
        window.location = `/pdf/${doc}`;
    });
}

export { initSpirit };
