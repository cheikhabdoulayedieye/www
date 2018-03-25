const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const PrismicConfig = require('./prismic-configuration');
const pretty = require('pretty');
const pug = require('pug');
const fs = require('fs-extra');
const git = require('simple-git/promise')();
const trimHtml = require('trim-html');

const DEPLOY_DIR = process.env.HTML_OUTPUT_DIR || 'deploy';
const ctx = {
  endpoint: PrismicConfig.apiEndpoint,
  linkResolver: PrismicConfig.linkResolver,
};

module.exports = (() => {
  let prismicClient;
  let pageCreation = {
    homepage: false,
    blogPages: [],
    publicAssets: false,
  }

  console.log('Initialising Prismic API...');
  Prismic.api(PrismicConfig.apiEndpoint, {
    accessToken: PrismicConfig.accessToken,
  })
  .then((api) => {
    console.log('Successfully initialised Prismic API.');
    prismicClient = { api };
    cloneRepo();
  })
  .catch((error) => console.error('Could not initialise Prismic client. ' , error.message));

  let cloneRepo = () => {
    console.log('Cloning repository...');
    try {
      fs.removeSync(DEPLOY_DIR);
    }
    catch (e) {
      console.log(`Could not remove deploy dir before cloning! ${e}`);
    }
    git.clone('git@github.com:cheikhabdoulayedieye/cheikhabdoulayedieye.github.io.git', DEPLOY_DIR)
    .then(() => {
      console.log('Successfully cloned repository.');
      cleanDeployDir();
    })
    .catch((err) => console.error(`Could not clone repository: ${err}`));
  };

  let cleanDeployDir = () => {
    console.log('Cleaning deploy directory...');
    const tempDir = './gitTemp';
    try {
      // Move the .git dir to a temp dir first.
      fs.removeSync(tempDir);
      fs.moveSync(`${DEPLOY_DIR}/.git`, tempDir);
      // Then empty the dir.
      fs.emptyDirSync(DEPLOY_DIR);
      // Then copy back the .git dir.
      fs.moveSync(tempDir, `${DEPLOY_DIR}/.git`);
      console.log('Successfully cleaned deploy directory.');
    } catch (e) {
      console.error(`Could not clean deploy directory. ${e}`)
    }

    generatePages();
  };

  let generatePages = () => {
    console.log('Fetching blog posts...');
    prismicClient.api.query(Prismic.Predicates.at('document.type', 'blog'),{})
    .then((response) => {
      console.log('Successfully fetched blog posts.');
      posts = response.results;
    })
    .then(() => {
      createHomepage();
      if (posts) {
        posts.every((post) => {
          pageCreation.blogPages.push(post.uid);
          createBlogPage(post);
        });
      }
      copyPublicAssets();
    })
    .catch((error) => console.error(`Error when fetching blog posts: ${error.message}`));
  };

  let createHomepage = () => {
    console.log('Creating the homepage...');
    let pageInfo = {
      title: 'Cheikh Abdoulaye Dieye',
      htmlAttributes: {
        lang: 'fr',
      },
      attributes: {
        id: 'homepage'
      },
    };
    pug.renderFile('views/homepage.pug', { posts, pageInfo, ctx, PrismicDOM, trimHtml }, (err, html) => {
      if (err) {
        console.error('Unable to render file. ', err);
        process.exit();
      }

      // Write the homepage.
      const html_file = DEPLOY_DIR + '/index.html';
      fs.writeFile(html_file, pretty(html), (err) => {
        if (err) {
          return console.log(err);
        }
        console.log('Homepage file was saved.');
        pageCreation.homepage = true;
        donePageCreation();
      });
    });
  };

  let createBlogPage = (post) => {
    console.log('Creating blog page ', post.uid);
    let pageInfo = {
      title: 'Cheikh Abdoulaye Dieye',
      htmlAttributes: {
        lang: 'fr',
      },
      displayNav: true,
      attributes: {
        id: 'blog-page'
      },
    };
    pug.renderFile('views/blog.pug', { post, pageInfo, ctx, PrismicDOM }, (err, html) => {
      if (err) {
        console.error('Unable to render file. ', err);
        process.exit();
      }

      // Write the blog page.
      const html_file = DEPLOY_DIR + '/' + post.uid + '.html';
      fs.writeFile(html_file, pretty(html), (err) => {
        if (err) {
          return console.log(err);
        }
        console.log(`${post.uid} file was saved.`);
        const postIndex = pageCreation.blogPages.indexOf(post.uid);
        pageCreation.blogPages.splice(postIndex, 1);
        donePageCreation();
      });
    });
  };

  let copyPublicAssets = () => {
    console.log('Copying public assets...');
    fs.copy('public', DEPLOY_DIR)
    .then(() => {
      console.log('Copied all public assets successfully!');
      pageCreation.publicAssets = true;
      donePageCreation();
    })
    .catch(err => console.error(err));
  };

  let donePageCreation = () => {
    if (!pageCreation.homepage) return;
    if (pageCreation.blogPages.length) return;
    if (!pageCreation.publicAssets) return;
    commitFileChanges();
  };

  let commitFileChanges = () => {
    git.cwd(DEPLOY_DIR);
    console.log('Checking diff...');
    git.diff()
    .then((changes) => {
      if (changes) {
        console.log('Files have changed:\n', changes);
        return git.add('.');
      }
      else {
        console.log('No changes in repo.');
      }
    })
    .then(() => {
      console.log('Files staged.');
      const date = new Date();
      return git.commit(`Auto commit - ${date}`);
    })
    .then(() => {
      console.log('Successfully committed changes to git.');
      git.push('origin', 'master')
      .then(() => console.log('Successfully pushed changes.'))
      .catch((err) => console.error(`Could not push to git: ${err}`));
    })
    .catch((err) => console.error(err));
  };

})();
