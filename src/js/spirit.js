import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, indentWithTab, historyKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { minimalSetup } from 'codemirror'
import { parseDocument } from './markum.js'

export { SpiritEditor, enableResize }

const readOnly = new Compartment();

function readWriteEditor(parent, update) {
    return new EditorView({
        state: EditorState.create({
            doc: '',
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
                EditorView.updateListener.of(update),
                readOnly.of(EditorState.readOnly.of(true))
            ],
        }),
        parent: parent,
    });
}

function getText(state) {
    return state.doc.toString();
}

function setText(editor, text) {
    let len = editor.state.doc.length;
    let upd = editor.state.update({
        changes: {from: 0, to: len, insert: text}
    });
    editor.dispatch(upd);
}

class SpiritEditor extends EventTarget {
    constructor(code, disp) {
        super();
        this.code = code;
        this.disp = disp;
        this.init = false;

        // init editor
        this.edit = readWriteEditor(code, upd => {
            if (this.init && upd.docChanged) {
                this.applyUpdate(upd);
            }
        });
    }

    loadDocument(src) {
        this.setCode(src);
        this.setDisp(src);
        this.init = true;
        this.setReadOnly(false);
    }

    applyUpdate(upd) {
        let text = getText(upd.state);
        this.setDisp(text);
        this.dispatchEvent(
            new CustomEvent('update', {detail: upd.changes})
        );
    }

    setReadOnly(flag) {
        this.edit.dispatch({
            effects: readOnly.reconfigure(EditorState.readOnly.of(flag))
        });
    }

    setCode(src) {
        setText(this.edit, src);
    }

    setDisp(src) {
        let tree = parseDocument(src);
        let html = tree.html();
        this.disp.innerHTML = html;
    }
}

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
