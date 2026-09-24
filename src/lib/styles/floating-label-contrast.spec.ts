import { compile } from 'sass';
import { compositeOver, contrastRatio, toRgb } from 'ng-hub-ui-utils';

/**
 * A floating label is two things in one element. At rest it stands in for the placeholder and
 * is painted like one; lifted, it is the field's name — the only thing left saying what the
 * value means — and it is read as long as the form is on screen.
 *
 * It shipped lifted at `opacity: .9` over the placeholder's muted grey, which put it at
 * 3.96:1 on a white field while the plain label beside it sat at 16:1. The muted grey itself
 * clears 4.5:1 with almost nothing to spare, so the fade alone was enough to sink it.
 *
 * Measured off the compiled stylesheet rather than off an element: jsdom lays nothing out,
 * so a rendered floating label has no colour to read.
 */

/** WCAG AA for body text. The lifted label is 12px, so the large-text relaxation never applies. */
const MIN_CONTRAST = 4.5;

/**
 * The ds light theme, as far as these chains read it. Seeded rather than inferred from the
 * inline fallbacks: those fallbacks are the safety net for an application that never loaded
 * the design system, and `--hub-sys-text-muted` is one of the tokens ds deliberately moved
 * off its own fallback (`#6c757d`, 3.85:1 on white) to clear AA.
 */
const THEME: Record<string, string> = {
	'--hub-sys-surface-page': '#ffffff',
	'--hub-sys-text-primary': '#212529',
	'--hub-sys-text-muted': '#6a737b'
};

/** Every `:root` token the library declares, which is where the chains under test start. */
const TOKENS = { ...collect(compile('projects/forms/src/lib/styles/_tokens.scss').css), ...THEME };

/** One compiled rule: the selector it matched on and the declarations it carries. */
interface Rule {
	selector: string;
	body: string;
}

function rules(path: string): Rule[] {
	const css = compile(path).css.replace(/\/\*[\s\S]*?\*\//g, '');
	const out: Rule[] = [];
	for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		out.push({ selector: match[1].replace(/\s+/g, ' ').trim(), body: match[2] });
	}
	return out;
}

/** Every custom property declared anywhere in a compiled sheet. */
function collect(css: string): Record<string, string> {
	const table: Record<string, string> = {};
	for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+):([^;}]+)/g)) {
		table[match[1]] = match[2].replace(/\s+/g, ' ').trim();
	}
	return table;
}

/**
 * The value a property ends up with for an element matching every given marker, following the
 * order the sheet declares its rules in. Specificity is not modelled: these selectors are all
 * single-class chains of the same weight, so source order is what decides.
 */
function cascaded(sheet: Rule[], markers: string[], property: string, excluded: string[] = []): string | null {
	let winner: string | null = null;
	for (const rule of sheet) {
		if (!markers.every((marker) => rule.selector.includes(marker))) {
			continue;
		}
		if (excluded.some((marker) => rule.selector.includes(marker))) {
			continue;
		}
		const match = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(rule.body);
		if (match) {
			winner = match[1].replace(/\s+/g, ' ').trim();
		}
	}
	return winner;
}

/** Follows a `var()` chain, honouring the fallback the cascade would fall back to. */
function resolve(value: string): string {
	const match = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]+))?\)$/.exec(value.trim());
	if (!match) {
		return value.trim();
	}
	const declared = TOKENS[match[1]];
	return resolve(declared ?? match[2] ?? '');
}

/** The colour a label is actually painted with, once its own opacity has been composited. */
function painted(color: string, opacity: string | null, background: string): string {
	const rgb = toRgb(resolve(color))!;
	const alpha = opacity === null ? 1 : Number(opacity);
	return `#${[compositeOver({ ...rgb, a: alpha }, toRgb(resolve(background))!)]
		.map((composited) => toRgb(composited)!)
		.map(({ r, g, b }) => [r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join(''))
		.join('')}`;
}

describe('floating label contrast', () => {
	const cases = [
		{
			field: 'hub-input',
			sheet: rules('projects/forms/src/lib/components/input/input.component.scss'),
			resting: ['.hub-input__label--floating'],
			raised: [':not(:placeholder-shown)'],
			lifts: [':not(:placeholder-shown)', ':focus'],
			background: 'var(--hub-input-bg)'
		},
		{
			field: 'hub-select',
			sheet: rules('projects/forms/src/lib/select/select.component.scss'),
			resting: ['.hub-select__label--floating'],
			raised: ['.hub-select__group--raised'],
			lifts: ['.hub-select__group--raised'],
			background: 'var(--hub-select-bg)'
		}
	];

	it.each(cases)('keeps the lifted $field label readable on the field', ({ sheet, resting, raised, background }) => {
		const color = cascaded(sheet, raised, 'color') ?? cascaded(sheet, resting, 'color')!;
		const opacity = cascaded(sheet, raised, 'opacity');

		expect(contrastRatio(painted(color, opacity, background), resolve(background))!).toBeGreaterThanOrEqual(MIN_CONTRAST);
	});

	it.each(cases)('keeps the resting $field label readable on the field', ({ sheet, resting, lifts, background }) => {
		const color = cascaded(sheet, resting, 'color', lifts)!;
		const opacity = cascaded(sheet, resting, 'opacity', lifts);

		expect(contrastRatio(painted(color, opacity, background), resolve(background))!).toBeGreaterThanOrEqual(MIN_CONTRAST);
	});
});
