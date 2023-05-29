// spirit editor

export { initSpirit }

import { SpiritEditor, enableResize, getCookie, setCookie } from './editor.js'

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
                    new CustomEvent('load', {detail: data})
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

    sendUpdates(doc, upd) {
        if (this.ws.readyState) {
            this.ws.send(JSON.stringify({
                cmd: 'update', doc, data: upd.changes.toJSON()
            }));
        }
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

    invalidate() {
        this.imgs.clear();
        this.refs.clear();
        this.pops.clear();
    }
}

function initSpirit(doc) {
    console.log(`initSpirit: ${doc}`);

    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');
    enableResize(left, right, mid);

    // server or no-server mode
    if (doc) {
        // make connected editor
        let extern = new External();
        let editor = new SpiritEditor(left, right, extern);

        // connect with server
        const port = 8000;
        let connect = new Connection(`ws://localhost:${port}`);

        // connect update event
        editor.addEventListener('update', evt => {
            connect.sendUpdates(doc, evt.detail);
        });

        // connect refresh event
        document.onkeydown = evt => {
            if (evt.key == 'F5') {
                console.log('reindexing');
                connect.reloadIndex();
                extern.invalidate();
                return false;
            } else {
                return true;
            }
        };

        // connect load event
        connect.addEventListener('load', evt => {
            editor.loadDocument(evt.detail);
        });

        // connect open event
        connect.addEventListener('open', evt => {
            connect.loadDocument(doc);
        });
    } else {
        // make bare bones editor
        let editor = new SpiritEditor(left, right, null);

        // connect cookie storage
        editor.addEventListener('update', evt => {
            setCookie('spirit', evt.detail.text);
        });

        // no server mode
        let text = getCookie('spirit');
        editor.loadDocument(text);
    }
}
