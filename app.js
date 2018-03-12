const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const request = require('request');
const Cookies = require('cookies');
const PrismicConfig = require('./prismic-configuration');
const Onboarding = require('./onboarding');
const app = require('./config');
const pretty = require('pretty');
const fs = require('fs');

const PORT = app.get('port');
const DEPLOY_DIR = app.get('html_output_dir');

let ncp = require('ncp').ncp;

app.listen(PORT, () => {
  Onboarding.trigger();
  process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
});

// Middleware to inject prismic context.
app.use((req, res, next) => {
  res.locals.ctx = {
    endpoint: PrismicConfig.apiEndpoint,
    linkResolver: PrismicConfig.linkResolver,
  };
  // add PrismicDOM in locals to access them in templates.
  res.locals.PrismicDOM = PrismicDOM;
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

  // Get all blog posts.
  req.prismic.api.query(Prismic.Predicates.at('document.type', 'blog'),{})
  .then((response) => {
    posts = response.results;
  })
  .catch((error) => {
    next(`error when retrieving blog posts: ${error.message}`);
  })
  .then(() => {
    res.render('homepage', { posts }, (err, html) => {
      res.send(html);

      // Write the homepage.
      const html_file = DEPLOY_DIR + '/index.html';
      fs.writeFile(html_file, pretty(html), (err) => {
        if (err) {
          return console.log(err);
        }
        console.log('Homepage file was saved.');
      });

      // Crawl the blog pages.
      if (posts) {
        posts.every((post) => {
          request.get('http://localhost:' + PORT + '/' + post.uid);
        });
      }
    });
  });
});

app.get('/:uid', (req, res, next) => {
  const uid = req.params.uid;
  req.prismic.api.getByUID('blog', uid)
  .then((document) => {
    if (document) {
      res.render('blog', { document }, (err, html) => {
        const html_file = DEPLOY_DIR + '/' + uid + '.html';
        fs.writeFile(html_file, pretty(html), (err) => {
          if (err) {
            return console.log(err);
          }
          console.log(`${uid} file was saved.`);
        });
      });
    } else {
      res.status(404).send('404 not found');
    }
  })
  .catch((error) => {
    next(`error when retriving page ${error.message}`);
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

app.createHtmlFiles = function () {
  // Prepare deploy directory.
  if (!fs.existsSync(DEPLOY_DIR)) {
    fs.mkdir(DEPLOY_DIR, (err) => {
      if (err) {
        return console.log(err);
      }
    });
  }

  const crawlPages = () => {
    // Get the homepage.
    request.get('http://localhost:' + PORT);

    // Copy public assets.
    ncp.limit = 16;

    ncp('public', DEPLOY_DIR, (err) => {
      if (err) {
        return console.error(err);
      }
      console.log('Copied all public assets successfully!');
    });
  }

  if (fs.existsSync(DEPLOY_DIR)) {
    // Crawl all pages to generate their files.
    crawlPages();
  }
  else {
    return console.log(`Could not create deploy dir: DEPLOY_DIR`);
  }
};

app.createHtmlFiles();
