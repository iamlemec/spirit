#! Spirit

Spirit is a light-weight editing framework based on Elltwo ($\ell^2$) and `gum.js`. The back-end is pure text, gotta keep it simple. Below is an example figure made using gum

!gum [id=snek|caption=Ride the Snake]
let sqr = x => Rotate(Square(), r2d*x, {invar: true});
let boxes = SymPoints({fy: sin, fs: sqr, size: 0.4, xlim: [0, 2*pi], N: 150});
return Graph(boxes, {ylim: [-1.6, 1.6]});

You can see that this is basically an embedded javascript language. We can reference the above figure using the syntax @[snek]. Hello world!

!img [key=desert_moon.png|id=dune|caption=Dreams are messages from the deep.]
