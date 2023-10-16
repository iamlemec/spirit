// export interface

import { parseDocument, Context } from './markum.js';
import { renderLatex } from './latex.js';

export { exportHtml, exportLatex }

async function exportHtml(src, opts) {
    let {bare, ...args} = opts ?? {};
    bare = bare ?? false;

    let tree = parseDocument(src, {bare});
    let ctx = new Context(args);
    await tree.refs(ctx);
    let body = await tree.html(ctx);

    let head = '';
    if (ctx.title != null) {
        let title = await ctx.title.inner();
        head = `<head>\n<title>${title}</title>\n</head>\n\n`;
    }

    if (bare) {
        return body;
    } else {
        return `<!DOCTYPE html>\n\n<html>\n\n${head}${body}\n\n</html>\n`;
    }
}

async function exportLatex(src, opts) {
    let tree = parseDocument(src);
    let ctx = new Context(opts);
    await tree.refs(ctx);
    let tex = await renderLatex(tree, ctx);
    return tex;
}
