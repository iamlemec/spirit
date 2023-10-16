// spirit index

import fs from 'fs'
import path from 'path'
import toml from 'toml'
import { parseDocument, Context } from './markum.js'

export { indexAll }

// config variables
const store = './store';

// string tools
const regext = e => new RegExp(`\.(?:${e})$`);
const istxt = regext('md');
const isimg = regext('png|jpg|jpeg|gif');
const iscit = regext('toml');

// extract refs from documents
async function parseRefs(doc) {
    // load document source
    let fpath = path.join(store, doc);
    let text = fs.readFileSync(fpath, 'utf8');

    // run refs pass
    let tree = parseDocument(text);
    let ctx = new Context();
    await tree.refs(ctx);

    // abort if no title
    if (ctx.title == null) {
        return null;
    }

    // parse title and blurb
    let ttext = await ctx.title.inner(ctx);
    tree.children = tree.children.slice(0, 2);
    let prev = await tree.html(ctx);

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

async function parseCites(cit) {
    let fpath = path.join(store, cit);
    let text = fs.readFileSync(fpath, 'utf8');
    let cites = toml.parse(text);
    return new Map(Object.entries(cites));
}

// document index store
class Index {
    constructor() {
        this.docs = new Map();
        this.refs = new Map();
        this.pops = new Map();
        this.cits = new Map();
    }

    async indexDoc(doc) {
        let info = await parseRefs(doc);
        if (info == null) {
            return;
        }

        // extract info
        let {title, blurb, refs, pops} = info;

        // add in title info
        this.docs.set(doc, title);
        this.refs.set(doc, title);
        this.pops.set(doc, blurb);

        // add in refs and pops
        for (let [k, v] of refs) {
            this.refs.set(`${doc}:${k}`, `${title}: ${v}`);
        }
        for (let [k, v] of pops) {
            this.pops.set(`${doc}:${k}`, v);
        }
    }

    async indexCite(cit) {
        let cites = await parseCites(cit);
        for (let [k, v] of cites) {
            this.cits.set(`${cit}:${k}`, v);
        }
    }

    async indexDocs(docs) {
        await Promise.all(
            docs.map(doc => this.indexDoc(doc))
        );
    }

    async indexCites(cits) {
        await Promise.all(
            cits.map(cit => this.indexCite(cit))
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

    search(query) {
        query = query.toLowerCase();
        let results = [];
        for (let [k, v] of this.docs) {
            let [k1, v1] = [k.toLowerCase(), v.toLowerCase()];
            if (k1.includes(query) || v1.includes(query)) {
                results.push([k, v]);
            }
        }
        return results;
    }
}

// index entire corpus
async function indexAll() {
    // classify files
    let files = fs.readdirSync(store);
    let txts = files.filter(x => istxt.test(x));
    let imgs = files.filter(x => isimg.test(x));
    let cits = files.filter(x => iscit.test(x));

    // index all documents
    let index = new Index();
    await index.indexDocs(txts);
    await index.indexCites(cits);
    console.log(index.docs);

    return index;
}
