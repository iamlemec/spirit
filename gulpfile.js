import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import gulp from 'gulp'
import rename from 'gulp-rename'
import connect from 'gulp-connect'

// store values globally
let cache = {};

// js-core for server framework
gulp.task('js', () => {
    return rollup({
        cache: cache.esm,
        input: [
            'src/js/markum.js',
            'src/js/spirit.js',
            'src/js/index.js',
        ],
        plugins: [
            resolve({
                preferBuiltins: false,
            }),
        ],
    }).then(bundle => {
        cache.esm = bundle.cache;
        return bundle.write({
            dir: './dist',
            preserveModules: true,
            preserveModulesRoot: 'src',
            format: 'es',
        });
    });
});

// spirit css
gulp.task('css', () => gulp.src(['./src/css/markum.css', './src/css/spirit.css'])
    .pipe(gulp.dest('./dist/css'))
);

// gum font css
gulp.task('gum-fonts-css', () => gulp.src(['./node_modules/gum.js/css/fonts.css'])
    .pipe(rename('gum.css'))
    .pipe(gulp.dest('./dist/css'))
);

// gum fonts files
gulp.task('gum-fonts-data', () => gulp.src(['./node_modules/gum.js/css/fonts/*'])
    .pipe(gulp.dest('./dist/css/fonts'))
);

// gum fonts
gulp.task('gum-fonts', gulp.parallel('gum-fonts-css', 'gum-fonts-data'));

// katex font css
gulp.task('katex-fonts-css', () => gulp.src(['./node_modules/katex/dist/katex.min.css'])
    .pipe(rename('katex.css'))
    .pipe(gulp.dest('./dist/css'))
);

// katex fonts files
gulp.task('katex-fonts-data', () => gulp.src(['./node_modules/katex/dist/fonts/*'])
    .pipe(gulp.dest('./dist/css/fonts'))
);

// katex fonts
gulp.task('katex-fonts', gulp.parallel('katex-fonts-css', 'katex-fonts-data'));

// all fonts
gulp.task('fonts', gulp.parallel('gum-fonts', 'katex-fonts'));

// spirit all
gulp.task('build', gulp.parallel('js', 'css', 'fonts'));

// spirit reload
gulp.task('reload', () => gulp.src(['index.html'])
    .pipe(connect.reload())
);

// spirit serve
gulp.task('serve', () => {
    connect.server({
        root: '.',
        port: 8000,
        host: 'localhost',
        livereload: true
    });

    gulp.watch(['index.html'], gulp.series('reload'));
    gulp.watch(['src/js/markum.js', 'src/js/spirit.js'], gulp.series('js'));
    gulp.watch(['src/css/markum.css', 'src/css/spirit.css'], gulp.series('css'));
});

// spirit devel mode
gulp.task('devel', gulp.series(['build', 'serve']));
