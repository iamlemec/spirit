// latex rendering


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

function escapeLatex(text) {
    return text.replace(/([#$%&~_^{}])/g, '\\$1');
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
        return escapeLatex(elem);
    }

    // raw array
    if (klass == 'Array') {
        return renderList(elem);
    }

    // pure container
    if (klass == 'Container' || klass == 'Div' || klass == 'Span') {
        return renderContainer(elem, ctx);
    }

    // line break
    if (klass == 'Newline') {
        return ' \\\\\n';
    }

    // escape sequence
    if (klass == 'Escape') {
        return `\\${elem.text}`;
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
        let text = escapeLatex(elem.text);
        return `\\texttt{${text}}`;
    }

    // hyperlink
    if (klass == 'Link') {
        let text = renderContainer(elem, ctx);
        return `\\href{${elem.attr.href}}{${text}}`;
    }

    // code
    if (klass == 'Code') {
        let code = escapeLatex(elem.code);
        return `\\texttt{${code}}`;
    }

    // list
    if (klass == 'List') {
        let env = (elem.tag == 'ol') ? 'enumerate' : 'itemize';
        let items = elem.children.map(e => `\\item ${renderContainer(e, ctx)}`).join('\n');
        return `\\begin{${env}}\n${items}\n\\end{${env}}`;
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

    if (klass == 'TableWrapper') {
        let [child] = elem.children;
        let table = renderLatex(child, ctx);
        return `\\begin{center}\n${table}\n\\end{center}`;
    }

    if (klass == 'Heading') {
        let level = Math.min(5, elem.level);
        let text = renderContainer(elem, ctx).trim();
        return `\\${'sub'.repeat(level)}section{${text}}`;
    }

    if (klass == 'NestedNumber') {
        incrementCounter(ctx, elem.name, elem.level);
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
        let title = (ctx.title != null) ? renderContainer(ctx.title) : null;
        let pack = ['amsmath', 'amssymb', 'xcolor', 'hyperref', 'cleveref', 'geometry'];
        let hopt = ['colorlinks=true', 'urlcolor=neonblue'];
        if (title != null) {
            hopt.push(`pdftitle={${title}}`);
        }
        let cmds = [
            '\\geometry{margin=1.25in}',
            '\\setlength{\\parindent}{0cm}',
            '\\setlength{\\parskip}{0.3cm}',
            '\\renewcommand{\\baselinestretch}{1.1}',
            '\\definecolor{neonblue}{rgb}{0.122, 0.435, 0.945}',
            `\\hypersetup{${hopt.join(',')}}`,
        ];
        let pre = pack.map(p => `\\usepackage{${p}}`).join('\n') + '\n\n' + cmds.join('\n');
        if (title != null) {
            pre += `\n\n\\title{\\vspace{-3em}${title}\\vspace{-3em}}\n\\author{}\n\\date{}`;
        }
        let body = renderContainer(elem, ctx, '\n\n');
        return `\\documentclass[12pt]{article}\n\n${pre}\n\n\\begin{document}\n\n${body}\n\n\\end{document}\n`;
    }

    // fall back to html?
    return `\\texttt{Unknown element of type: ${klass}}`;
}

export { renderLatex };
