// Single place for everything personal on the site. The HTML pages read these values at build
// time through {{tokens}} (see vite.config.js), the scripts import them from src/config.js.

export default {
  name: 'Burak Yıldız',
  role: 'Unity tools & game developer',
  siteUrl: 'https://burakyildizgamedev.github.io',

  // TODO: replace both before publishing. A separate support address is recommended,
  // because the Asset Store lists it publicly.
  contactEmail: 'hello@example.com',
  supportEmail: 'support@example.com',

  github: 'https://github.com/BurakYildizGameDev',
  itch: 'https://burak-yildiz.itch.io',
  huggingface: 'https://huggingface.co/BurakshDev',
  linkedin: '', // e.g. https://www.linkedin.com/in/your-name/ — left empty, the link is hidden

  projectDoctor: {
    version: '0.2.0',
    unity: '2022.3 LTS or newer',
    // Fill in once the package is live; the product page and the project card pick it up.
    storeUrl: '',
  },
};
