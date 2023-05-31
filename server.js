// spirit server

import fs from 'fs';
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import {ChangeSet, Text} from '@codemirror/state'

import { indexAll } from './index.js'
import { Multimap } from './src/js/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({server});

// config variables
const addr = 'localhost';
const port = 8000;
const rate = 10000;
const store = path.join(__dirname, 'store');

// check if subdirectory
function getLocalPath(name) {
    let fpath = path.join(store, name);
    let rpath = path.relative(store, fpath);
    let local = rpath && !rpath.startsWith('..') && !path.isAbsolute(rpath);
    return local ? fpath : null;
}

// create an empty file
function createFile(fpath) {
    let file = fs.openSync(fpath, 'w');
    fs.closeSync(file);
}

// load text file
function loadFile(fpath) {
    let text = '';
    try {
        text = fs.readFileSync(fpath, 'utf8');
        console.log(`loading file: ${fpath}`);
    } catch (err) {
        console.log(`creating file: ${fpath}`);
        fs.createFile(fpath);
    }
    return text;
}

function sendExists(res, fpath) {
    fpath = getLocalPath(fpath);
    if (fpath != null) {
        try {
            fs.accessSync(fpath, fs.constants.R_OK);
            res.sendFile(fpath);
        } catch {
            res.sendStatus(404);
        }
    }
}

class DocumentHandler extends EventTarget {
    constructor(fpath) {
        super();
        this.fpath = fpath;

        // track clients
        this.clients = new Set();

        // handle auto-save
        this.taint = false;
        this.timer = setInterval(() => {
            this.save();
        }, rate);

        // load document
        let text = loadFile(this.fpath);
        this.state = Text.of(text.split('\n'));
    }

    update(chg) {
        this.state = chg.apply(this.state);
        this.taint = true;
    }

    save() {
        if (this.taint) {
            this.taint = false;
            let text = this.state.toString();
            console.log(`writing ${this.fpath} [${text.length} bytes]`);
            fs.writeFileSync(this.fpath, text, 'utf8');
        }
    }

    close() {
        clearInterval(this.timer);
        this.save();
        this.dispatchEvent(
            new Event('close')
        );
    }

    text() {
        return this.state.toString();
    }
}

// self-contained client handler
// emits: load, update, close, reindex
class ClientHandler extends EventTarget {
    constructor(ws) {
        super();
        this.ws = ws;

        // handle incoming messages
        ws.on('message', msg => {
            console.log(`received: ${msg}`);
            let {cmd, doc, data} = JSON.parse(msg);
            if (cmd == 'load') {
                this.dispatchEvent(
                    new CustomEvent('load', { detail: doc })
                );
            } else if (cmd == 'update') {
                let chg = ChangeSet.fromJSON(data);
                this.dispatchEvent(
                    new CustomEvent('update', { detail: chg })
                );
            } else if (cmd == 'reindex') {
                this.dispatchEvent(
                    new Event('reindex')
                );
            } else {
                console.log(`unknown command: ${cmd}`);
            }
        });

        // handle closure
        ws.on('close', () => {
            console.log(`disconnected`);
            this.dispatchEvent(
                new Event('close')
            );
        });
    }

    load(text) {
        this.ws.send(JSON.stringify({
            cmd: 'load', data: text
        }));
    }
}

// index existing files
let index = await indexAll();
console.log(index.docs);

// set up client map
let docs = new Map();
let clis = new Multimap();

// connect websocket
wss.on('connection', ws => {
    console.log(`connected`);
    let ch = new ClientHandler(ws);

    // real action starts on load
    ch.addEventListener('load', evt => {
        let doc = evt.detail;

        // ensure path is local
        let fpath = getLocalPath(doc);
        if (fpath == null) {
            console.log(`non-local path: ${doc}`);
            return;
        }

        // open document if needed
        if (!docs.has(fpath)) {
            docs.set(fpath, new DocumentHandler(fpath));
        }
        let dh = docs.get(fpath);

        // add client to multimap
        clis.add(fpath, ch);

        // hook up event listeners
        let control = new AbortController();
        ch.addEventListener('update', e => {
            let chg = e.detail;
            dh.update(chg);
        }, { signal: control.signal });
        ch.addEventListener('close', e => {
            clis.pop(ch);
            control.abort();
            if (clis.num(fpath) == 0) {
                dh.close();
                docs.delete(fpath);
            }
        }, { signal: control.signal });

        // send document to client
        let text = dh.text();
        ch.load(text);
    });

    // reindex on request
    ch.addEventListener('reindex', async () => {
        index = await indexAll();
    });
});

// set up static paths
app.use(express.static(__dirname));

// connect serve index
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// connect serve document
app.get('/:doc', (req, res) => {
    let doc = req.params.doc;
    res.redirect(`/?doc=${doc}`);
});

// connect serve text
app.get('/txt/:txt', (req, res) => {
    let txt = req.params.txt;
    sendExists(res, txt);
});

// connect serve image
app.get('/img/:img', (req, res) => {
    let img = req.params.img;
    sendExists(res, img);
});

// connect serve reference
app.get('/ref/:ref', (req, res) => {
    let ref = req.params.ref;
    console.log(`GET: /ref/${ref}`);
    if (index.refs.has(ref)) {
        res.send(index.refs.get(ref));
    } else {
        res.sendStatus(404);
    }
});

// connect serve popup
app.get('/pop/:pop', (req, res) => {
    let pop = req.params.pop;
    console.log(`GET: /pop/${pop}`);
    if (index.pops.has(pop)) {
        res.send(index.pops.get(pop));
    } else {
        res.sendStatus(404);
    }
});

// start http server
console.log(`serving on: http://${addr}:${port}`);
server.listen(port, addr);
