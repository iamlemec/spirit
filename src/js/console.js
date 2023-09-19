// export tools

import fs from 'fs'
import path from 'path'
import { Command } from 'commander'
import { Context, parseDocument } from './markum.js'
import { refsLatex, renderLatex } from './latex.js'

// sub commands
function saveLatex(fpath, fout) {
    let src = fs.readFileSync(fpath, 'utf8');
    let doc = parseDocument(src);
    let ctx = new Context();
    refsLatex(doc, ctx);
    let tex = renderLatex(doc, ctx);
    if (fout == undefined) {
        console.log(tex);
    } else {
        fs.writeFileSync(fout, tex);
    }
}

// create program
let program = new Command();

// meta data
program
    .name('spirit-console')
    .description('Spirit Console Interface')
    .version('0.1')

// export command
program.command('export')
    .description('Export elltwo document to specified format')
    .argument('<docname>', 'Document name to export')
    .option('-o, --output <output>', 'Output path to export to (stdout if not specified)')
    .option('-f, --format <format>', 'Export format (markdown/html/latex)', 'markdown')
    .option('-s, --store <store>', 'Document storage path (store)', './store')
    .action((doc, opts) => {
        if (opts.format == 'markdown') {
        } else if (opts.format == 'html') {
        } else if (opts.format == 'latex') {
            let fpath = path.join(opts.store, doc);
            saveLatex(fpath, opts.output);
        } else {
            console.log(`Unknown format: ${opts.format}`);
        }
    });

// execute program
program.parse();
