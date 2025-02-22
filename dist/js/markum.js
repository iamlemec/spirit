import katex from '../node_modules/katex/dist/katex.js';
import { props_repr, parseGum, SVG, Element as Element$1, zip } from '../gum.js/js/gum.js';
import { emoji_table } from '../gum.js/js/emoji.js';
import { DefaultCounter } from './utils.js';

/**
 *
 * a markdown+ to syntax tree parser
 * based on marked - https://github.com/chjj/marked
 *
 */


/**
 * Helper Functions
 */

 function escape_html(html, encode) {
    return html
        .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
        .replace(/%/g, '&#37;');
}

let acc_dict = {
    '`': {'name': 'grave', 'allowed': ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']},
    "'": {'name': 'acute', 'allowed': ['a', 'e', 'i', 'o', 'u', 'y', 'A', 'E', 'I', 'O', 'U', 'Y']},
    '^': {'name': 'circ', 'allowed': ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']},
    '"': {'name': 'uml', 'allowed': ['a', 'e', 'i', 'o', 'u', 'y', 'A', 'E', 'I', 'O', 'U', 'Y']},
    '~': {'name': 'tilde', 'allowed': ['a', 'n', 'o', 'A', 'N', 'O']},
};

function special(acc, letter) {
    if (acc in acc_dict) {
        let spec = acc_dict[acc];
        if (spec.allowed.includes(letter)) {
            return `&${letter}${spec.name};`
        }
    }
    return letter;
}

function replace(regex, opt) {
    regex = regex.source;
    opt = opt || '';
    return function self(name, val) {
        if (!name) return new RegExp(regex, opt);
        val = val.source || val;
        val = val.replace(/(^|[^\[])\^/g, '$1');
        regex = regex.replace(name, val);
        return self;
    };
}

function ensureArray(x) {
    return Array.isArray(x) ? x : [x];
}

/**
 * High-level render
 */

async function renderMarkdown(src, extern, macros) {
    let html;
    try {
        let tree = parseDocument(src);
        let ctx = new Context({extern, macros});
        await tree.refs(ctx);
        html = await tree.html(ctx);
    } catch (e) {
        html = new ErrorMessage(e);
    }
    return html;
}

/**
 * Block Regex
 */

let block = {
    empty: /^(\s*)$/,
    comment: /^\/\/ ?/,
    hrule: /^([-*_]){3,}\s*$/,
    heading: /^(#{1,6})(\*?) *(?:refargs)? *([^\n]+?)$/,
    lheading: /^([^\n]+)\n *(=|-){2,}\s*$/,
    blockquote: /^q*>\s*\n?/,
    code: /^``(\*)? *(?:refargs)?(?:\n)?(?: |\n)?/,
    equation: /^\$\$(\*&|&\*|\*|&)? *(?:refargs)?\s*/,
    title: /^#\! *(?:refargs)?\s*([^\n]*)\s*/,
    figure: /^\!([a-z]*)?(\*)? *(?:refargs)?\s*/,
    upload: /^\!\!(gum)? *(?:refargs)?\s*$/,
    envbeg: /^\>\>(\!|\*|\!\*|\*\!)? *([\w-]+) *(?:refargs)?\s*/,
    envend: /^\<\<\s*/,
    list: /^((?: *(?:bull) [^\n]*(?:\n|$))+)\s*$/,
    table: /^((?: *\|[^\n]+\| *(?:\n|$))+)\s*$/,
};

block._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;
block._refargs = /(?:\[((?:[^\]]|(?<=\\)\])*)\])/;
block._bull = /(?:[*+-]|\d+\.)/;
block._item = /^( *)(bull) ?/;

block.figure = replace(block.figure)
    ('refargs', block._refargs)
    ();

block.upload = replace(block.upload)
    ('refargs', block._refargs)
    ();

block.heading = replace(block.heading)
    ('refargs', block._refargs)
    ();

block.equation = replace(block.equation)
    ('refargs', block._refargs)
    ();

block.code = replace(block.code)
    ('refargs', block._refargs)
    ();

block.title = replace(block.title)
    ('refargs', block._refargs)
    ();

block.envbeg = replace(block.envbeg)
    ('refargs', block._refargs)
    ();

block.list = replace(block.list)
    (/bull/g, block._bull)
    ();

block._item = replace(block._item)
    ('bull', block._bull)
    ();

/**
 * Inline Regex
 */

let inline = {
    special: /^(?<!\\)\\([\`\"\^\~])\{([A-z])\}/,
    escape: /^\\([\\/`*{}\[\]()#+\-.!_>\$%&])/,
    in_comment: /^\/\/([^\n]*?)(?:\n|$)/,
    autolink: /^<([^ >]+:\/[^ >]+)>/,
    url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    link: /^(!?)\[(inside)\]\(href\)/,
    hash: /^#(\[[\w| ]+\]|\w+)/,
    ilink: /^\[\[([^\]]+)\]\]/,
    strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
    em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
    code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    br: /^ *\n/,
    del: /^~~(?=\S)([\s\S]*?\S)~~/,
    text: /^[\s\S]+?(?=[\/\\<!\[_*`\$\^@#~:]|https?:\/\/| *\n|$)/,
    math: /^\$((?:\\\$|[\s\S])+?)\$/,
    refcite: /^(@{1,2})\[([^\]]+)\]/,
    footnote: /^\^(\!)?\[(inside)\]/,
    emoji: /^:([a-zA-Z0-9_+-]+):/,
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
    ('inside', inline._inside)
    ('href', inline._href)
    ();

inline.footnote = replace(inline.footnote)
    ('inside', inline._inside)
    ();

/**
 * Document Parser
 */

function parseBlockRobust(src) {
    try {
        return parseBlock(src);
    } catch (err) {
        console.log(err);
        return new ErrorMessage(err.message);
    }
}

function parseDocument(src, args) {
    let blocks = src.trim().split(/\n{2,}/).map(parseBlockRobust);
    blocks = blocks.map(b => new Block(b));
    return new Document(blocks, args);
}

/**
 * Block Parser
 */

// block prefix parser
function parsePrefix(pre) {
    return (pre ?? '').split('');
}

// variable argument parser (inside []'s)
function parseArgs(argsraw) {
    if (argsraw == null) {
        return {};
    }

    let fst;
    let args = {};
    let rx = /[^a-zA-Z\d\_\-\.\:]/;

    // using lookbehinds, might not work on old browsers.
    argsraw.split(/(?<!\\)\||\n/)
           .map(x => x.split(/(?<!\\)\=/))
           .filter(x => x.length > 1)
           .forEach(x => {
                let [val, ...keys] = x.reverse();
                keys.forEach(key => {
                    if (!rx.test(key)) {
                        args[key] = val.replace(/\\(\=|\|)/g, '$1');
                    }
                });
            });

    if (!('id' in args)) {
        fst = argsraw.split(/(?<!\\)\||\n/)[0];
        if (!rx.test(fst)) {
            args['id'] = fst;
        }
    } else {
        if (rx.test(args['id'])) { // cannot have chars in id
            delete args['id'];
        }
    }

    return args;
}

function parseList(src) {
    let items = src
        .split('\n')
        .filter(x => x.length > 0);

    let ordered = true;
    let rows = items.map(item => {
        let [mat, _, bull] = block._item.exec(item);
        ordered &&= bull.length > 1;
        return item.slice(mat.length);
    });

    let body = rows.map(parseInline);

    return new List(body, {ordered});
}

function parseAlign(a) {
    if (/^ *-+: *$/.test(a)) {
        return 'right';
    } else if (/^ *:-+: *$/.test(a)) {
        return 'center';
    } else if (/^ *:-+ *$/.test(a)) {
        return 'left';
    } else {
        return null;
    }
}

function splitCells(row) {
    return row.replace(/^ *\| *| *\| *$/g, '').split(/ *\| */);
}

// this only passes align info to top level table
function parseTable(source, args) {
    let [header, align0, ...cells] = source.trim().split('\n').map(splitCells);

    // parse cells
    let align = align0.map(parseAlign);
    let head = header.map(parseInline);
    let body = cells.map(r => r.map(parseInline));

    // return table
    return new Table(head, body, {align, ...args});
}

// parse a block of text — usually main entry point
function parseBlock(src) {
    src = src
        .replace(/\r\n|\r/g, '\n') // DOS newlines
        .replace(/\t/g, '    ') // tab (4 spaces)
        .replace(/\u00a0/g, ' ') // non-breaking space
        .replace(/\u2424/g, '\n') // newline symbol
        .replace(/^ +$/gm, ''); // empty lines

    let cap;

    // empty cell (all whitespace)
    if (cap = block.empty.exec(src)) {
        let [_, text] = cap;
        parseInline(text);
        return new Block([]);
    }

    // equation
    if (cap = block.equation.exec(src)) {
        let [mat, pargs, rargs] = cap;
        pargs = parsePrefix(pargs);
        let args = {
            number: !pargs.includes('*'),
            multiline: pargs.includes('&'),
            ...parseArgs(rargs)
        };
        let text = src.slice(mat.length);
        return new Equation(text, args);
    }

    // upload
    if (cap = block.upload.exec(src)) {
        let [_, pargs, rargs] = cap;
        let args = {
            gum: pargs == 'gum',
            ...parseArgs(rargs)
        };
        return new Upload(id, args);
    }
    
    // figure: image/video/figure/table
    if (cap = block.figure.exec(src)) {
        let [mat, tag, pargs, rargs] = cap;
        tag = tag ?? 'fig';
        pargs = parsePrefix(pargs);
        let number = !pargs.includes('*');
        let {id, caption, title, ...args} = parseArgs(rargs);
        caption = parseInline(caption);
        let body = src.slice(mat.length);
        let child, ftype = 'figure', hidden = false;
        if (tag == 'fig') {
            let children = parseInline(body);
            child = new Div(children);
        } else if (tag == 'tab') {
            ftype = 'table';
            try {
                child = parseTable(body, args);
            } catch (e) {
                child = new Div(e.message);
            }
        } else if (tag == 'img') {
            let {key, url, ...args1} = args;
            if (key != null) {
                child = new InternalImage(key, args1);
            } else if (url != null) {
                child = new Image(url, args1);
            } else {
                child = new ErrorMessage('No `src` or `key` provided');
            }
        } else if (tag == 'vid') {
            child = new Video(body, args);
        } else if (tag == 'svg') {
            child = new Svg(body, args);
        } else if (tag == 'gum') {
            child = new Gum(body, args);
        } else if (tag == 'lib') {
            child = new GumLib(body);
            hidden = true;
        } else if (tag == 'code') {
            child = new Code(body, args);
        }
        if (hidden) {
            return child;
        } else {
            return new Figure(child, {ftype, id, caption, title, number});
        }
    }

    // comment
    if (cap = block.comment.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        return new Comment(text);
    }

    // code
    if (cap = block.code.exec(src)) {
        let [mat, pargs, rargs] = cap;
        pargs = parsePrefix(pargs);
        let args = parseArgs(rargs);
        let text = src.slice(mat.length);
        return new Code(text, args);
    }

    // title
    if (cap = block.title.exec(src)) {
        let [mat, rargs, text] = cap;
        let args = parseArgs(rargs);
        let title = parseInline(text);
        return new Title(title, args);
    }

    // heading
    if (cap = block.heading.exec(src)) {
        let [mat, hash, pargs, rargs, body] = cap;
        pargs = parsePrefix(pargs);
        let level = hash.length;
        let text = parseInline(body);
        let args = {
            number: !pargs.includes('*'),
            ...parseArgs(rargs)
        };
        return new Heading(level, text, args);
    }

    // envbeg
    if (cap = block.envbeg.exec(src)) {
        let [mat, pargs, env, rargs] = cap;
        let cls = pargs.includes('!') ? EnvSingle : EnvBegin;
        let args = {
            number: !pargs.includes('*'),
            ...parseArgs(rargs)
        };
        let text = src.slice(mat.length);
        let inner = parseInline(text);
        return new cls(inner, args);
    }

    // envend
    if (cap = block.envend.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        let inner = parseInline(text);
        return new EnvEnd(inner);
    }

    // lheading
    if (cap = block.lheading.exec(src)) {
        let [_, body, bar] = cap;
        let text = parseInline(body);
        let depth = (bar == '=') ? 1 : 2;
        return new Heading(depth, text);
    }

    // hrule
    if (cap = block.hrule.exec(src)) {
        return new Rule();
    }

    // blockquote
    if (cap = block.blockquote.exec(src)) {
        let [mat] = cap;
        let text = src.slice(mat.length);
        return new Blockquote(text);
    }

    // list
    if (cap = block.list.exec(src)) {
        let [mat] = cap;
        return parseList(mat);
    }

    // table
    if (cap = block.table.exec(src)) {
        let [mat] = cap;
        let tab = parseTable(mat);
        return new TableWrapper(tab, {});
    }

    // top-level paragraph (fallback)
    return parseInline(src);
}

/**
 * Inline Parser
 */

// parse markdown into list of `Element`s
function parseInline(src) {
    if (src == null) {
        return null;
    }

    let cap, out = [];
    while (src) {
        // detect empty early
        if (src.length == 0) {
            break;
        }

        // special
        if (cap = inline.special.exec(src)) {
            let [mat, acc, letter] = cap;
            out.push(new Special(acc, letter));
            src = src.substring(mat.length);
            continue;
        }

        // escape
        if (cap = inline.escape.exec(src)) {
            let [mat, esc] = cap;
            out.push(new Escape(esc));
            src = src.substring(mat.length);
            continue;
        }

        // math
        if (cap = inline.math.exec(src)) {
            let [mat, tex] = cap;
            out.push(new Math(tex));
            src = src.substring(mat.length);
            continue;
        }

        // comment
        if (cap = inline.in_comment.exec(src)) {
            let [mat, text] = cap;
            out.push(new Comment(text));
            src = src.substring(mat.length);
            continue;
        }

        // ref/cite
        if (cap = inline.refcite.exec(src)) {
            let [mat, pre, rargs] = cap;
            let cls = (pre == '@') ? Reference : Citation;
            let {id, ...args} = parseArgs(rargs);
            out.push(new cls(id, args));
            src = src.substring(mat.length);
            continue;
        }

        // footnote/sidenote
        if (cap = inline.footnote.exec(src)) {
            let [mat, pre, text] = cap;
            let cls = (pre == '!') ? Sidenote : Footnote;
            let inner = parseInline(text);
            out.push(new cls(inner));
            src = src.substring(mat.length);
            continue;
        }

        // external link
        if (cap = inline.ilink.exec(src)) {
            let [mat, rargs] = cap;
            let {id, ...args} = parseArgs(rargs);
            out.push(new ExtRef(id, args));
            src = src.substring(mat.length);
            continue;
        }

        // autolink
        if (cap = inline.autolink.exec(src)) {
            let [mat, href] = cap;
            out.push(new Link(href));
            src = src.substring(mat.length);
            continue;
        }

        // url (gfm)
        if (cap = inline.url.exec(src)) {
            let [mat, href] = cap;
            out.push(new Link(href));
            src = src.substring(mat.length);
            continue;
        }

        // link
        if (cap = inline.link.exec(src)) {
            let [mat, pre, text, href] = cap;
            let elem;
            if (pre == '!') {
                elem = new Image(href, text);
            } else {
                let inner = parseInline(text);
                elem = new Link(href, inner);
            }
            out.push(elem);
            src = src.substring(mat.length);
            continue;
        }

        // strong
        if (cap = inline.strong.exec(src)) {
            let [mat, text1, text2] = cap;
            let text = text1 || text2;
            let inner = parseInline(text);
            out.push(new Bold(inner));
            src = src.substring(mat.length);
            continue;
        }

        // hash
        if (cap = inline.hash.exec(src)) {
            let [mat, text] = cap;
            let tag = text.replace('[', '').replace(']', '');
            out.push(new Hash(tag));
            src = src.substring(mat.length);
            continue;
        }

        // em
        if (cap = inline.em.exec(src)) {
            let [mat, text1, text2] = cap;
            let text = text1 || text2;
            let inner = parseInline(text);
            out.push(new Italic(inner));
            src = src.substring(mat.length);
            continue;
        }

        // code
        if (cap = inline.code.exec(src)) {
            let [mat, delim, text] = cap;
            out.push(new Monospace(text));
            src = src.substring(mat.length);
            continue;
        }

        // del (gfm)
        if (cap = inline.del.exec(src)) {
            let [mat, text] = cap;
            let inner = parseInline(text);
            out.push(new Strikeout(inner));
            src = src.substring(mat.length);
            continue;
        }

        // emoji
        if (cap = inline.emoji.exec(src)) {
            let [mat, text] = cap;
            out.push(new Emoji(text));
            src = src.substring(mat.length);
            continue;
        }

        // br
        if (cap = inline.br.exec(src)) {
            let [mat] = cap;
            out.push(new Newline());
            src = src.substring(mat.length);
            continue;
        }
        
        // text
        if (cap = inline.text.exec(src)) {
            let [mat] = cap;
            out.push(mat);
            src = src.substring(mat.length);
            continue;
        }

        if (src.length > 0) {
            throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
        }
    }

    return out;
}

/**
 * Render Tools
 */

// capitalize first letter of string
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// merge attributes accounting for lists
function mergeAttr(...args) {
    let classes0 = args.filter(a => 'class' in a).map(x => x['class']);
    let classes = classes0.join(' ').split(/ +/).join(' ');
    let attrs = Object.assign({}, ...args);
    attrs['class'] = classes;
    return attrs;
}

/**
 * Core Elements
 */

class Context {
    constructor(args) {
        let {extern, macros} = args ?? {};

        // parsing resources
        this.extern = extern ?? null;
        this.macros = macros ?? {};

        // document state
        this.title = null;
        this.count = new DefaultCounter();
        this.refer = new Map();
        this.popup = new Map();
    }

    incNum(key) {
        return this.count.inc(key);
    }

    getNum(key) {
        return this.count.get(key);
    }

    addRef(id, label) {
        this.refer.set(id, label);
    }

    getRef(id) {
        return this.refer.get(id);
    }

    hasRef(id) {
        return this.refer.has(id);
    }

    addPop(id, elem) {
        this.popup.set(id, elem);
    }

    getPop(id) {
        return this.popup.get(id);
    }

    hasPop(id) {
        return this.popup.has(id);
    }

    async getImg(id) {
        if (this.extern != null) {
            return await this.extern.getImg(id);
        } else {
            return null;
        }
    }

    async getExtRef(id) {
        if (this.extern != null) {
            return await this.extern.getRef(id);
        } else {
            return null;
        }
    }

    async getExtPop(id) {
        if (this.extern != null) {
            return await this.extern.getPop(id);
        } else {
            return null;
        }
    }

    async getCit(id) {
        if (this.extern != null) {
            return await this.extern.getCit(id);
        } else {
            return null;
        }
    }
}

class Element {
    constructor(tag, unary, attr) {
        this.tag = tag ?? 'div';
        this.unary = unary ?? false;
        this.attr = attr ?? {};
    }

    async refs(ctx) {
    }

    async props(ctx) {
        return this.attr;
    }

    async inner(ctx) {
        return '';
    }

    async html(ctx) {
        // collect all properties
        let pvals = await this.props(ctx);
        let props = props_repr(pvals);
        let pre = props.length > 0 ? ' ' : '';

        // return final html
        if (this.unary) {
            return `<${this.tag}${pre}${props} />`;
        } else {
            let ivals = await this.inner(ctx);
            return `<${this.tag}${pre}${props}>${ivals}</${this.tag}>`;
        }
    }
}

// be sure to run through children sequentially with await
class Container extends Element {
    constructor(tag, children, args) {
        let {pad, ...attr} = args ?? {};
        super(tag, false, attr);
        this.children = ensureArray(children);
        this.pad = pad ?? '';
    }

    async refs(ctx) {
        for (let c of this.children) {
            if (c instanceof Element) {
                await c.refs(ctx);
            }
        }
    }

    async inner(ctx) {
        let out = [this.pad];
        for (let c of this.children) {
            if (c instanceof Element) {
                out.push(await c.html(ctx));
            } else {
                out.push(c);
            }
            out.push(this.pad);
        }
        return out.join('');
    }
}

class Div extends Container {
    constructor(children, args) {
        super('div', children, args);
    }
}

class Span extends Container {
    constructor(children, args) {
        super('span', children, args);
    }
}

class Block extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'block'});
        super(children, attr1);
    }
}

class Document extends Container {
    constructor(children, args) {
        let {bare, ...attr} = args ?? {};
        let attr1 = {pad: '\n\n', ...attr};
        super('body', children, attr1);
        this.bare = bare ?? true;
    }

    async html(ctx) {
        if (this.bare) {
            return await super.inner(ctx);
        } else {
            return await super.html(ctx);
        }
    }
}

/**
 * gum.js and katex bridges
 */

// contingent upon the idiotic number of possible return types
function renderGum(code, args) {
    let {pixel} = args ?? {};

    // parse into gum tree
    let gum;
    try {
        gum = parseGum(code);
        if (gum instanceof SVG) {
        } else if (gum instanceof Element$1) {
            gum = new SVG(gum, {pixel});
        }
    } catch (err) {
        gum = new Span(err.message, {class: 'gum-error'});
    }

    // render gum tree
    if (gum instanceof Element$1) {
        try {
            return gum.svg();
        } catch (err) {
            return `<span class="gum-error">${err.message}</div>`;
        }    
    } else if (gum instanceof Element) {
        return gum.html();
    } else {
        return gum;
    }
}

class Math extends Element {
    constructor(tex, args) {
        let {display, multiline, ...attr} = args ?? {};
        display = display ?? false;
        multiline = multiline ?? false;

        // set up element
        let tag = display ? 'div' : 'span';
        let attr1 = mergeAttr(attr, {class: 'math'});
        super(tag, false, attr1);

        // store for katex rendering
        this.tex = multiline ? `\\begin{aligned}${tex}\\end{aligned}` : tex;
        this.display = display;
    }

    html(ctx) {
        return katex.renderToString(this.tex, {
            displayMode: this.display, throwOnError: false, macros: ctx.macros
        });
    }
}

/**
 * Numbering
 */

// handles counters for footnotes/equations/figures
class Number extends Element {
    constructor(name, args) {
        let {title, bare, id, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'number'});
        super('span', false, attr1);
        this.name = name;
        this.title = title;
        this.bare = bare ?? true;
        this.id = id;
    }

    refs(ctx) {
        if (this.title == null) {
            this.num = ctx.incNum(this.name);
            this.refer = `${capitalize(this.name)} ${this.num}`;
        } else {
            this.refer = this.title;
        }
        if (this.id != null) {
            ctx.addRef(this.id, this.refer);
        }
    }

    inner(ctx) {
        return this.title ?? (this.bare ? this.num : this.refer);
    }
}

function incrementCounter(ctx, tag, level) {
    let acc = [];
    for (let i = 1; i < level; i++) {
        let num = ctx.getNum(tag) ?? 0;
        acc.push(num);
        tag = `${tag}-${num}`;
    }
    let fin = ctx.incNum(tag);
    acc.push(fin);
    return acc;
}

class NestedNumber extends Element {
    constructor(name, level, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'nested-number'});
        super('span', false, attr1);
        this.name = name;
        this.level = level;
    }

    refs(ctx) {
        let levels = incrementCounter(ctx, this.name, this.level);
        this.num = levels.join('.');
    }

    inner(ctx) {
        return this.num;
    }
}

/* Figures and Equations */

class Caption extends Div {
    constructor(caption, args) {
        let {ftype, title, number, id, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        let children = caption;
        if (number) {
            let counter = new Number(ftype, {title, id, bare: false});
            children.unshift(counter, ': ');
        }
        let attr1 = mergeAttr(attr, {'class': 'caption'});
        super(children, attr1);
        this.ftype = ftype;
        this.number = number;
    }
}

class Figure extends Div {
    constructor(child, args) {
        let {ftype, title, id, number, caption, ...attr} = args ?? {};
        ftype = ftype ?? 'figure';
        caption = (caption != null) ? new Caption(caption, {ftype, title, number, id}) : null;
        let attr1 = mergeAttr(attr, {'class': ftype, id});
        super([child, caption], attr1);
        this.id = id;
        this.ftype = ftype;
        this.number = number;
        this.caption = caption;
    }

    async refs(ctx) {
        await super.refs(ctx);
        if (this.id != null) {
            ctx.addPop(this.id, this);
        }
    }
}

class Equation extends Div {
    constructor(tex, args) {
        let {multiline, number, id, title, ...attr} = args ?? {};
        multiline = multiline ?? false;
        number = number ?? true;

        // set up inner math and optional numbering
        let math = new Math(tex, {multiline, display: true});
        let num = number ? new Number('equation', {title, id}) : null;
        let attr1 = mergeAttr(attr, {class: 'equation', id});
        super([math, num], attr1);

        // store for ref/pop and latex render
        this.id = id;
        this.tex = tex;
        this.number = number;
        this.math = math;
    }

    refs(ctx) {
        super.refs(ctx);
        if (this.id != null) {
            ctx.addPop(this.id, this.math);
        }
    }
}

/**
 * Inline Renderer
 */

class Text extends Element {
    constructor(text, args) {
        let attr = args ?? {};
        super('span', false, attr);
        this.text = text;
    }

    inner(ctx) {
        return this.text;
    }
}

class ErrorMessage extends Span {
    constructor(message) {
        let etag = new Span('Parse error', {class: 'error-prefix'});
        let emsg = new Span(message, {class: 'error-message'});
        super([etag, ': ', emsg], {class: 'error'});
    }
}

class Special extends Text {
    constructor(acc, letter, args) {
        let attr = args ?? {};
        let text = special(acc, letter);
        let attr1 = mergeAttr(attr, {class: 'special'});
        super(text, attr1);
    }
}

class Escape extends Text {
    constructor(esc, args) {
        let attr = args ?? {};
        let text = escape_html(esc);
        let attr1 = mergeAttr(attr, {class: 'escape'});
        super(text, attr1);
    }
}

class Comment extends Text {
    constructor(comm, args) {
        let attr = args ?? {};
        let text = `// ${comm}`;
        let attr1 = mergeAttr(attr, {class: 'comment'});
        super(text, attr1);
    }
}

class Link extends Container {
    constructor(href, text, args) {
        let attr = args ?? {};
        let children = text ?? href;
        let attr1 = mergeAttr(attr, {href, class: 'link'});
        super('a', children, attr1);
    }
}

class Image extends Element {
    constructor(src, args) {
        let {width, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {src, class: 'image', style: `width: ${width}%`});
        super('img', true, attr1);
    }
}

class Video extends Element {
    constructor(src, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {src, class: 'video'});
        super('video', true, attr1);
    }
}

class Bold extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'bold'});
        super(children, attr1);
    }
}

