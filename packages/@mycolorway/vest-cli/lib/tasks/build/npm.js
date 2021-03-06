const fs = require('fs')
const path = require('path')
const gulpPlumber = require('gulp-plumber')
const rollup = require('rollup')
const gulpRollup = require('gulp-better-rollup')
const rollupCommonjs = require('rollup-plugin-commonjs')
const rollupNodeResolve = require('rollup-plugin-node-resolve')
const gulpBabel = require('gulp-babel')
const gulpRename = require('gulp-rename')
const {resolveDependencies} = require('../utils')
const {getMiniprogramDistPath} = require('../../commands/utils')

module.exports = function(gulp) {
  const dependencies = Object.assign(resolveDependencies(this.config.cwd), this.config.extraDependencies)
  const dependencyNames = Object.keys(dependencies)
  const npmTasks = dependencyNames.reduce((result, dependencyName) => {
    const modulePath = dependencies[dependencyName]
    if (!fs.existsSync(modulePath)) return result

    const taskName = `${this.config.name}:npm-${dependencyName}`
    gulp.task(taskName, (done) => {
      this.log(`start compiling ${dependencyName} files...`)

      const mpDistPath = getMiniprogramDistPath(modulePath)
      if (mpDistPath && fs.existsSync(mpDistPath)) {
        return gulp.src(path.join(mpDistPath, '**/*'))
          .pipe(gulp.dest(path.join(this.config.distPath, 'miniprogram_npm', dependencyName)))
          .on('finish', () => this.log(`finish compiling ${dependencyName} package files.`))
      } else {
        const dependencyConfig = require(path.resolve(modulePath, 'package.json'))
        const entryFilePath = require.resolve(path.resolve(modulePath, dependencyConfig.main || 'index.js'))

        if (fs.existsSync(entryFilePath)) {
          return gulp.src(entryFilePath)
            .pipe(gulpPlumber())
            .pipe(gulpRollup({
              rollup: rollup,
              external: dependencyNames,
              plugins: [
                rollupNodeResolve({
                  modulesOnly: true
                }),
                rollupCommonjs({
                  sourceMap: false
                })
              ]
            }, {
              format: 'es'
            }))
            .pipe(gulpBabel({
              rootMode: 'upward',
              comments: false,
              compact: true
            }))
            .pipe(gulpRename({
              basename: 'index',
              extname: '.js'
            }))
            .pipe(gulp.dest(path.join(this.config.distPath, 'miniprogram_npm', dependencyName)))
            .on('finish', () => this.log(`finish compiling ${dependencyName} package files.`))
        } else {
          this.log(`finish compiling ${dependencyName} package files.`)
          done()
        }
      }
    });

    result.push(taskName)
    return result
  }, [])

  gulp.task(`${this.config.name}:npm`, npmTasks.length > 0 ? gulp.parallel(npmTasks) : function(done) {
    done()
  })
}
