import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import gulp from 'gulp'
import rename from 'gulp-rename'
import { spawn } from 'child_process';
import { create } from 'browser-sync';

// store values globally
let cache = {};

// js-core for server framework
gulp.task('js', () => {
    return rollup({
        cache: cache.esm,
        input: [
            'src/js/markum.js',
            'src/js/editor.js',
            'src/js/client.js',
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
gulp.task('css', () => gulp.src(['./src/css/markum.css', './src/css/editor.css'])
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

// all images
gulp.task('images', () => gulp.src(['./src/img/*'])
    .pipe(gulp.dest('./dist/img'))
);

// spirit all
gulp.task('build', gulp.parallel('js', 'css', 'fonts', 'images'));

// spirit watch
gulp.task('watch', () => {
    gulp.watch(['src/js/*'], gulp.series('js'));
    gulp.watch(['src/css/*'], gulp.series('css'));
    gulp.watch(['src/img/*'], gulp.series('images'));
});

// spirit devel mode
gulp.task('devel', gulp.series(['build', 'watch']));

// spirit (re)spawn server
let server = null;
let browserSync = null;
gulp.task('server-respawn-reload', function(done) {
    if (server != null) {
        server.kill();
    }
    server = spawn(
        'node', ['src/js/console.js', 'serve'], {stdio: 'inherit'}
    );
    browserSync.reload();
    done();
});

// spirit watch respawn
gulp.task('watch-respawn-reload', function() {
    gulp.watch(['src/js/*'], gulp.series(['js', 'server-respawn-reload']));
    gulp.watch(['src/css/*'], gulp.series('css'));
    gulp.watch(['src/img/*'], gulp.series('images'));
});


gulp.task('browser-sync-init', function(done) {
    browserSync = create();
    browserSync.init({
        proxy: "localhost:8000",
        reloadDelay: 500,
    });
    done();
});

// spirit serve
gulp.task('serve-devel', gulp.series([
    'build', 'browser-sync-init', gulp.parallel(['server-respawn-reload', 'watch-respawn-reload'])
]));

// basic spawn
gulp.task('server-respawn', function(done) {
    if (server != null) {
        server.kill();
    }
    server = spawn(
        'node', ['src/js/console.js', 'serve'], {stdio: 'inherit'}
    );
    done();
});

gulp.task('watch-respawn', function() {
    gulp.watch(['src/js/*'], gulp.series(['js', 'server-respawn']));
    gulp.watch(['src/css/*'], gulp.series('css'));
    gulp.watch(['src/img/*'], gulp.series('images'));
});

// basic serve
gulp.task('serve', gulp.series([
    'build', gulp.parallel(['server-respawn', 'watch-respawn'])
]));