class Italic extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'italic'});
        super(children, attr1);
    }
}

class Strikeout extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'strikeout'});
        super(children, attr1);
    }
}

class Monospace extends Text {
    constructor(text, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'monospace'});
        super(text, attr1);
    }
}

class Emoji extends Text {
    constructor(text, args) {
        let attr = args ?? {};

        let klass = ['emoji'];
        if (text in emoji_table) {
            text = emoji_table[text];
        } else {
            text = `:${text}:`;
            klass.push('fail');
        }

        let attr1 = mergeAttr(attr, {class: klass.join(' ')});
        super(text, attr1);
    }
}

class Reference extends Element {
    constructor(id, args) {
        let attr = args ?? {};
        super('a', false, attr);
        this.id = id;
    }

    // pull ref/popup from context
    async html(ctx) {
        let targ = null;
        if (!ctx.inPopup && ctx.hasPop(this.id)) {
            // don't recurse
            ctx.inPopup = true;
            let pelem = ctx.getPop(this.id);
            targ = await pelem.html(ctx);
            ctx.inPopup = false;
        }
        if (ctx.hasRef(this.id)) {
            let ref = ctx.getRef(this.id);
            let pop = (targ != null) ? `<div class="popup">${targ}</div>` : '';
            return `<span class="popper"><a href="#${this.id}" class="popover reference">${ref}</a>${pop}</span>`;
        } else {
            return `<a class="reference fail">@${this.id}</a>`;
        }
    }
}

