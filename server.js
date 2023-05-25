// spirit server

import { openSync, closeSync, readFileSync, writeFileSync } from 'fs';
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import {ChangeSet, Text} from '@codemirror/state'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({server});

// config variables
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
    let file = openSync(fpath, 'w');
    closeSync(file);
}

// load text file
function loadFile(fpath) {
    let text = '';
    try {
        text = readFileSync(fpath, 'utf8');
        console.log(`loading file: ${fpath}`);
    } catch (err) {
        console.log(`creating file: ${fpath}`);
        createFile(fpath);
    }
    return text;
}

// self-contained client handler
class ClientHandler extends EventTarget {
    constructor(ws) {
        super();
        this.ws = ws;

        // initialize state
        this.fpath = null;
        this.state = Text.of(['']);
        this.taint = false;

        // handle incoming messages
        ws.on('message', msg => {
            console.log(`received: ${msg}`);
            let {cmd, doc, data} = JSON.parse(msg);
            if (cmd == 'load') {
                if ((this.fpath = getLocalPath(doc)) == null) {
                    console.log(`non-local path: ${doc}`);
                } else {
                    this.load(doc);
                }
            } else if (cmd == 'update') {
                let chg = ChangeSet.fromJSON(data);
                this.update(chg);
            }
        });

        // handle closure
        ws.on('close', () => {
            console.log(`disconnected`);
            clearInterval(this.timer);
            this.save();
            this.dispatchEvent(
                new Event('close')
            );
        });

        // set up autosave
        this.timer = setInterval(() => {
            this.save();
        }, rate);
    }

    load(doc) {
        let text = loadFile(this.fpath);
        this.state = Text.of(text.split('\n'));
        this.ws.send(JSON.stringify({
            cmd: 'load', data: text
        }));
    }

    update(chg) {
        this.state = chg.apply(this.state);
        this.stale = true;
    }

    save() {
        if (this.stale) {
            this.stale = false;
            if (this.fpath != null) {
                let text = this.state.toString();
                console.log(`writing ${this.fpath} [${text.length} bytes]`);
                writeFileSync(this.fpath, text, 'utf8');
            }
        }
    }
}

// set up client map
let clients = new Map();

// connect websocket
wss.on('connection', ws => {
    console.log(`connected`);
    let handler = new ClientHandler(ws);
    clients.set(ws, handler);
    handler.addEventListener('close', () => {
        clients.delete(ws);
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

// connect serve image
app.get('/img/:img', (req, res) => {
    let img = req.params.img;
    let ipath = getLocalPath(img);
    if (ipath != null) {
        res.sendFile(ipath);
    }
});

// start http server
server.listen(port);
