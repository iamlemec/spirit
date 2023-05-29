#! Spirit Demo

Spirit is a light-weight editing framework based on Elltwo ($\ell^2$) and `gum.js`. The back-end is pure text, gotta keep it simple. Below is an example figure made using gum

!gum [id=snek|caption=Ride the Snake]
let sqr = x => Rotate(Square(), r2d*x, {invar: true});
let boxes = SymPoints({fy: sin, fs: sqr, size: 0.4, xlim: [0, 2*pi], N: 150});
return Graph(boxes, {ylim: [-1.6, 1.6]});

You can see that this is basically an embedded javascript language. We can reference the above figure using the syntax @[snek].

!img [key=desert_moon.png|id=dune|width=35|caption=Dreams are messages from the deep.]

Let's try out some fancy math, which we can reference here @[eqn]. And let's not forget about the lessons of @[dune].

$$ [eqn]
\int_0^1 \exp(-x^2) dx = \sqrt{\pi}

Ahh, it's time to relax. And you know what that means: a glass of wine, your favorite easy chair, and this compact disk playing on your home stereo. So go on, indulge yourself. Kick off your shoes, put your feet up, lean back and just enjoy the melodies. Because after all, music soothes even the savage beast.

This is a test of the emergency broadcasting system. Now see [[spirit.md]]. And we can do figures within external documents with [[spirit.md:snek]].
