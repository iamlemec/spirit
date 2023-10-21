// spirit server

import fs from 'fs';
import path from 'path'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { ChangeSet, Text } from '@codemirror/state'

import { indexAll } from './index.js'
import { Multimap } from './utils.js'
import { exportHtml, exportLatex } from './export.js'

export { serveSpirit }

// global constants
const rate = 10000; // autosave rate (milliseconds)

// check if subdirectory
function getLocalPath(store, name) {
    let fpath = path.join(store, name);
    let rpath = path.relative(store, fpath);
    let local = rpath && !rpath.startsWith('..') && !path.isAbsolute(rpath);
    return local ? fpath : null;
}

// like python splitext
function splitExtension(fname) {
    let ext = path.extname(fname);
    let base = path.basename(fname, ext);
    return [base, ext];
}

// load text file
function loadFile(fpath) {
    if (fs.existsSync(fpath)) {
        return fs.readFileSync(fpath, 'utf8');
    } else {
        return null;
    }
}

// create file
function createFile(fpath) {
    if (fs.existsSync(fpath)) {
        return false;
    } else {
        fs.writeFileSync(fpath, '', 'utf8');
        return true;
    }
}

function sendExists(res, fpath) {
    if (fpath != null) {
        try {
            fs.accessSync(fpath, fs.constants.R_OK);
            res.sendFile(fpath, { root: '.' });
        } catch (err) {
            res.sendStatus(404);
        }
    }
}

