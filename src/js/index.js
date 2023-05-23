// spirit editor

export { initSpirit }

import { SpiritEditor, enableResize } from './spirit.js'

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

    sendUpdates(doc, chg) {
        if (this.ws.readyState) {
            this.ws.send(JSON.stringify({
                cmd: 'update', doc, data: chg.toJSON()
            }));
        }
    }
}

function initSpirit(doc) {
    let url = 'ws://localhost:8000';

    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');

    // resize panels
    enableResize(left, right, mid);

    // make the actual editor
    let editor = new SpiritEditor(left, right);
    let connect = new Connection(url);

    // connect editor events
    editor.addEventListener('update', evt => {
        connect.sendUpdates(doc, evt.detail);
    });

    // connect server events
    connect.addEventListener('load', evt => {
        editor.loadDocument(evt.detail);
    });

    // open the first document
    connect.addEventListener('open', evt => {
        connect.loadDocument(doc);
    });
}
