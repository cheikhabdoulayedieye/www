
/**
 * Module dependencies.
 */
const express = require('express');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const errorHandler = require('errorhandler');
const path = require('path');

module.exports = (() => {
  const app = express();

  // all environments
  app.set('port', process.env.PORT || 3000);
  app.set('prismic_webhook_secret', process.env.PRISMIC_WEBHOOK_SECRET || '');
  app.set('aws_prismic_webhook_bucket', process.env.AWS_PRISMIC_WEBHOOK_BUCKET || '');
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'pug');
  app.use(favicon('public/favicon.ico'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(methodOverride());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(errorHandler());

  return app;
})();
