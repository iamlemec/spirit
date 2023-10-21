// spirit console

import fs from 'fs'
import path from 'path'
import toml from 'toml'
import { Command } from 'commander'
import { exportHtml, exportLatex } from './export.js'
import { serveSpirit } from './server.js'

// load toml file
function loadToml(fpath) {
    let text = fs.readFileSync(fpath, 'utf8');
    return toml.parse(text);
}

// do conversion
async function convert(src, fmt) {
    let out;
    if (fmt == 'markdown') {
        out = src;
    } else if (fmt == 'html') {
        out = await exportHtml(src);
    } else if (fmt == 'latex') {
        out = exportLatex(src);
    } else {
        throw new Error(`Unknown format: ${fmt}`);
    }
    return out;
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
    .option('-s, --store <store>', 'Document storage path (store)')
    .action(async (doc, opts) => {
        let finp = (opts.store != null) ? path.join(opts.store, doc) : doc;
        let src = fs.readFileSync(finp, 'utf8');
        let out = await convert(src, opts.format);
        if (opts.output == undefined) {
            console.log(out);
        } else {
            fs.writeFileSync(opts.output, out);
        }
    });

// serve command
program.command('serve')
    .description('Run Spirit server')
    .option('-s, --store <store>', 'Document storage path', './store')
    .option('-h, --host <host>', 'IP address to serve on', 'localhost')
    .option('-p, --port <port>', 'Port to serve on', 8000)
    .option('-c, --conf <conf>', 'Path to config file')
    .action(async (opts) => {
        let args = (opts.conf != null) ? loadToml(opts.conf) : {};
        await serveSpirit(opts.store, opts.host, opts.port, args);
    });

// execute program
program.parse();
