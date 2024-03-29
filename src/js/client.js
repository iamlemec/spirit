// spirit client

export { initSpirit }

import { SpiritEditor, enableResize } from './editor.js'
import { exportLatex } from './export.js';
import { SpiritSearch } from './search.js'
import { EventTargetPlus } from './utils.js'
import { ChangeSet } from '@codemirror/state'

/*
** web related tools
*/

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

// web split extension
function splitExtension(path) {
    let parts = path.split('.');
    let ext = parts.pop();
    let base = parts.join('.');
    return [base, ext];
}

// download named blob
function downloadBlob(name, blob) {
    let url = URL.createObjectURL(blob);
    let elem = document.createElement('a');
    elem.setAttribute('href', url);
    elem.setAttribute('download', `${name}`);
    elem.style.display = 'none';
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
}

// download named text
function downloadText(name, text) {
    let blob = new Blob([text], {type: 'text/plain'});
    downloadBlob(name, blob);
}

// get rid of null values in object
function filterNull(x) {
    return Object.fromEntries(
        Object.entries(x).filter(([k, v]) => v != null)
    );
}

/*
** network related tools
*/

// this store the current document id
class Connection extends EventTargetPlus {
    constructor(doc0) {
        super();

        // initialize websocket
        let [host, port] = [location.hostname, location.port];
        this.ws = new WebSocket(`ws://${host}:${port}`);

        // track connectivity
        this.ws.addEventListener('open', evt => {
            console.log('connected');
            this.emit('open');
        });

        // connect real events
        this.ws.addEventListener('message', evt => {
            console.log(`received: ${evt.data}`);
            let {cmd, data} = JSON.parse(evt.data);
            if (cmd == 'load') {
                let {doc, text} = data;
                this.emit('load', {doc, text});
            } else if (cmd == 'flash') {
                console.log(`flash: ${data}`);
                this.emit('flash', data);
            } else if (cmd == 'readonly') {
                this.emit('readonly', data);
            } else if (cmd == 'config') {
                this.emit('config', data);
            } else if (cmd == 'update') {
                let chg = ChangeSet.fromJSON(data);
                this.emit('update', chg);
            } else if (cmd == 'token') {
                let {username, token} = data;
                this.emit('token', {username, token});
            } else {
                console.log(`unknown command: ${cmd}`);
            }
        });
    }

    send(cmd, data) {
        let msg = filterNull({cmd, data});
        this.ws.send(JSON.stringify(msg));
    }

    loadDocument(doc) {
        this.send('load', doc);
    }

    closeDocument() {
        this.send('close');
    }

    sendUpdates(upd) {
        if (this.ws.readyState) {
            this.send('update', upd.changes.toJSON());
        }
    }

    saveDocument() {
        this.send('save');
    }

    createDocument(doc) {
        this.send('create', doc);
    }

    reloadIndex() {
        this.send('reindex');
    }

    sendLogin(username, password) {
        this.send('login', {username, password});
    }

    sendLogout() {
        this.send('logout');
    }

    sendDebug() {
        this.send('debug');
    }

    sendAuth() {
        let username = getCookie('username');
        let token = getCookie('token');
        if (username != null && token != null) {
            this.send('auth', {username, token});
        }
    }
}

// retrieve and cache external references
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

/*
** prime time
*/

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
        connect.sendAuth();
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

    // when we receive config from the server
    connect.addEventListener('config', evt => {
        let conf = evt.detail;
        editor.setConfig(conf);
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
    
    /* login interface */

    let login = document.querySelector('#login');
    let login_user = document.querySelector('#login-username');
    let login_pass = document.querySelector('#login-password');
    let login_button = document.querySelector('#login-button');
    let logout_button = document.querySelector('#logout-button');

    // connect login button
    login_button.addEventListener('click', evt => {
        let username = login_user.value;
        let password = login_pass.value;
        connect.sendLogin(username, password);
    });

    // connect logout button
    logout_button.addEventListener('click', evt => {
        setCookie('username', '');
        setCookie('token', '');
        login.classList.remove('authorized');
        connect.sendLogout();
    });

    // when we get a token from the server
    connect.addEventListener('token', evt => {
        let {username, token} = evt.detail;
        setCookie('username', username);
        setCookie('token', token);
        login.classList.remove('active');
        login.classList.add('authorized');
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
            login.classList.remove('active');
            if (!search.toggle()) {
                editor.edit.focus();
            }
            evt.preventDefault();
        } else if (evt.key == 'F2') {
            console.log('login');
            search.hide();
            if (login.classList.contains('active')) {
                login.classList.remove('active');
                editor.focus();
            } else {
                login.classList.add('active');
                login_user.focus();
            }
            evt.preventDefault();
        } else if (evt.key == 'F3') {
            console.log('=== DEBUG ===');
            console.log(`doc_current: ${doc_current}`);
            console.log('=============');
            connect.sendDebug();
            evt.preventDefault();
        } else if (evt.key == 'Escape') {
            search.hide();
            login.classList.remove('active');
            editor.focus();
            evt.preventDefault();
        }
    });

    // connect export button handlers (need to handle doc == null)
    mdn.addEventListener('click', evt => {
        let text = editor.getCode();
        let fname = doc_current ?? 'document.md';
        downloadText(fname, text);
    });
    tex.addEventListener('click', async evt => {
        let text = editor.getCode();
        let latex = await exportLatex(text);
        let doc_name = doc_current ?? 'document.md';
        let [fbase, _] = splitExtension(doc_name);
        let fname = `${fbase}.tex`;
        downloadText(fname, latex);
    });
}