class ExtRef extends Element {
    constructor(id, args) {
        let attr = args ?? {};
        super('a', false, attr);
        this.id = id;
    }

    // pull ref/popup from context
    async html(ctx) {
        let targ = null;
        if (!ctx.inPopup) {
            // don't recurse
            ctx.inPopup = true;
            targ = await ctx.getExtPop(this.id);
            ctx.inPopup = false;
        }
        let ref = await ctx.getExtRef(this.id);
        if (ref != null) {
            let url = this.id.replace(/:/, '#');
            let pop = (targ != null) ? `<div class="popup external">${targ}</div>` : '';
            return `<span class="popper"><a href="/${url}" class="popover reference external">${ref}</a>${pop}</span>`;
        } else {
            return `<a class="reference external fail">[[${this.id}]]</a>`;
        }
    }
}

class Citation extends Element {
    constructor(id, args) {
        let attr = args ?? {};
        super('a', false, attr);
        this.id = id;
    }

    // pull ref/popup from context
    async html(ctx) {
        let cite = await ctx.getCit(this.id);
        if (cite != null) {
            let ptxt = `${cite.title}`;
            let rtxt = `${cite.author} (${cite.year})`;
            let pop = `<div class="popup citation">${ptxt}</div>`;
            return `<span class="popper"><a href="" class="popover reference citation">${rtxt}</a>${pop}</span>`;
        } else {
            return `<a class="reference citation fail">@@${this.id}</a>`;
        }
    }
}

