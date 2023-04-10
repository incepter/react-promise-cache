'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./react-application.production.js');
} else {
  module.exports = require('./react-application.development.js');
}
