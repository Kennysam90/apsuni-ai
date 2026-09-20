/**
 * Builds a branded business-guide PDF entirely on the device, so exporting a
 * guide needs no server endpoint. Writes PDF 1.4 directly with the built-in
 * Helvetica fonts: vector text, sharp when printed, a few kilobytes in size.
 */

export type PdfGuideSection = { title: string; paragraphs: string[]; bullets: string[]; numbered: boolean };

type Rgb = [number, number, number];

const PAGE_W = 595.28; // A4 in points
const PAGE_H = 841.89;
const MARGIN_X = 56;
const TOP = 70;
const BOTTOM = 70;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const NAVY: Rgb = [0.043, 0.078, 0.133];
const BLUE: Rgb = [0.145, 0.388, 0.922];
const BLUE_SOFT: Rgb = [0.576, 0.773, 0.992];
const INK: Rgb = [0.067, 0.094, 0.153];
const BODY: Rgb = [0.294, 0.333, 0.388];
const MUTED: Rgb = [0.58, 0.639, 0.722];
const PALE: Rgb = [0.796, 0.835, 0.882];
const RULE: Rgb = [0.898, 0.906, 0.922];
const WHITE: Rgb = [1, 1, 1];

// Helvetica / Helvetica-Bold advance widths (1/1000 em) for ASCII 32-126.
const REG = (
	'278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 ' +
	'278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 ' +
	'611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 ' +
	'556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'
).split(' ').map(Number);
const BOLD = (
	'278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 ' +
	'333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 ' +
	'611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 ' +
	'611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584'
).split(' ').map(Number);

const REPLACEMENTS: [string, string][] = [
	['‘', "'"], ['’', "'"], ['“', '"'], ['”', '"'],
	['–', '-'], ['—', '-'], ['…', '...'], ['•', '-'],
	['₦', 'NGN '], [' ', ' '],
];

/** Collapse whitespace and fold to Latin-1, which the built-in fonts cover. */
function clean(value?: string | null) {
	let text = String(value ?? '');
	for (const [from, to] of REPLACEMENTS) text = text.split(from).join(to);
	text = text.split(/\s+/).filter(Boolean).join(' ');
	return Array.from(text).map((ch) => (ch.length === 1 && ch.charCodeAt(0) <= 255 ? ch : '?')).join('');
}

function textWidth(text: string, size: number, bold = false) {
	const table = bold ? BOLD : REG;
	let units = 0;
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		units += code >= 32 && code <= 126 ? table[code - 32] : 556;
	}
	return (units * size) / 1000;
}

function wrap(value: string, size: number, width: number, bold = false) {
	const lines: string[] = [];
	let current = '';
	for (let word of clean(value).split(' ')) {
		if (!word) continue;
		const candidate = current ? `${current} ${word}` : word;
		if (textWidth(candidate, size, bold) <= width) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		// Hard-break a single word wider than the whole line (e.g. a URL).
		while (textWidth(word, size, bold) > width) {
			let cut = word.length;
			while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > width) cut -= 1;
			lines.push(word.slice(0, cut));
			word = word.slice(cut);
		}
		current = word;
	}
	if (current) lines.push(current);
	return lines.length ? lines : [''];
}

const escapePdf = (text: string) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const rgb = (color: Rgb) => color.map((part) => part.toFixed(3)).join(' ');
const pad2 = (value: number) => String(value).padStart(2, '0');

class PdfDocument {
	pages: string[][] = [];
	ops: string[] = [];
	y = 0;

	newPage() {
		this.ops = [];
		this.pages.push(this.ops);
		this.y = PAGE_H - TOP;
	}

	rect(x: number, y: number, w: number, h: number, color: Rgb) {
		this.ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
	}

