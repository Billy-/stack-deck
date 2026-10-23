# Publish Stack Deck on GitHub Pages

This is a static app. GitHub Pages can serve its files directly: there is no build step, package installation, database, API key, or server to configure.

## Recommended: publish the `main` branch

1. Sign in to [GitHub](https://github.com/) and [create a new repository](https://github.com/new), for example `stack-deck`. Choose **Public** if you use GitHub Free. An eligible paid plan can publish from a private repository; the ordinary Pages website itself is still public. You can initialise the repository with a README to make its `main` branch available.
2. Extract the project ZIP. Open the extracted `stack-deck` folder. Upload **the contents of that folder**, preserving its subfolders, into the repository root. Use **Add file → Upload files**, then commit to `main`. The repository should have `index.html` at its top level, not inside another `stack-deck` folder. Upload the actual files, not the ZIP archive.
3. Keep the included `.nojekyll` file in the repository root. It tells GitHub to serve the static files without Jekyll processing. If your file picker omitted it, use **Add file → Create new file**, name it `.nojekyll`, leave its contents empty, and commit it.
4. Open the repository's **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, then choose **main** and **/(root)**. Click **Save**.
5. Wait for the Pages deployment to finish. The repository's **Actions** tab shows the deployment result; **Settings → Pages** shows the actual published URL. For a personal project named `stack-deck`, the usual address is `https://YOUR-USERNAME.github.io/stack-deck/`.
6. Open that published address on your phone. Check that the first card appears, tapping advances it, and Back returns to the previous card. If the app has been opened online and its offline cache is ready, test reopening it with the phone offline as well.

The delivered project uses the branch publishing route. It does not include a separate custom Actions deployment workflow, so there is only one publishing configuration to manage. GitHub may still display its automatically managed Pages deployment under Actions; that is normal.

## Update the app

Commit changed files to `main`. GitHub republishes the selected branch automatically. When updating the offline app, update the service worker's cache version along with the changed assets, so an installed copy can receive a coherent new version. Close existing app tabs and reopen the site after deployment if the old cached version is still visible.

## Preview locally

Run this from the project folder with Python 3 installed:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` on that computer. Serve the files over HTTP rather than double-clicking `index.html`; browser fetching and service workers need a supported origin. GitHub Pages provides HTTPS for the deployed app.

## Paths that work on GitHub Pages

Project sites live below the repository name, for example `/stack-deck/`. Keep local asset paths relative (`./styles.css`, `./data/cards.json`, `./sw.js`) rather than starting them with `/`. A leading slash targets the account domain's root and can break a project site.

Keep the web app manifest's `start_url` and `scope` relative to its location, such as `./`. Register the service worker from the app directory so it controls only this app. Do not hard-code a different repository name in the HTML, JavaScript, cache URLs, or manifest. If no explicit app identifier is needed, omit the manifest `id`; unlike `start_url`, a relative `id` is resolved against the origin rather than the manifest directory.

## If publishing does not work

- **404:** Confirm that the URL includes the repository name, `index.html` is in the selected source folder, and the deployment has completed.
- **Cards or styling missing:** Check that all project subfolders were uploaded and their names and letter case were preserved.
- **Pages settings unavailable:** Confirm you own the repository or have the required Pages administration permission, and that the repository visibility is supported by your GitHub plan.
- **Deployment not triggered:** Check the Actions result. For branch publication, an administrator with a verified email address may need to push a commit to the source branch. Commits made by a workflow using `GITHUB_TOKEN` do not trigger a Pages branch build.

## Sources

Verified against primary documentation on 23 October 2026:

- [GitHub: configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub: creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [GitHub: adding files to a repository](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [MDN: manifest start URL](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url)
- [MDN: manifest scope](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope)
- [MDN: manifest identifier](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)
- [MDN: service worker registration and scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
