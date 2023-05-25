// spirit index

import fs from 'fs'
import path from 'path'
import url from 'url'
import { parseDocument, Context } from './src/js/markum.js'

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const store = path.join(__dirname, 'store');

// string tools
const regext = e => new RegExp(`\.(?:${e})$`);
const istxt = regext('md');
const isimg = regext('png|jpg|jpeg|gif');

// extract refs from documents
async function parseRefs(doc) {
    // load document source
    let fpath = path.join(store, doc);
    let text = fs.readFileSync(fpath, 'utf8');

    // run refs pass
    let tree = parseDocument(text);
    let ctx = new Context();
    await tree.refs(ctx);

    // parse title inner
    let title = await ctx.title.inner(ctx);

    // collect refs text
    let refs = new Map();
    for (let [k, v] of ctx.refer) {
        refs.set(`${doc}:${k}`, `${title}: ${v}`);
    }

    // collect popup html
    let pops = new Map();
    for (let [k, v] of ctx.popup) {
        pops.set(`${doc}:${k}`, await v.inner(ctx));
    }

    // return results
    return {title, refs, pops};
}

// document index store
class Index {
    constructor(docs) {
        this.docs = new Map();
        this.refs = new Map();
        this.pops = new Map();
    }

    async indexDoc(doc) {
        let {title, refs, pops} = await parseRefs(doc);
        this.docs.set(doc, title);
        for (let [k, v] of refs) {
            this.refs.set(k, v);
        }
        for (let [k, v] of pops) {
            this.pops.set(k, v);
        }
    }

    async indexDocs(docs) {
        await Promise.all(
            docs.map(doc => this.indexDoc(doc))
        );
    }

    unindexDoc(doc) {
        this.docs.delete(doc);
        for (let [k, v] of this.refs) {
            if (v.startsWith(`${doc}: `)) {
                this.refs.delete(k);
            }
        }
        for (let [k, v] of this.pops) {
            if (v.startsWith(`${doc}: `)) {
                this.pops.delete(k);
            }
        }
    }
}

// index entire corpus
async function indexAll() {
    let files = fs.readdirSync(store);
    let txts = files.filter(x => istxt.test(x));
    let imgs = files.filter(x => isimg.test(x));
    let index = new Index();
    await index.indexDocs(txts);
    return index;
}

// print output
let index = await indexAll();
console.log('titles:', index.docs);
console.log('refers:', index.refs);
console.log('popups:', [...index.pops].map(([k, v]) => [k, v.length]));
