// spirit server

import fs from 'fs'
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
        createFile(fpath);
    }
    return text;
}

// connect websocket
wss.on('connection', ws => {
    console.log(`connected`);

    // load default document
    let fpath = null;
    let state = Text.of(['']);
    let stale = false;

    // flush update cache
    function saveDocument() {
        if (stale) {
            stale = false;
            if (fpath != null) {
                let text = state.toString();
                console.log(`writing ${fpath} [${text.length} bytes]`);
                fs.writeFileSync(fpath, text, 'utf8');
            }
        }
    }

    // handle incoming messages
    ws.on('message', msg => {
        console.log(`received: ${msg}`);
        let {cmd, doc, data} = JSON.parse(msg);
        if (cmd == 'load') {
            if ((fpath = getLocalPath(doc)) == null) {
                console.log(`non-local path: ${doc}`);
                return;
            }
            let text = loadFile(fpath);
            state = Text.of(text.split('\n'));
            ws.send(JSON.stringify({
                cmd: 'load', data: text
            }));
        } else if (cmd == 'update') {
            let chg = ChangeSet.fromJSON(data);
            state = chg.apply(state);
            stale = true;
        }
    });

    // handle disconnect
    ws.on('close', () => {
        console.log(`disconnected`);
        saveDocument();
    });

    // print out every ten seconds
    setInterval(saveDocument, rate);
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

// start http server
server.listen(port);
