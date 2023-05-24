// spirit editor

export { initSpirit }

import { SpiritEditor, enableResize, getCookie, setCookie } from './spirit.js'

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

function initSpirit(doc) {
    console.log(`initSpirit: ${doc}`);

    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');

    // resize panels
    enableResize(left, right, mid);
    let editor = new SpiritEditor(left, right);

    // server or no-server mode
    if (doc) {
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
        // connect cookie storage
        editor.addEventListener('update', evt => {
            setCookie('spirit', evt.detail.text);
        });

        // no server mode
        let text = getCookie('spirit');
        editor.loadDocument(text);
    }
}
