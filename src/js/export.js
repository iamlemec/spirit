// export interface

import { parseDocument, Context } from './markum.js';
import { renderLatex } from './latex.js';

export { exportHtml, exportLatex }

async function exportHtml(src) {
    let tree = parseDocument(src, {bare: false});
    let ctx = new Context();
    await tree.refs(ctx);
    let body = await tree.html(ctx);
    let title = (ctx.title != null) ? await ctx.title.inner() : '';
    let html = `<!DOCTYPE html>\n\n<html>\n\n<head>\n<title>${title}</title>\n</head>\n\n${body}\n\n</html>\n`;
    return html;
}

async function exportLatex(src) {
    let tree = parseDocument(src);
    let ctx = new Context();
    await tree.refs(ctx);
    let tex = await renderLatex(tree, ctx);
    return tex;
}
