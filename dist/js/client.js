import { enableResize, SpiritEditor } from './editor.js';
import { SpiritSearch } from './search.js';
import { ChangeSet } from '../node_modules/@codemirror/state/dist/index.js';

// spirit client


// url tools
function setDocumentURL(doc) {
    if (doc == null) {
        history.replaceState({}, null, '/');
    } else {
        history.replaceState({}, null, `?doc=${doc}`);
    }
}

// cookie tools
function getCookie(key) {
    let cookies = document.cookie.split(';').map(x => x.trim().split('='));
    let cell = cookies.filter(([k, v]) => k == key).shift();
    if (cell == null) {
        return null;
    } else {
        let [_, val] = cell;
        return decodeURIComponent(val);
    }
}

function setCookie(key, val) {
    let enc = encodeURIComponent(val);
    document.cookie = `${key}=${enc}; SameSite=Lax`;
}

// this store the current document id
class Connection extends EventTarget {
    constructor(doc0) {
        super();

        // initialize websocket
        let [host, port] = [location.hostname, location.port];
        this.ws = new WebSocket(`ws://${host}:${port}`);

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

    closeDocument() {
        this.ws.send(JSON.stringify({
            cmd: 'close'
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

// main entry point
function initSpirit(doc_start) {
    console.log(`initSpirit: ${doc_start}`);

    // this is the doc state
    let doc_current = null;

    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');
    let mdn = document.querySelector('#markdown-button');
    let tex = document.querySelector('#latex-button');
    let pdf = document.querySelector('#pdf-button');
    enableResize(left, right, mid);

    // connect with server
    let connect = new Connection();

    // gets created either way
    let extern = new External();
    let editor = new SpiritEditor(left, right, extern);

    // headless case (load from cookie)
    if (doc_start == null) {
        let text = getCookie('text');
        editor.loadDocument(text);
    }

    /*
    ** network events
    */

    // connect open event
    connect.addEventListener('open', evt => {
        if (doc_start != null) {
            connect.loadDocument(doc_start);
        }
    });

    // when we receive a load new document command from the server
    connect.addEventListener('load', evt => {
        let {doc, text} = evt.detail;
        doc_current = doc;
        setDocumentURL(doc);
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

    // when our own editor registers a text update (to send to server)
    editor.addEventListener('update', evt => {
        let chg = evt.detail;
        if (doc_current == null) {
            let text = editor.getCode();
            setCookie('text', text);
        } else {
            connect.sendUpdates(chg);
        }
    });
    
    /*
    ** search interface
    */

    // make search interface
    let search_element = document.querySelector('#search');
    let search = new SpiritSearch(search_element, extern);

    // when search results in a document load request
    search.addEventListener('open', evt => {
        let doc1 = evt.detail;
        if (doc1 == null) {
            connect.closeDocument();
            doc_current = null;
            setDocumentURL(null);
            let text = getCookie('text');
            editor.loadDocument(text);
        } else {
            connect.loadDocument(doc1);
        }
    });

    // when search results in a document create request
    search.addEventListener('create', evt => {
        let text = evt.detail;
        connect.createDocument(text);
    });
    
    /*
    ** pure user interface events
    */

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

    // connect export button handlers (need to handle doc == null)
    mdn.addEventListener('click', evt => {
        window.location = `/md/${doc_current}`;
    });
    tex.addEventListener('click', evt => {
        window.location = `/latex/${doc_current}`;
    });
    pdf.addEventListener('click', evt => {
        window.location = `/pdf/${doc_current}`;
    });
}

export { initSpirit };
