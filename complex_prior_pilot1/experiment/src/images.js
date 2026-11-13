/**
 * images.js — URLs of the vignette pictures. The files stay in
 * ../complex_prior_pilot1_vignette1_images (next to the script); Vite serves
 * them from there in development and copies them into dist/ on build.
 */
const files = import.meta.glob("../../complex_prior_pilot1_vignette1_images/*.png", { eager: true, query: "?url", import: "default" });

const byName = {};
Object.entries(files).forEach(([path, url]) => { byName[path.split("/").pop()] = url; });

export function imageUrl(name) {
  if (!byName[name]) throw new Error(`Image not found: ${name}`);
  return byName[name];
}
