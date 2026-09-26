// Generates the PWA icon set with ImageMagick draw primitives (no SVG delegate needed).
// The artwork mirrors public/favicon.svg: teal rounded square, outlined crate, amber check badge.
// Usage: npm run icons   (requires ImageMagick `convert` on PATH)
import { execSync } from 'node:child_process';

function draw(out, size, { maskable = false, transparent = true } = {}) {
  // Design on a 512 grid, scaled to `size`. Maskable icons keep artwork inside the 80% safe zone.
  const s = size / 512;
  const k = maskable ? 0.72 : 1; // shrink artwork for maskable safe zone
  const o = maskable ? (512 * (1 - k)) / 2 : 0; // offset to keep centered
  const p = (v) => Math.round((o + v * k) * s);
  const w = (v) => Math.max(1, Math.round(v * k * s));

  const bg = maskable || !transparent ? '#0f766e' : 'none';
  const radius = maskable ? 0 : w(112);

  const args = [
    `-size ${size}x${size} xc:${bg}`,
    // rounded background square
    `-fill "#0f766e" -stroke none -draw "roundrectangle ${p(0)},${p(0)} ${p(512) - 1},${p(512) - 1} ${radius},${radius}"`,
    // crate outline
    `-fill none -stroke "#ffffff" -strokewidth ${w(28)} -draw "polygon ${p(256)},${p(96)} ${p(400)},${p(168)} ${p(256)},${p(240)} ${p(112)},${p(168)}"`,
    `-draw "polyline ${p(112)},${p(168)} ${p(112)},${p(344)} ${p(256)},${p(416)} ${p(400)},${p(344)} ${p(400)},${p(168)}"`,
    `-draw "line ${p(256)},${p(240)} ${p(256)},${p(416)}"`,
    // amber badge with check
    `-fill "#f59e0b" -stroke none -draw "circle ${p(392)},${p(392)} ${p(392)},${p(320)}"`,
    `-fill none -stroke "#ffffff" -strokewidth ${w(22)} -draw "polyline ${p(358)},${p(392)} ${p(382)},${p(416)} ${p(428)},${p(368)}"`,
    out,
  ];
  execSync(`convert ${args.join(' ')}`, { stdio: 'inherit' });
  console.log(`wrote ${out}`);
}

draw('public/pwa-192x192.png', 192);
draw('public/pwa-512x512.png', 512);
draw('public/apple-touch-icon.png', 180, { transparent: false });
draw('public/pwa-maskable-512x512.png', 512, { maskable: true });