	text(x: number, y: number, value: string, size: number, bold = false, color: Rgb = INK) {
		this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`);
	}

	ensure(height: number) {
		if (this.y - height < BOTTOM) this.newPage();
	}
}

/** A filesystem-safe name for the exported file, e.g. "laundry-pickup-service". */
export function guideFileName(title: string) {
	const slug = clean(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
	return slug || 'business-guide';
}

export function buildBusinessGuidePdf(input: {
	title: string;
	summary?: string;
	sections: PdfGuideSection[];
	country?: string;
	preparedFor?: string;
}): Uint8Array {
	const title = clean(input.title) || 'Business guide';
	const summary = clean(input.summary);
	const { sections } = input;
	const doc = new PdfDocument();
	doc.newPage();

	// ---- Cover band, sized to however many lines the title and summary wrap to.
	const titleLines = wrap(title, 24, CONTENT_W, true);
	const summaryLines = summary ? wrap(summary, 11, CONTENT_W) : [];
	let lastBaseline = 58 + 34 + 30 * (titleLines.length - 1);
	if (summaryLines.length) lastBaseline += 22 + 16 * (summaryLines.length - 1);
	const bandHeight = lastBaseline + 54;
	const bandBottom = PAGE_H - bandHeight;

	doc.rect(0, bandBottom, PAGE_W, bandHeight, NAVY);
	doc.rect(0, bandBottom, PAGE_W, 4, BLUE);

	let y = PAGE_H - 58;
	doc.text(MARGIN_X, y, 'APSUNI AI   /   BUSINESS GUIDE', 8.5, true, BLUE_SOFT);
	y -= 34;
	for (const line of titleLines) {
		doc.text(MARGIN_X, y, line, 24, true, WHITE);
		y -= 30;
	}
	if (summaryLines.length) {
		y += 8; // summary sits 22pt under the last title baseline
		for (const line of summaryLines) {
			doc.text(MARGIN_X, y, line, 11, false, PALE);
			y -= 16;
		}
	}

	const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
	const meta = [
		input.preparedFor ? `Prepared for ${clean(input.preparedFor)}` : '',
		input.country ? clean(input.country) : 'Global market',
		clean(date),
		`${sections.length} sections`,
	].filter(Boolean);
	doc.text(MARGIN_X, bandBottom + 20, meta.join('    |    '), 9, false, MUTED);
	doc.y = bandBottom - 30;

	// ---- Sections.
	sections.forEach((section, sectionIndex) => {
		doc.ensure(90); // keep a heading together with its first lines
		doc.y -= 8;
		doc.text(MARGIN_X, doc.y - 8, `SECTION ${pad2(sectionIndex + 1)}`, 7.5, true, BLUE);
		doc.y -= 18;
		doc.rect(MARGIN_X, doc.y - 16, 3, 17, BLUE);
		for (const headingLine of wrap(section.title, 14, CONTENT_W - 12, true)) {
			doc.text(MARGIN_X + 12, doc.y - 13, headingLine, 14, true, INK);
			doc.y -= 20;
		}
		doc.y -= 6;
		doc.rect(MARGIN_X, doc.y, CONTENT_W, 0.6, RULE);
		doc.y -= 14;

		for (const paragraph of section.paragraphs) {
			for (const line of wrap(paragraph, 10.5, CONTENT_W)) {
				doc.ensure(16);
				doc.text(MARGIN_X, doc.y - 10.5, line, 10.5, false, BODY);
				doc.y -= 16;
			}
			doc.y -= 6;
		}

		const indent = 24;
		section.bullets.forEach((item, itemIndex) => {
			wrap(item, 10.5, CONTENT_W - indent).forEach((line, lineIndex) => {
				doc.ensure(16);
				const baseline = doc.y - 10.5;
				if (lineIndex === 0) {
					if (section.numbered) doc.text(MARGIN_X, baseline, pad2(itemIndex + 1), 9.5, true, BLUE);
					else doc.rect(MARGIN_X + 3, baseline + 3, 4, 4, BLUE);
				}
				doc.text(MARGIN_X + indent, baseline, line, 10.5, false, BODY);
				doc.y -= 16;
			});
			doc.y -= 4;
		});
		doc.y -= 16;
	});

	// ---- Running header (page 2+) and footer on every page.
	const total = doc.pages.length;
	doc.pages.forEach((ops, index) => {
		doc.ops = ops;
		const number = index + 1;
		if (number > 1) {
			let header = title;
			while (header && textWidth(header, 8.5) > CONTENT_W - 120) header = `${header.slice(0, -4).trimEnd()}...`;
			doc.text(MARGIN_X, PAGE_H - 40, header, 8.5, false, MUTED);
			doc.text(PAGE_W - MARGIN_X - textWidth('APSUNI AI', 8.5, true), PAGE_H - 40, 'APSUNI AI', 8.5, true, BLUE);
			doc.rect(MARGIN_X, PAGE_H - 50, CONTENT_W, 0.6, RULE);
		}
		doc.rect(MARGIN_X, 46, CONTENT_W, 0.6, RULE);
		doc.text(MARGIN_X, 32, 'Generated by Apsuni AI. Verify costs and local regulations before investing.', 8, false, MUTED);
		const pageLabel = `Page ${number} of ${total}`;
		doc.text(PAGE_W - MARGIN_X - textWidth(pageLabel, 8), 32, pageLabel, 8, false, MUTED);
	});

	return serialize(doc.pages);
}

/** Every character here is Latin-1, so string length equals byte length. */
function serialize(pages: string[][]): Uint8Array {
	const objects: string[] = [];
	const add = (body: string) => objects.push(body);

	const catalogId = add('');
	const pagesId = add('');
	const regularId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
	const boldId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

	const kids: number[] = [];
	for (const ops of pages) {
		const stream = ops.join('\n');
		const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
		kids.push(add(
			`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
			`/Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
		));
	}

	objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
	objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(' ')}] /Count ${kids.length} >>`;

	let out = '%PDF-1.4\n%âãÏÓ\n';
	const offsets: number[] = [];
	objects.forEach((body, index) => {
		offsets.push(out.length);
		out += `${index + 1} 0 obj\n${body}\nendobj\n`;
	});

	const xrefAt = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
	out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info << /Producer (Apsuni AI) >> >>\nstartxref\n${xrefAt}\n%%EOF\n`;

	const bytes = new Uint8Array(out.length);
	for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
	return bytes;
}
