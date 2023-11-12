// spirit editor

import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, indentWithTab, historyKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { minimalSetup } from 'codemirror'
import { renderMarkdown } from './markum.js'

export { SpiritEditor, enableResize }

const readOnly = new Compartment();

function getText(state) {
    return state.doc.toString();
}

class SpiritEditor extends EventTarget {
    constructor(code, disp, extern) {
        super();
        this.code = code;
        this.disp = disp;
        this.extern = extern;
        this.emit = false;
        this.readonly = false;
        this.edit = new EditorView({
            state: this.createState(''),
            parent: code,
        });
    }

    createState(doc) {
        return EditorState.create({
            doc: doc,
            extensions: [
                minimalSetup,
                lineNumbers(),
                bracketMatching(),
                markdown({defaultCodeLanguage: javascript()}),
                keymap.of([
                    indentWithTab,
                    ...defaultKeymap,
                    ...historyKeymap,
                ]),
                EditorView.lineWrapping,
                EditorView.updateListener.of(upd => {
                    if (this.emit && upd.docChanged) {
                        this.sendUpdate(upd);
                    }
                }),
                readOnly.of(EditorState.readOnly.of(this.readonly))
            ],
        })
    }

    loadDocument(src) {
        src = src ?? '';
        this.emit = false;
        this.setCode(src);
        this.setDisp(src);
        this.emit = true;
        this.focus();
    }

    sendUpdate(upd) {
        let text = getText(upd.state);
        let detail = {text, changes: upd.changes};
        this.setDisp(text);
        this.dispatchEvent(
            new CustomEvent('update', {detail})
        );
    }

    submitUpdate(upd) {
        if (this.emit && upd.docChanged) {
            this.sendUpdate(upd);
        }
    }

    applyUpdate(chg) {
        let upd = this.edit.state.update({changes: chg});
        this.edit.dispatch(upd);
    }

    setReadOnly(flag) {
        this.readonly = flag;
        this.edit.dispatch({
            effects: readOnly.reconfigure(EditorState.readOnly.of(flag))
        });
    }

    setConfig(conf) {
        let {macros} = conf;
        this.macros = macros;
    }

    getCode() {
        return getText(this.edit.state);
    }

    setCode(src) {
        this.edit.setState(this.createState(src));
    }

    async setDisp(src) {
        let html = await renderMarkdown(src, this.extern, this.macros);
        this.disp.innerHTML = html;
        positionPopups(this.disp);
    }

    focus() {
        this.edit.focus();
    }
}

// adjust popup positions
function positionPopups(elem) {
    let poppers = elem.querySelectorAll('.popper');
    for (let popper of poppers) {
        let ref = popper.querySelector('.popover');
        let pop = popper.querySelector('.popup');
        ref.addEventListener('mouseenter', evt => {
            let rrect = ref.getBoundingClientRect();
            let prect = pop.getBoundingClientRect();
            let wrect = elem.getBoundingClientRect();

            // get reference center
            let x_ref = rrect.x + rrect.width / 2;
            let y_ref = rrect.y + rrect.height / 2;
            let xl_pop = x_ref - prect.width / 2;
            let xr_pop = x_ref + prect.width / 2;
            let xt_pop = y_ref - prect.height - 15;

            // get horizontal overflow
            let xl_shift = Math.max(0, xr_pop - wrect.right + 20);
            let xr_shift = Math.max(0, wrect.left - xl_pop + 20);

            // implement shifters
            let x_shift = `calc(-50% - ${xl_shift-xr_shift}px)`;
            let y_shift = (xt_pop < wrect.top) ? '15px' : 'calc(-100% - 20px)';

            // set transform style
            pop.style.transform = `translate(${x_shift}, ${y_shift})`;
        });
    }
}

// resize panels
function enableResize(left, right, mid) {
    let base = left.getBoundingClientRect().left;
    function resizePane(e) {
        let vw = window.innerWidth;
        let x = e.clientX;
        let lw = Math.max(200, x - 2 - base);
        let rw = Math.max(200, vw - x - 2);
        left.style.width = `${lw}px`;
        right.style.width = `${rw}px`;
    }
    
    mid.addEventListener('mousedown', evt => {
        document.addEventListener('mousemove', resizePane, false);
    }, false);
    
    document.addEventListener('mouseup', evt => {
        document.removeEventListener('mousemove', resizePane, false);
    }, false);
}
