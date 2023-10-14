import { parseDocument, Context } from './markum.js';
import { renderLatex } from './latex.js';

// export interface


async function exportLatex(src) {
    let tree = parseDocument(src);
    let ctx = new Context();
    await tree.refs(ctx);
    let tex = await renderLatex(tree, ctx);
    return tex;
}

export { exportLatex };
