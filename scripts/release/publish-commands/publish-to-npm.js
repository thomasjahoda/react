#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const { exec } = require('child-process-promise');
const { readJsonSync, writeJsonSync } = require('fs-extra');
const { join } = require('path');
const { confirm } = require('../utils');
const theme = require('../theme');

const run = async ({ cwd, dry, tags, ci }, packageName, otp) => {
  const packagePath = join(cwd, 'build/node_modules', packageName);
  const pkgJsonPath = join(packagePath, 'package.json');

  // // If the package.json is missing in the build directory, copy it from the source package.
  // // This helps when running a partial build that only creates bundles but doesn't prepare the full npm package.
  // if (!require('fs').existsSync(pkgJsonPath)) {
  //   const { copySync, ensureDirSync } = require('fs-extra');
  //   const sourcePath = join(cwd, 'packages', packageName);
  //   console.info(
  //     theme`{caution Package.json missing in build directory. Copying from source: } {path ${sourcePath}}`
  //   );
  //   ensureDirSync(packagePath);
  //   copySync(join(sourcePath, 'package.json'), pkgJsonPath);
  //
  //   // Copy other essential files if they exist
  //   const filesToCopy = ['LICENSE', 'README.md', 'npm'];
  //   filesToCopy.forEach(file => {
  //     const src = join(sourcePath, file);
  //     const dest = join(packagePath, file);
  //     if (require('fs').existsSync(src)) {
  //       copySync(src, dest);
  //     }
  //   });
  //
  //   // Also copy top-level LICENSE if missing
  //   if (!require('fs').existsSync(join(packagePath, 'LICENSE'))) {
  //     const rootLicense = join(cwd, 'LICENSE');
  //     if (require('fs').existsSync(rootLicense)) {
  //       copySync(rootLicense, join(packagePath, 'LICENSE'));
  //     }
  //   }
  // }

  let pkgJson = readJsonSync(pkgJsonPath);
  const { version } = pkgJson;

  // Rename package if it's one of the ones we want to fork
  if (packageName === 'react') {
    pkgJson.name = '@thomasjahoda-forks/react';
  } else if (packageName === 'react-dom') {
    pkgJson.name = '@thomasjahoda-forks/react-dom';
  }

  // Update dependencies/peerDependencies to point to the forks
  const updateDeps = (deps) => {
    if (!deps) return;
    if (deps['react']) {
      deps['@thomasjahoda-forks/react'] = deps['react'];
      delete deps['react'];
    }
    if (deps['react-dom']) {
      deps['@thomasjahoda-forks/react-dom'] = deps['react-dom'];
      delete deps['react-dom'];
    }
  };
  updateDeps(pkgJson.dependencies);
  updateDeps(pkgJson.peerDependencies);

  writeJsonSync(pkgJsonPath, pkgJson, { spaces: 2 });
  const publishedName = pkgJson.name;

  console.info(
    `Writing package.json for ${publishedName}@${version} to ${pkgJsonPath}`
  );
  console.info(`Wrote package.json for ${publishedName}@${version}`);

  // Check if this package version has already been published.
  // If so we might be resuming from a previous run.
  // We could infer this by comparing the build-info.json,
  // But for now the easiest way is just to ask if this is expected.
  const { status } = spawnSync('npm', ['view', `${publishedName}@${version}`]);
  const packageExists = status === 0;
  if (packageExists) {
    console.log(
      theme`{package ${publishedName}} {version ${version}} has already been published.`
    );
    if (!ci) {
      await confirm('Is this expected?');
    }
  } else {
    console.log(
      theme`{spinnerSuccess ✓} Publishing {package ${publishedName}}${dry ? ' (dry-run)' : ''}`
    );

    // Publish the package and tag it.
    if (!dry) {
      if (!ci) {
        await exec(`npm publish --access public --no-git-checks --tag=${tags[0]} --otp=${otp}`, {
          cwd: packagePath,
        });
        console.log(theme.command(`  cd ${packagePath}`));
        console.log(
          theme.command(`  npm publish --access public --no-git-checks --tag=${tags[0]} --otp=${otp}`)
        );
      } else {
        await exec(`npm publish --access public --no-git-checks --tag=${tags[0]}`, {
          cwd: packagePath,
        });
        console.log(theme.command(`  cd ${packagePath}`));
        console.log(
          theme.command(
            `  npm publish --access public --no-git-checks --tag=${tags[0]}`
          )
        );
      }
    }

    for (let j = 1; j < tags.length; j++) {
      if (!dry) {
        if (!ci) {
          await exec(
            `npm dist-tag add ${publishedName}@${version} ${tags[j]} --otp=${otp}`,
            { cwd: packagePath }
          );
          console.log(
            theme.command(
              `  npm dist-tag add ${publishedName}@${version} ${tags[j]} --otp=${otp}`
            )
          );
        } else {
          await exec(`npm dist-tag add ${publishedName}@${version} ${tags[j]}`, {
            cwd: packagePath,
          });
          console.log(
            theme.command(
              `  npm dist-tag add ${publishedName}@${version} ${tags[j]}`
            )
          );
        }
      }
    }

    if (tags.includes('untagged')) {
      // npm doesn't let us publish without a tag at all,
      // so for one-off publishes we clean it up ourselves.
      if (!dry) {
        if (!ci) {
          await exec(`npm dist-tag rm ${publishedName} untagged --otp=${otp}`);
          console.log(
            theme.command(
              `  npm dist-tag rm ${publishedName} untagged --otp=${otp}`
            )
          );
        } else {
          await exec(`npm dist-tag rm ${publishedName} untagged`);
          console.log(
            theme.command(`  npm dist-tag rm ${publishedName} untagged`)
          );
        }
      }
    }
  }
};

module.exports = run;
