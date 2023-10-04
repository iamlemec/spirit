// spirit editor

import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, indentWithTab, historyKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { minimalSetup } from 'codemirror'
import { renderMarkdown } from './markum.js'

export { SpiritEditor, enableResize, getCookie, setCookie, downloadFile }

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
        this.readonly = true;
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
                readOnly.of(EditorState.readOnly.of(true))
            ],
        })
    }

    loadDocument(src) {
        if (src) {
            this.emit = false;
            this.setCode(src);
            this.setDisp(src);
        }
        this.emit = true;
        this.edit.focus();
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

    getCode() {
        return getText(this.edit.state);
    }

    setCode(src) {
        this.edit.setState(this.createState(src));
    }

    async setDisp(src) {
        let html = await renderMarkdown(src, this.extern);
        this.disp.innerHTML = html;
    }
}

// cookie tools
function getCookie(key) {
    let cookies = document.cookie.split(';').map(x => x.trim().split('='));
    let cell = cookies.filter(([k, v]) => k == key).shift();
    if (cell == null) {
        return null;
    } else {
        let [_, val] = cell;
        return decodeURIComponent(val);
    }
}

function setCookie(key, val) {
    let enc = encodeURIComponent(val);
    document.cookie = `${key}=${enc}; SameSite=Lax`;
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

// download named blob
function downloadFile(name, blob) {
    let url = URL.createObjectURL(blob);
    let elem = document.createElement('a');
    elem.setAttribute('href', url);
    elem.setAttribute('download', `${name}`);
    elem.style.display = 'none';
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
}
