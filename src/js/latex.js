// latex rendering

export { refsLatex, renderLatex }

function className(x) {
    return x.constructor.name;
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

function refsContainer(cont, ctx) {
    cont.children.forEach(e => refsLatex(e, ctx));
}

function refsLatex(elem, ctx) {
    let klass = className(elem);

    if (klass == 'Document' || klass == 'Container' || klass == 'Block' || klass == 'Div' || klass == 'Span') {
        return refsContainer(elem, ctx);
    }

    if (klass == 'Title') {
        ctx.title = elem;
    }
}

function renderList(elems, ctx, sep='') {
    let child = elems.map(e => renderLatex(e, ctx));
    return child.join(sep);
}

function renderContainer(cont, ctx, sep='') {
    return renderList(cont.children, ctx, sep);
}

function renderLatex(elem, ctx) {
    let klass = className(elem);

    // raw string
    if (typeof(elem) == 'string') {
        return elem;
    }

    // raw array
    if (klass == 'Array') {
        return renderList(elem);
    }

    // pure container
    if (klass == 'Container' || klass == 'Div' || klass == 'Span') {
        return renderContainer(elem, ctx);
    }
    
    // italic text
    if (klass == 'Italic') {
        let text = renderContainer(elem, ctx);
        return `\\textit{${text}}`;
    }

    // bold text
    if (klass == 'Bold') {
        let text = renderContainer(elem, ctx);
        return `\\textbf{${text}}`;
    }

    // monospace text
    if (klass == 'Monospace') {
        let text = renderContainer(elem, ctx);
        return `\\texttt{${text}}`;
    }

    // inline math
    if (klass == 'Math') {
        return `$${elem.tex}$`;
    }

    // display math (use latex numbering)
    if (klass == 'Equation') {
        let tag = elem.number ? 'align' : 'align*';
        let lab = (elem.id != null) ? `\n\\label{${elem.id}}` : '';
        return `\\begin{${tag}}${lab}\n${elem.tex}\n\\end{${tag}}`;
    }

    if (klass == 'Reference') {
        return `\\Cref{${elem.id}}`;
    }

    if (klass == 'Figure') {
        let [child, caption] = elem.children;
        let env = (elem.ftype == 'table') ? 'table' : 'figure';
        let lab = (elem.id != null) ? `\\label{${elem.id}}\n` : '';
        let ftex = renderLatex(child, ctx);
        let ctex = (caption != null) ? `${renderLatex(caption, ctx)}\n` : null;
        return `\\begin{${env}}[h!]\n\\begin{center}\n${ftex}\n\\end{center}\n${ctex}${lab}\\end{${env}}`;
    }

    if (klass == 'Caption') {
        let cap = elem.number ? elem.children.slice(2) : elem.children;
        let ctex = renderLatex(cap, ctx);
        return `\\caption{${ctex}}`;
    }

    if (klass == 'Table') {
        let [head, body] = elem.children;
        let astr = elem.align.map(x => (x != null) ? x[0] : 'c').join('');
        let hrow = head.children[0].children;
        let htex = hrow.map(r => renderLatex(r, ctx)).map(x => `\\textbf{${x}}`).join(' & ');
        let btex = body.children.map(r => renderContainer(r, ctx, ' & ')).join(' \\\\\n');
        return `\\begin{tabular}{${astr}}\n${htex} \\\\\n\\hline\n${btex}\n\\end{tabular}`;
    }

    if (klass == 'Heading') {
        let level = Math.min(5, elem.level);
        let text = renderContainer(elem, ctx).trim();
        return `\\${'sub'.repeat(level)}section{${text}}`;
    }

    if (klass == 'NestedNumber') {
        let levels = incrementCounter(ctx, elem.name, elem.level);
        return '';
        
    }

    if (klass == 'Title') {
        return '\\maketitle';
    }

    if (klass == 'Block') {
        return renderContainer(elem, ctx);
    }
    
    // top level document
    if (klass == 'Document') {
        let pack = ['amsmath', 'amssymb', 'cleveref', 'geometry'];
        let cmds = [
            '\\geometry{margin=1.25in}',
            '\\setlength{\\parindent}{0cm}',
            '\\setlength{\\parskip}{0.3cm}',
            '\\renewcommand{\\baselinestretch}{1.1}'
        ];
        let pre = pack.map(p => `\\usepackage{${p}}`).join('\n') + '\n\n' + cmds.join('\n');
        if (ctx.title != null) {
            let title = renderContainer(ctx.title);
            pre += `\n\n\\title{\\vspace{-3em}${title}\\vspace{-3em}}\n\\date{}`;
        }
        let body = renderContainer(elem, ctx, '\n\n');
        return `\\documentclass[12pt]{article}\n\n${pre}\n\n\\begin{document}\n\n${body}\n\n\\end{document}\n`;
    }

    // fall back to html?
    return `\\texttt{Uknown element of type: ${klass}}`;
}
