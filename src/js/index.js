// spirit index

import fs from 'fs'
import path from 'path'
import toml from 'toml'
import { parseDocument, Context } from './markum.js'
import { sum, shard } from './utils.js'

export { indexAll }

// config variables
const store = './store';

// string tools
const regext = e => new RegExp(`\.(?:${e})$`);
const istxt = regext('md');
const isimg = regext('png|jpg|jpeg|gif');
const iscit = regext('toml');

// string sharder
function shard_string(txt, n) {
    let str = txt.toLowerCase();
    let shd = shard([...str], n);
    return shd.map(sh => sh.join(''));
}

// extract refs from documents
async function parseDoc(doc) {
    // load document source
    let fpath = path.join(store, doc);
    let text = fs.readFileSync(fpath, 'utf8');

    // run refs pass
    let tree = parseDocument(text);
    let ctx = new Context();
    await tree.refs(ctx);
    let refs = ctx.refer;

    // abort if no title
    if (ctx.title == null) {
        return null;
    }
    let title = await ctx.title.inner(ctx);

    // parse popups
    let pops = new Map([...ctx.popup].map(
        async ([k, v]) => [k, await v.html(ctx)]
    ));

    // parse paragraphs
    let para = text.split('\n\n').map(p => p.trim());

    // parse blurb (destructive)
    tree.children = tree.children.slice(0, 2);
    let blurb = await tree.html(ctx);

    // return results
    return { title, blurb, refs, pops, para };
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
        this.shrd = new Map();
        this.refs = new Map();
        this.pops = new Map();
        this.cits = new Map();
    }

    async indexDoc(doc) {
        let info = await parseDoc(doc);
        if (info == null) {
            return;
        }

        // extract info
        let { title, blurb, refs, pops, para } = info;

        // add in title refs
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

        // index full text by para
        let shrd = para.map(p => new Set(shard_string(p, 3)));
        this.shrd.set(doc, shrd);
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
        // prepare query
        query = query.toLowerCase();
        let shard = new Set(shard_string(query, 3));

        // search by title
        let title = new Set();
        for (let [k, v] of this.docs) {
            let [k1, v1] = [k.toLowerCase(), v.toLowerCase()];
            if (k1.includes(query) || v1.includes(query)) {
                title.add(k);
            }
        }

        // search by text
        let docs = new Map();
        for (let [k, v] of this.shrd) {
            let n = sum(v.map(sh => sh.intersection(shard).size));
            if (n > 0) { docs.set(k, n); }
        }

        // sort by score and remove title matches
        let body = new Set([...docs]
            .sort(([d1, n1], [d2, n2]) => n2 - n1)
            .map(([k, v]) => k)
        ).difference(title);

        // generate results
        return [...title, ...body].map(k => [k, this.docs.get(k)]);
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
