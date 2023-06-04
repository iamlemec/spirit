// export tools

import fs from 'fs'
import path from 'path'
import { Command } from 'commander'
import { exportLatex } from './latex.js'

// sub commands
function saveLatex(fpath, fout) {
    let src = fs.readFileSync(fpath, 'utf8');
    let tex = exportLatex(src);
    fs.writeFileSync(fout, tex);

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
    .argument('<output>', 'Output path to export to')
    .option('-f, --format <fmt>', 'Export format (markdown/html/latex)', 'markdown')
    .option('-s, --store <store>', 'Document storage path (store)', './store')
    .action((doc, out, opts) => {
        if (opts.format == 'markdown') {
        } else if (opts.format == 'html') {
        } else if (opts.format == 'latex') {
            let fpath = path.join(opts.store, doc);
            saveLatex(fpath, out);
        } else {
            console.log(`Unknown format: ${opts.format}`);
        }
    });

// execute program
program.parse();
