const {readdir, writeFile, mkdir} = require('fs/promises');

const {join} = require('path');
const {spawn} = require('child_process');

const gulp = require('gulp');
const sass = require('sass');

const PROJECT_ROOT = __dirname;

const NG = `"${join(PROJECT_ROOT, 'node_modules', '.bin', 'ng')}"`;

const N_CORE = join(PROJECT_ROOT, 'projects', 'naisc-core');
const N_CORE_DEST = join(PROJECT_ROOT, 'dist', 'naisc-core');

function build() {
  return new Promise(resolve => {
    console.log();
    const buildProc = spawn(NG, ['build', 'naisc-core'], {
      cwd: PROJECT_ROOT,
      shell: true,
      stdio: 'inherit',
      env: process.env
    });
    process.on('exit', () => buildProc.kill());
    buildProc.on('exit', () => {
      console.log();
      resolve();
    });
  });
}

async function themesBuild() {
  const sourcePath = join(N_CORE, 'src', 'resources', 'themes', 'pre-built');
  const targetPath = join(N_CORE_DEST, 'themes', 'pre-built');

  await mkdir(targetPath, {recursive: true});

  for (const file of await readdir(sourcePath)) {
    if (!/^[^_].*\.scss$/.test(file)) continue;

    const source = join(sourcePath, file);
    const target = join(targetPath, file.replace(/\.scss$/, '.css'));

    const compiled = sass.compile(source);

    await writeFile(target, compiled.css, {encoding: 'utf-8'});
  }
}

function themesCopyBuilder() {
  const source = join(N_CORE, 'src', 'resources', 'themes', '*.scss');
  const target = join(N_CORE_DEST, 'themes');

  return gulp.src(source).pipe(gulp.dest(target));
}

gulp.task('themes:build', themesBuild);
gulp.task('themes:copy-builder', themesCopyBuilder);
gulp.task('themes', gulp.series('themes:build', 'themes:copy-builder'));

gulp.task('build:compile', build);
gulp.task('build', gulp.series('build:compile', 'themes'));
