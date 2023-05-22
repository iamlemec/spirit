// spirit server

import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import {ChangeSet, Text} from "@codemirror/state"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({server});

// default document
let text = `
#! Hello World!

Here is some inline math: $x^3$. Here is a block equation:

$$ [eq] \\sqrt{\\pi} = \\int_0^1 \\exp(-x^2) dx

And now we reference it @[eq].

!gum [width=70|id=gum|caption=Ride the Snake]
let sqr = x => Rotate(Square(), r2d*x, {invar: true});
let boxes = SymPoints({fy: sin, fs: sqr, size: 0.4, xlim: [0, 2*pi], N: 150});
return Graph(boxes, {ylim: [-1.6, 1.6]});

Now we can reference this figure too @[gum].
`.trim();

// track document
let doc = Text.of(text.split('\n'));

// print out every ten seconds
let stale = false;
setInterval(() => {
    if (stale) {
        console.log(doc.toString());
        stale = false;
    }
}, 10000);

// connect websocket
wss.on('connection', ws => {
    console.log('connected');

    ws.on('message', msg => {
        console.log(`received: ${msg}`);
        let {cmd, data} = JSON.parse(msg);
        if (cmd == 'update') {
            let chg = ChangeSet.fromJSON(data);
            doc = chg.apply(doc);
            stale = true;
        }
    });
 
    ws.send(JSON.stringify({
        cmd: 'init', data: text
    }));
});

// set up static paths
let dist = path.join(__dirname, 'dist');
app.use(express.static(dist));

// connect serve index
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// start http server
server.listen(8000);
