// spirit server

import fs from 'fs';
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import {ChangeSet, Text} from '@codemirror/state'

import { indexAll } from './index.js'

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
                fs.writeFileSync(this.fpath, text, 'utf8');
            }
        }
    }
}

// index existing files
let index = await indexAll();
console.log(index.docs);

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
    handler.addEventListener('reindex', async () => {
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
