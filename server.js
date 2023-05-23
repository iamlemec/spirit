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

// const heart = '💖';

// config variables
const port = 8000;
const rate = 10000;

// connect websocket
wss.on('connection', ws => {
    console.log(`connected`);

    // load default document
    let state = null;

    // hanlde incoming messages
    ws.on('message', msg => {
        console.log(`received: ${msg}`);
        let {cmd, doc, data} = JSON.parse(msg);
        if (cmd == 'load') {
            let test = path.join(__dirname, 'store', doc);
            let text = fs.readFileSync(test, 'utf8').trim();
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

    // print out every ten seconds
    let stale = false;
    setInterval(() => {
        if (stale) {
            console.log(state.toString());
            stale = false;
        }
    }, rate);
});

// set up static paths
let dist = path.join(__dirname, 'dist');
app.use(express.static(dist));

// connect serve index
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// start http server
server.listen(port);
