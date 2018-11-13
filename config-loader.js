const nconf = require('nconf');
const fs = require('fs');
const path = require('path');

const package_name =
  JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"))).name;

module.exports = function configLoader(options) {
  options = options || {};
  const { home_dir = __dirname } = options;

  nconf
    .argv()
    .env('__')

  nconf.file('config', {
    file: nconf.get('conf-file-location') || home_dir + '/config.json'
  })

  nconf.file('secrets', {
    file: nconf.get('secrets-file-location') || home_dir + '/secret_settings.json'
  })

  nconf.file('defaults', {
    file: home_dir + '/config.defaults.json'
  })

  return nconf;
}
