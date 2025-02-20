# Percy Main Community Sports Club - Website

Built with astro.build

## 🚀 Project Structure

Inside of the project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React components.

Any static assets, like images, can be placed in the `public/` directory.

## Commands

All commands are run from the root of the project, from a terminal:

| Command                           | Action                                           |
| :-------------------------------- | :----------------------------------------------- |
| `npm install`                     | Installs dependencies                            |
| `npm run dev`                     | Starts local dev server at `localhost:4321`      |
| `npm run build`                   | Build your production site to `./dist/`          |
| `npm run preview`                 | Preview your build locally, before deploying     |
| `npm run astro ...`               | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help`         | Get help using the Astro CLI                     |
| `npm run contentful:types`        | Generate Contentful types                        |
| `npm run contentful:create-merge` | Create a content merge from dev -> master        |
| `npm run contentful:apply-merge`  | Apply a created merge                            |

## Services

### Content

Content is stored in Contentful, and pulled into collections `src/collections`, using generated types.

There are two environments in our Contentful space - `dev` and `master`. Dev is used for local development, and testing content model changes.

#### Deploying a new content model

1. Make changes in dev environment
2. Use `contentful:types` script to generate types
3. Test locally
4. Open a PR, and test the deploy preview (this will use the dev space)
5. Create a new environment in Contentful `master-<todays date>`
6. Use Merge app in Contentful to merge model changes from dev to your new environment
7. Update `master` alias in Contentful to point at your new environment
8. Merge your PR
9. Use `contentful:create-merge` and `contentful:apply-merge` to push any content changes to `master` environment
10. App will redeploy via CF->Netlify webhook. Once it's done, test production

If anything goes wrong, the `master` alias can be pointed to its previous location, and a redeploy from Netlify will restore the previous version.

#### Stripe

Stripe is used as a checkout/payment processor. Wherever possible, data should be pulled into astro collections, but when unavoidable use `stripe.json` to hold payment related configuration.

#### Retool

Retool hosts some workflows which are triggered by webhook (e.g. save data to a GSheet on player registration). Any configuration goes in `retool.json`

#### Maps

Google maps provides us with maps for cricket games.

#### Better Auth

Used to provide authentication to members' area.

#### Turso

Distributed SQLite database storing authentication data

#### Mailgun

Email sending. Emails are written with `react-email`, and stored in the `emails` folder. A preview UI can be seen by running `npm run email`

## Environment

Locally you'll need a `.env` file containing the follwing:

```
BASE_URL=http://localhost:4321

# From contentful
CDN_TOKEN=
CDN_SPACE_ID=
CDN_ENVIRONMENT=
CDN_CMA_TOKEN=
CDN_PREVIEW_TOKEN=

# From stripe
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# From GCloud
MAPS_API_KEY=
MAPS_MAP_ID=

# From Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

# From Turso
DB_TOKEN=
DB_SYNC_URL=

# From Mailgun
MAILGUN_DOMAIN=
MAILGUN_API_KEY=
MAILGUN_URL=
```
