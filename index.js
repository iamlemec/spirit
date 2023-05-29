// spirit index

import fs from 'fs'
import path from 'path'
import url from 'url'
import { parseDocument, Context } from './src/js/markum.js'

export { indexAll }

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

    // parse title and blurb
    let ttext = await ctx.title.inner(ctx);
    tree.children = tree.children.slice(0, 2);
    let prev = await tree.html();

    // parse popups
    for (let [k, v] of ctx.popup) {
        ctx.popup.set(k, await v.html(ctx));
    }

    // return results
    return {
        title: ttext, blurb: prev,
        refs: ctx.refer, pops: ctx.popup
    };
}

// document index store
class Index {
    constructor(docs) {
        this.refs = new Map();
        this.pops = new Map();
    }

    async indexDoc(doc) {
        let {title, blurb, refs, pops} = await parseRefs(doc);
        this.refs.set(doc, title);
        this.pops.set(doc, blurb);
        for (let [k, v] of refs) {
            this.refs.set(`${doc}:${k}`, `${title}: ${v}`);
        }
        for (let [k, v] of pops) {
            this.pops.set(`${doc}:${k}`, v);
        }
    }

    async indexDocs(docs) {
        await Promise.all(
            docs.map(doc => this.indexDoc(doc))
        );
    }

    unindexDoc(doc) {
        for (let [k, v] of this.refs) {
            if (v.startsWith(`${doc}#`)) {
                this.refs.delete(k);
            }
        }
        for (let [k, v] of this.pops) {
            if (v.startsWith(`${doc}#`)) {
                this.pops.delete(k);
            }
        }
    }
}

// index entire corpus
async function indexAll() {
    console.log('indexing all files');
    let files = fs.readdirSync(store);
    let txts = files.filter(x => istxt.test(x));
    let imgs = files.filter(x => isimg.test(x));
    let index = new Index();
    await index.indexDocs(txts);
    return index;
}