class Popup extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'popup'});
        super(children, attr1);
    }
}

class Sidebar extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'sidebar'});
        super(children, attr1);
    }
}

class Footnote extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let num = new Number('footnote', {class: 'popover'});
        let pop = new Popup(children);
        let attr1 = mergeAttr(attr, {class: 'footnote popper'});
        super([num, pop], attr1);
    }
}

class Sidenote extends Span {
    constructor(children, args) {
        let attr = args ?? {};
        let num = new Number('footnote');
        let pop = new Sidebar(children);
        let attr1 = mergeAttr(attr, {class: 'sidenote'});
        super([num, pop], attr1);
    }
}

class Hash extends Link {
    constructor(tag, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'hash'});
        let href = `#${tag}`;
        super(href, attr1);
    }
}

class Newline extends Element {
    constructor(args) {
        super('br', true, args);
    }
}

class List extends Container {
    constructor(children, args) {
        let {ordered, ...attr} = args ?? {};
        let tag = ordered ? 'ol' : 'ul';
        children = children.map(i => new Container('li', i));
        super(tag, children, attr);
    }
}

function make_cell(cell, align=null, header=false) {
    let tag = header ? 'th' : 'td';
    let style = (align != null) ? `text-align: ${align}` : null;
    return new Container(tag, cell, {style});
}

