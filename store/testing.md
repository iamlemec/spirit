#! Hello World!

Here is some inline math: $x^3$. Here is a block equation:

$$ [eq] \sqrt{\pi} = \int_0^1 \exp(-x^2) dx

And now we reference it @[eq].

!gum [width=70|id=gum|caption=Ride the Snake]
let sqr = x => Rotate(Square(), r2d*x, {invar: true});
let boxes = SymPoints({fy: sin, fs: sqr, size: 0.4, xlim: [0, 2*pi], N: 150});
return Graph(boxes, {ylim: [-1.6, 1.6]});

Now we can reference this figure too @[gum].
