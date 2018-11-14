const nconf = require('nconf');
const path = require('path');

module.exports = function configLoader(options) {
  options = options || {};
  const { home_dir = __dirname } = options;

  nconf
    .argv()
    .env('__')

  nconf.file('config', {
    file: nconf.get('CONFIG_FILE') || path.join(home_dir, 'config.json')
  })

  nconf.file('secrets', {
    file: nconf.get('SECRETS_FILE') || path.join(home_dir, 'secret_settings.json')
  })

  nconf.file('defaults', {
    file: path.join(home_dir, 'config.defaults.json')
  })

  return nconf;
}
