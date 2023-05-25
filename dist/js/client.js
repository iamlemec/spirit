import { enableResize, SpiritEditor, setCookie, getCookie } from './editor.js';

// spirit editor


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
}

class External {
    constructor() {
        this.imgs = new Map();
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

        // connect editor events
        editor.addEventListener('update', evt => {
            connect.sendUpdates(doc, evt.detail);
        });

        // connect server events
        connect.addEventListener('load', evt => {
            editor.loadDocument(evt.detail);
        });

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

export { initSpirit };
