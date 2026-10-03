#!/usr/bin/env node
// Regenerates every TechnoTribes brand asset from scripts/brand/icon.svg.
// Run from repo root after `yarn` (uses apps/meteor's sharp), or point
// BRAND_NODE_PATH at any node_modules that has sharp + png-to-ico.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const require = createRequire(
	process.env.BRAND_NODE_PATH ? pathToFileURL(join(process.env.BRAND_NODE_PATH, '/')) : pathToFileURL(join(root, 'apps/meteor/')),
);
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default ?? pngToIcoModule;

const GRADIENT = ['#dd7710', '#dd5b10', '#94031c'];
const DARK_BG = '#0c0c0c';
const TEXT_LIGHT = '#0c0c0c';
const TEXT_DARK = '#ffffff';
const FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

const iconSrc = readFileSync(join(here, 'icon.svg'), 'utf8');
const paths = [...iconSrc.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
if (paths.length === 0) throw new Error('no <path> elements found in icon.svg');

const gradientDef = (id) =>
	`<linearGradient id="${id}" x1="4" y1="3" x2="28" y2="27" gradientUnits="userSpaceOnUse">` +
	`<stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="0.84" stop-color="${GRADIENT[1]}"/><stop offset="0.99" stop-color="${GRADIENT[2]}"/></linearGradient>`;

const iconPaths = (fill) => paths.map((d) => `<path fill="${fill}" d="${d}"/>`).join('');

// Square mark, optionally on a background. `pad` is viewBox padding in icon units.
const iconSvg = ({ bg = null, pad = 0, mono = null } = {}) => {
	const size = 32 + pad * 2;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${size} ${size}">` +
		(mono ? '' : `<defs>${gradientDef('g')}</defs>`) +
		(bg ? `<rect x="${-pad}" y="${-pad}" width="${size}" height="${size}" rx="${size * 0.18}" fill="${bg}"/>` : '') +
		iconPaths(mono ?? 'url(#g)') +
		`</svg>`
	);
};

// Horizontal wordmark, same geometry as packages/logo RocketChatLogo.tsx.
const wordmarkSvg = (textColor) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 30" width="180" height="30">` +
	`<defs>${gradientDef('g')}</defs>` +
	`<g transform="scale(0.9375)">${iconPaths('url(#g)')}</g>` +
	`<text x="36" y="21.5" fill="${textColor}" font-family='${FONT}' font-size="19" font-weight="700" letter-spacing="-0.4">TechnoTribes</text>` +
	`</svg>`;

const png = (svg, width, height = width) =>
	sharp(Buffer.from(svg), { density: 600 }).resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();

const logoDir = join(root, 'apps/meteor/public/images/logo');
mkdirSync(logoDir, { recursive: true });
const out = (name) => join(logoDir, name);

const write = (name, data) => {
	writeFileSync(out(name), data);
	console.log('wrote', name);
};

// Vector sources
write('icon.svg', iconSvg());
write('logo.svg', wordmarkSvg(TEXT_LIGHT));
write('logo_dark.svg', wordmarkSvg(TEXT_DARK));
write('safari-pinned-tab.svg', iconSvg({ mono: '#000000' }));

// Wordmark rasters
await png(wordmarkSvg(TEXT_LIGHT), 600, 100).toFile(out('logo.png'));
await png(wordmarkSvg(TEXT_DARK), 600, 100).toFile(out('logo_dark.png'));

// Transparent square marks
for (const [name, size] of [
	['favicon-16x16.png', 16],
	['favicon-32x32.png', 32],
	['1024x1024.png', 1024],
]) {
	await png(iconSvg({ pad: 1 }), size).toFile(out(name));
	console.log('wrote', name);
}

// Marks on dark background (home-screen / tile icons must be opaque)
for (const [name, size] of [
	['android-chrome-192x192.png', 192],
	['android-chrome-512x512.png', 512],
	['apple-touch-icon.png', 180],
	['apple-touch-icon-precomposed.png', 180],
	['mstile-70x70.png', 70],
	['mstile-144x144.png', 144],
	['mstile-150x150.png', 150],
	['mstile-310x310.png', 310],
]) {
	await png(iconSvg({ bg: DARK_BG, pad: 4 }), size).toFile(out(name));
	console.log('wrote', name);
}
await sharp(Buffer.from(iconSvg({ bg: DARK_BG, pad: 4 })), { density: 600 })
	.resize(150, 150)
	.extend({ left: 80, right: 80, background: DARK_BG })
	.png()
	.toFile(out('mstile-310x150.png'));
console.log('wrote mstile-310x150.png');

// favicon.ico (16 + 32 + 48)
const icoPngs = await Promise.all([16, 32, 48].map((s) => png(iconSvg({ pad: 1 }), s).toBuffer()));
writeFileSync(join(root, 'apps/meteor/public/favicon.ico'), await pngToIco(icoPngs));
console.log('wrote favicon.ico');

// Bot avatar (rocket.cat system user)
await png(iconSvg({ bg: DARK_BG, pad: 5 }), 512).toFile(join(root, 'apps/meteor/private/avatars/rocketcat.png'));
console.log('wrote private/avatars/rocketcat.png');

console.log('done');