// this takes a list of header elements, and a list of body elements, and optional align flags
class Table extends Container {
    constructor(head, body, args) {
        let {align, ...attr} = args ?? {};
        head = new Container('thead',
            new Container('tr',
                zip(head, align).map(([c, a]) => make_cell(c, a, true))
            )
        );
        body = new Container('tbody',
            body.map(r => new Container('tr',
                zip(r, align).map(([c, a]) => make_cell(c, a))
            ))
        );
        super('table', [head, body], attr);
        this.align = align;
    }
}

class TableWrapper extends Div {
    constructor(table, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'table'});
        super(table, attr1);
    }
}

/**
 * Block Level Elements
 */

class Title extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'title'});
        super(children, attr1);
    }

    refs(ctx) {
        ctx.title = this;
    }
}

class Heading extends Div {
    constructor(level, children, args) {
        let {number, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: `heading heading-${level}`});
        let num = new NestedNumber('heading', level);
        children = number ? [num, ' ', ...children] : children;
        super(children, attr1);
    }
}

class Rule extends Element {
    constructor(args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'rule'});
        super('hr', true, attr1);
    }
}

class Blockquote extends Div {
    constructor(children, args) {
        let attr = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'blockquote'});
        super(children, attr1);
    }
}

class Code extends Element {
    constructor(code, args) {
        let {lang, ...attr} = args ?? {};
        let klass = (lang != null) ? `code code-${lang}` : 'code';
        let attr1 = mergeAttr(attr, {class: klass});
        super('div', false, attr1);
        this.code = code;
        this.lang = lang ?? null;
    }

