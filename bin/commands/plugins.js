var
  clc = require('cli-color'),
  Kuzzle = require('../../lib/api/kuzzle');

/* eslint-disable no-console */

function commandPlugin (plugin, options) {
  var
    clcError = string => options.parent.noColors ? string : clc.red(string),
    clcNotice = string => options.parent.noColors ? string : clc.cyan(string),
    clcOk = string => options.parent.noColors ? string: clc.green.bold(string),
    kuzzle = new Kuzzle(),
    data = {};

  checkOptions();

  options.options.forEach(opt => {
    var k = opt.long.replace(/^--/, '');
    data[k] = options[k];
  });
  if (data.packageVersion) {
    data.version = data.packageVersion;
    delete data.packageVersion;
  }

  data._id = plugin;

  if (options.install) {
    console.log('███ kuzzle-plugins: Installing plugin...');
  }

  return kuzzle.cli.do('managePlugins', data, {pid: options.pid, debug: options.parent.debug})
    .then(res => {
      console.log('');

      if (options.list) {
        console.dir(res.result, {depth: null, colors: !options.parent.noColors});
      }
      else if (options.install) {
        if (res.result.success) {
          console.log(clcOk(`███ kuzzle-plugins: Plugin ${res.result.name}@${res.result.version}:\n${JSON.stringify(res.result.config, undefined, 2)}`));
        } else {
          console.log(clcError('███ kuzzle-plugins: An error occurred while installing plugin, for more information, please check kuzzle error logs'));
        }
      }
      else if (options.importConfig) {
        console.log(clcOk('[✔] Successfully imported configuration'));
      }
      else {
        console.dir(res.result, {depth: null, colors: !options.parent.noColors});
      }

      if (options.parent.debug) {
        console.log('\n\nDebug: -------------------------------------------');
        console.dir(res, {depth: null, colors: true});
      }

      process.exit(0);
    })
    .catch(err => {
      console.error(clcError(err.message));

      if (err.stack) {
        console.error(clcError(err.stack));
      }

      process.exit(err.status);
    });

  /**
   * Check the command-line validity.
   * Either this function completes successfully, or it exits the program
   * with a non-zero error code.
   */
  function checkOptions() {
    var
      requiredOptions;

    // Check if at least one of the action option is supplied
    requiredOptions = [0, 'install', 'remove', 'get', 'list', 'set', 'replace', 'unset', 'activate', 'deactivate', 'importConfig']
      .reduce((p, c) => {
        return p + (options[c] !== undefined);
      });

    if (requiredOptions > 1) {
      console.error(clcError('Only one plugin action is allowed'));
      process.exit(1);
    }
    else if (requiredOptions === 0) {
      console.error(clcError('A plugin action is required'));
      /*
       options.help() also exits the program, but with an error code of zero
       A non-zero error code is preferred to allow scripts to fail
       */
      options.outputHelp();
      process.exit(1);
    }

    // --list are the only options working without specifying a plugin name
    if (!plugin && !options.install && !options.list) {
      console.error(clcError('A plugin [name] is required for this operation'));
      process.exit(1);
    }

    if (options.install) {
      if (options.list) {
        console.error(clcError('Options --install and --list are mutually exclusive'));
        process.exit(1);
      }

      if (options.path && options.url) {
        console.error(clcError('Options --path and --url are mutually exclusive'));
        process.exit(1);
      }

      if (plugin && options.path) {
        console.error(clcError('Option --path and <plugin> are mutually exclusive'));
        process.exit(1);
      }

      if(plugin && options.url) {
        console.error(clcError('Option --url and <plugin> are mutually exclusive'));
        process.exit(1);
      }

      if (options.packageVersion && options.path) {
        console.warn(clcNotice('Warning: Cannot set a version when installing from local path. The packages.json version will be used instead.'));
        delete options.packageVersion;
      }

      if (!plugin && !options.path && !options.url) {
        console.error(clcError('No installation information provided. Needs at least <plugin>, --path or --url option to be set.'));
        process.exit(1);
      }
    }

  }
}

module.exports = commandPlugin;
