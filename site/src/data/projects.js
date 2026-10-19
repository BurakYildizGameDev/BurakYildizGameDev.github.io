import data from './projects.json' with { type: 'json' };
import config from '../config.js';

// The Asset Store URL lives in site.config.js, so it only has to be filled in once.
export const projects = data.map((p) =>
  p.id === 'project-doctor' && config.projectDoctor.storeUrl
    ? { ...p, status: 'On the Unity Asset Store', links: { ...p.links, store: config.projectDoctor.storeUrl } }
    : p,
);

export const featuredProjects = projects.filter((p) => p.featured);

export const projectById = (id) => projects.find((p) => p.id === id);