function titleFromFilename(fname) {
    let [name, _] = splitExtension(fname);
    return name.split('_')
               .filter(s => s.length > 0)
               .map(s => s.charAt(0).toUpperCase() + s.slice(1))
               .join(' ');
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
            } else if (cmd == 'close') {
                this.dispatchEvent(
                    new Event('close')
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
            } else if (cmd == 'save') {
                this.dispatchEvent(
                    new Event('save')
                )
            } else if (cmd == 'create') {
                this.dispatchEvent(
                    new CustomEvent('create', { detail: doc })
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

    config(conf) {
        this.ws.send(JSON.stringify({
            cmd: 'config', data: conf
        }));
    }

    load(doc, text) {
        this.ws.send(JSON.stringify({
            cmd: 'load', doc, data: text
        }));
    }

    flash(text) {
        this.ws.send(JSON.stringify({
            cmd: 'flash', data: text
        }));
    }

    readonly(val) {
        this.ws.send(JSON.stringify({
            cmd: 'readonly', data: val
        }));
    }

    update(chg) {
        this.ws.send(JSON.stringify({
            cmd: 'update', data: chg.toJSON()
        }));
    }
}

class ClientRouter {
    constructor(store) {
        this.store = store; // store path
        this.docs = new Map(); // document state for fpath
        this.clis = new Multimap(); // groups clients by fpath
        this.abrt = new Map(); // abort controller for client
    }

    // this is trusted: doesn't check for locality or existence
    add(doc, ch) {
        // get full path
        let fpath = getLocalPath(this.store, doc);

        // remove if already present
        if (this.has(ch)) {
            this.del(ch);
        }

        // open document if needed
        if (!this.docs.has(fpath)) {
            this.docs.set(fpath, new DocumentHandler(fpath));
        }
        let dh = this.docs.get(fpath);

        // add client to multimap
        this.clis.add(fpath, ch);

        // hook up event listeners
        let control = new AbortController();
        this.abrt.set(ch, control);
        ch.addEventListener('update', e => {
            let chg = e.detail;
            let [first, ...rest] = this.clis.get(fpath);
            if (ch == first) {
                dh.update(chg);
                for (let cli of rest) {
                    cli.update(chg);
                }
            } else {
                console.log(`got "update" from non-leader`);
            }
        }, { signal: control.signal });
        ch.addEventListener('close', () => {
            this.del(ch);
        }, { signal: control.signal });
        ch.addEventListener('save', () => {
            let first = this.clis.get(fpath).get(0);
            if (ch == first) {
                dh.save();
            } else {
                console.log(`got "save" from non-leader`);
            }
        }, { signal: control.signal });

        // send document to client
        let text = dh.text();
        ch.load(doc, text);

        // set client to read-only
        let ro = this.clis.num(fpath) > 1;
        ch.readonly(ro);
    }

    del(ch) {
        // noop if not present
        if (!this.clis.has(ch)) {
            return;
        }

        // disconnect handlers
        this.abrt.get(ch).abort();
        this.abrt.delete(ch);

        // remove client from multimap
        let idx = this.clis.idx(ch);
        let fpath = this.clis.pop(ch);

        // update connections
        if (this.clis.num(fpath) == 0) {
            // close document
            let dh = this.docs.get(fpath);
            this.docs.delete(fpath);
            dh.close();
        } else if (idx == 0) {
            // set new leader
            let first = this.clis.get(fpath).get(0);
            first.readonly(false);
        }
    }

    has(ch) {
        return this.clis.has(ch);
    }
}

// main entry point
async function serveSpirit(store, host, port, conf) {
    // parse arguments
    conf = conf ?? {};

    // create server objects
    const app = express();
    const server = createServer(app);
    const wss = new WebSocketServer({server});

    // index existing files
    let index = await indexAll(store);
    console.log(`indexed ${index.refs.size} documents in ${store}`);

    // create client router
    let router = new ClientRouter(store);

    // connect websocket
    wss.on('connection', ws => {
        console.log(`connected`);

        // create client handler
        let ch = new ClientHandler(ws);

        // send config info
        ch.config(conf);

        // the client is requesting a document
        ch.addEventListener('load', evt => {
            let doc = evt.detail;

            // ensure path is local
            let fpath = getLocalPath(store, doc);
            if (fpath == null) {
                console.log(`non-local path: ${doc}`);
                ch.flash(`document "${doc}" is non-local`);
                return;
            }

            // ensure path exists
            if (!fs.existsSync(fpath)) {
                console.log(`non-existent path: ${fpath}`);
                ch.flash(`document "${doc}" does not exist`);
                return;
            }

            // connect client to document (handles response)
            router.add(doc, ch);
        });

        // the client is disconnecting
        ch.addEventListener('close', () => {
            router.del(ch);
        });

        // the client is requesting a reindex
        ch.addEventListener('reindex', async () => {
            index = await indexAll(store);
        });

        // the client is requesting a document creation
        ch.addEventListener('create', async evt => {
            let doc = evt.detail;
            console.log(`create: ${doc}`);

            // ensure path is local
            let fpath = getLocalPath(store, doc);
            if (fpath == null) {
                ch.flash(`path "${doc}" is non-local`);
                return;
            }

            // ensure path does not exist
            let created = createFile(fpath);
            if (created) {
                let title = titleFromFilename(doc);
                let text = `#! ${title}\n`;
                fs.writeFileSync(fpath, text, 'utf8');
                index = await indexAll(store);
                router.add(doc, ch);
            } else {
                ch.flash(`path "${doc}" already exists`);
            }
        });
    });

    // set up static paths
    app.use(express.static('.'));

    // connect serve index
    app.get('/', (req, res) => {
        console.log('GET: /', req.query.doc);
        res.sendFile('index.html', { root: '.' });
    });

    // connect serve search
    app.get('/search/:query?', (req, res) => {
        let query = req.params.query ?? '';
        console.log(`GET: /search/${query}`);
        let results = index.search(query);
        res.json(results);
    });

    // connect serve document
    app.get('/:doc', (req, res) => {
        console.log('GET: /doc?=', req.params.doc);
        let doc = req.params.doc;
        res.redirect(`/?doc=${doc}`);
    });

    // connect serve text
    app.get('/md/:doc', (req, res) => {
        let doc = req.params.doc;
        console.log(`GET: /md/${doc}`);
        let fpath = getLocalPath(store, doc);
        sendExists(res, fpath);
    });

    // connect serve html
    app.get('/html/:doc', async (req, res) => {
        let doc = req.params.doc;
        console.log(`GET: /html/${doc}`);
        let fpath = getLocalPath(store, doc);
        if (fpath != null) {
            let src = loadFile(fpath);
            let html = await exportHtml(src);
            res.set('Content-Type', 'text/html');
            res.send(html);
        }
    });

    // connect serve html
    app.get('/latex/:doc', async (req, res) => {
        let doc = req.params.doc;
        console.log(`GET: /latex/${doc}`);
        let [name, _] = splitExtension(doc);
        let fpath = getLocalPath(store, doc);
        if (fpath != null) {
            let src = loadFile(fpath);
            let latex = await exportLatex(src);
            res.set('Content-Type', 'application/x-latex');
            res.set('Content-Disposition', `attachment; filename="${name}.tex"`);
            res.send(latex);
        }
    });

    // connect serve image
    app.get('/img/:img', (req, res) => {
        let img = req.params.img;
        console.log(`GET: /img/${img}`);
        let fpath = getLocalPath(store, img);
        sendExists(res, fpath);
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

    // connect serve citation
    app.get('/cit/:cit', (req, res) => {
        let cit = req.params.cit;
        console.log(`GET: /cit/${cit}`);
        if (index.cits.has(cit)) {
            res.send(index.cits.get(cit));
        } else {
            res.sendStatus(404);
        }
    });

    // start http server
    console.log(`serving on: http://${host}:${port}`);
    server.listen(port, host);
}
