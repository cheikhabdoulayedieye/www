const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const request = require('request');
const Cookies = require('cookies');
const PrismicConfig = require('./prismic-configuration');
const Onboarding = require('./onboarding');
const app = require('./config');
const trimHtml = require('trim-html');

const PORT = app.get('port');

app.listen(PORT, () => {
  Onboarding.trigger();
  process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
});

// Middleware to inject prismic context.
app.use((req, res, next) => {
  res.locals.ctx = {
    endpoint: PrismicConfig.apiEndpoint,
    linkResolver: PrismicConfig.linkResolver,
    htmlSerializer: PrismicConfig.htmlSerializer,
  };
  // add PrismicDOM in locals to access them in templates.
  res.locals.PrismicDOM = PrismicDOM;
  res.locals.trimHtml = trimHtml;
  Prismic.api(PrismicConfig.apiEndpoint, {
    accessToken: PrismicConfig.accessToken,
    req,
  }).then((api) => {
    req.prismic = { api };
    next();
  }).catch((error) => {
    next(error.message);
  });
});

app.get('/', (req, res) => {
  let posts;
  let pageInfo = {
    title: 'Cheikh Abdoulaye Dieye',
    canonicalUrl: '/',
    htmlAttributes: {
      lang: 'fr'
    },
    attributes: {
      id: 'homepage'
    },
  };

  // Get all blog posts.
  req.prismic.api.query(Prismic.Predicates.at('document.type', 'blog'),{})
  .then((response) => {
    posts = response.results;
  })
  .catch((error) => {
    next(`error when retrieving blog posts: ${error.message}`);
  })
  .then(() => {
    res.render('homepage', { pageInfo, posts });
  });
});

app.get('/id/:id', (req, res, next) => {
  const id = req.params.id;
  let pageInfo = {
    title: 'Cheikh Abdoulaye Dieye',
  };
  req.prismic.api.getByID(id)
  .then((post) => {
    if (post) {
      pageInfo.title = post.data.titre[0].text + ' | ' + pageInfo.title;
      res.render('redirect', { pageInfo, post });
    }
    else {
      res.status(404).send('404 not found');
    }
  })
  .catch((error) => {
    next(`error when retrieving blog: ${error.message}`);
  });
});

app.get('/:uid', (req, res, next) => {
  const uid = req.params.uid;
  let pageInfo = {
    title: 'Cheikh Abdoulaye Dieye',
    htmlAttributes: {
      lang: 'fr'
    },
    displayNav: true,
    attributes: {
      id: 'blog-page'
    },
  };
  req.prismic.api.getByUID('blog', uid)
  .then((post) => {
    if (post) {
      pageInfo.title = post.data.titre[0].text + ' | ' + pageInfo.title;
      pageInfo.canonicalUrl = `/id/${post.id}`;
      res.render('blog', { pageInfo, post });
    } else {
      res.status(404).send('404 not found');
    }
  })
  .catch((error) => {
    next(`error when retrieving blog: ${error.message}`);
  });
});

/*
* Preconfigured prismic preview.
*/
app.get('/preview', (req, res) => {
  const { token } = req.query;
  if (token) {
    req.prismic.api.previewSession(token, PrismicConfig.linkResolver, '/').then((url) => {
      const cookies = new Cookies(req, res);
      cookies.set(Prismic.previewCookie, token, { maxAge: 30 * 60 * 1000, path: '/', httpOnly: false });
      res.redirect(302, url);
    }).catch((err) => {
      res.status(500).send(`Error 500 in preview: ${err.message}`);
    });
  } else {
    res.send(400, 'Missing token from querystring');
  }
});
