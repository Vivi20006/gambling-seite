/* NOVA sign-in settings.
 *
 * Google: create an OAuth 2.0 "Web application" client in the Google Cloud console
 *   (APIs & Services → Credentials) and add your site's origin (e.g. https://your-site.com
 *   or http://localhost:8000) under "Authorized JavaScript origins".
 * Discord: create an application at https://discord.com/developers/applications,
 *   open OAuth2 and add the exact page URL (e.g. https://your-site.com/ or
 *   http://localhost:8000/) as a redirect.
 *
 * Paste the client IDs below. While an ID is empty, that button falls back to a local
 * demo account so the site can still be tried out offline.
 */
window.NOVA_CONFIG = {
  googleClientId: '',
  discordClientId: '',
  // leave empty to use the current page URL (must match a redirect in the Discord app)
  discordRedirectUri: '',
};