    // highlight here
    inner(ctx) {
        return this.code;
    }
}

class Svg extends Div {
    constructor(code, args) {
        let {number, width, ...attr} = args ?? {};
        let attr1 = mergeAttr(attr, {class: 'svg', style: `width: ${width}%`});
        super(code, attr1);
    }
}

class Gum extends Element {
    constructor(code, args) {
        let {number, width, pixel, ...attr} = args ?? {};
        width = width ?? 65;
        let attr1 = mergeAttr(attr, {class: 'gum', style: `width: ${width}%`});
        super('div', false, attr1); // this is overridden
        this.code = code;
    }

    async inner(ctx) {
        let args = {pixel: this.pixel};
        let code = (ctx.lib ?? '') + '\n' + this.code;
        return renderGum(code, args);
    }
}

class GumLib extends Comment {
    constructor(code) {
        super(`gum.js headers`, {class: 'gum-lib'});
        this.code = code;
    }

    refs(ctx) {
        ctx.lib = (ctx.lib ?? '') + '\n' + this.code;
    }
}

class Upload extends Element {
    constructor(id, args) {
        let {gum} = args ?? {};
        super();
        this.id = id;
        this.gum = gum ?? false;
    }
}

class InternalImage extends Element {
    constructor(id, args) {
        let {width, ...attr} = args ?? {};
        width = width ?? 50;
        let attr1 = mergeAttr(attr, {class: 'internal-image', style: `width: ${width}%`});
        super('img', true, attr1);
        this.id = id;
    }

    async props(ctx) {
        let attr0 = await super.props(ctx);
        let src = await ctx.getImg(this.id);
        return mergeAttr(attr0, {src});
    }
}

class EnvBegin extends Container {
    constructor(name, args) {
        let {number} = args ?? {};
        super();
        this.name = name;
        this.number = number ?? true;
    }
}

class EnvSingle extends Container {
    constructor(name, args) {
        let {number} = args ?? {};
        super();
        this.name = name;
        this.number = number ?? true;
    }
}

class EnvEnd extends Container {
    constructor() {
        super();
    }
}

export { Context, incrementCounter, parseBlock, parseDocument, parseInline, renderMarkdown };
