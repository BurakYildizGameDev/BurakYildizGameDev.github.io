// Single place for everything personal on the site. The HTML pages read these values at build
// time through {{tokens}} (see vite.config.js), the scripts import them from src/config.js.

export default {
  name: 'Burak Yıldız',
  role: 'Unity tools & game developer',
  siteUrl: 'https://burakyildizgamedev.github.io',

  // The Asset Store lists the support address publicly.
  contactEmail: 'burakyildiz0417@gmail.com',
  supportEmail: 'burakyildiz0417@gmail.com',

  github: 'https://github.com/BurakYildizGameDev',
  itch: 'https://burak-yildiz.itch.io',
  huggingface: 'https://huggingface.co/BurakshDev',
  linkedin: '', // e.g. https://www.linkedin.com/in/your-name/ — left empty, the link is hidden
  // A CV to download (e.g. '/cv.pdf' with the file in site/public/). Left empty, the button is hidden.
  cv: '',

  education: {
    degree: 'B.Sc. in Computer Engineering',
    school: 'Kırşehir Ahi Evran University',
    graduated: 'October 2026',
  },

  projectDoctor: {
    version: '0.2.0',
    unity: '2022.3 LTS or newer',
    // Fill in once the package is live; the product page and the project card pick it up.
    storeUrl: '',
  },
};
