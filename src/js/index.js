// spirit editor

export { initSpirit }

// import io from 'socket.io-client'
import { io } from "https://cdn.socket.io/4.3.0/socket.io.esm.min.js";
import { ElltwoEditor, enableResize } from './spirit.js'

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

function setCookie(src) {
    let ell2 = encodeURIComponent(src);
    document.cookie = `ell2=${ell2}; SameSite=Lax`;
}

// set a starting example
let example0 = `
#! Hello World!

Here is some inline math: $x^3$. Here is a block equation:

$$ [eq] \\sqrt{\\pi} = \\int_0^1 \\exp(-x^2) dx

And now we reference it @[eq].

!gum [width=70|id=gum|caption=Ride the Snake]
let sqr = x => Rotate(Square(), r2d*x, {invar: true});
let boxes = SymPoints({fy: sin, fs: sqr, size: 0.4, xlim: [0, 2*pi], N: 150});
return Graph(boxes, {ylim: [-1.6, 1.6]});

Now we can reference this figure too @[gum].
`.trim();

function initSpirit() {
    // global elements
    let left = document.querySelector('#left');
    let right = document.querySelector('#right');
    let mid = document.querySelector('#mid');

    // resize panels
    enableResize(left, right, mid);

    // initial value
    let urlParams = new URLSearchParams(window.location.search);
    let source = urlParams.get('source');
    let reset = urlParams.get('reset');
    let source0 = source ?? getCookie('ell2');
    let example = (reset != null || source0 == null)  ? example0 : source0;

    // make the actual editor
    let editor = new ElltwoEditor(left, right, setCookie);
    editor.setCode(example);

    // connect to server
    const socket = io();
    socket.on('connect', () => {
        console.log(socket.connected);
    });
}
