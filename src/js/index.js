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
        });

        // connect real events
        this.ws.addEventListener('message', evt => {
            console.log(`received: ${evt.data}`);
            let {cmd, data} = JSON.parse(evt.data);
            if (cmd == 'init') {
                this.dispatchEvent(
                    new CustomEvent('init', {detail: data})
                );
            }
        });
    }

    update(chg) {
        if (this.ws.readyState) {
            this.ws.send(JSON.stringify({
                cmd: 'update', data: chg.toJSON()
            }));
        }
    }
}

function initSpirit() {
    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');

    // resize panels
    enableResize(left, right, mid);

    // make the actual editor
    let editor = new SpiritEditor(left, right);
    let connect = new Connection('ws://localhost:8000');

    // connect editor events
    editor.addEventListener('update', evt => {
        connect.update(evt.detail);
    });

    // connect server events
    connect.addEventListener('init', evt => {
        editor.initialize(evt.detail);
    });
}
