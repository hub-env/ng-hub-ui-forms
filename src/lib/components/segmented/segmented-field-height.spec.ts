import { readFileSync } from 'node:fs';
import { compileString } from 'sass';

/**
 * `hub-segmented` stands as tall as the fields it sits beside.
 *
 * It is a field, and a field's first job in a row is to line up with its neighbours. It did not:
 * measured in Chrome, a `hub-select` came out 38px and the segmented bar 43px at its default
 * size and 33px at `sm`, so a row of the two was five pixels out whichever size was chosen. The
 * only way out was to guess the track's internal padding — a number deduced from the library's
 * current arithmetic, which stops being right the moment the library touches it.
 *
 * The height is one token now, read by both. A real browser is what measures pixels, so what is
 * pinned here is the thing that made them differ: that each control had its own idea of the
 * height, and nothing said they were the same idea.
 */
const css = (): string =>
	compileString(readFileSync('projects/forms/src/lib/styles/index.scss', 'utf8'), {
		loadPaths: ['projects/forms/src/lib/styles']
	}).css;

/** The component's own stylesheet, which is where the bar's structure lives. */
const componentCss = (): string =>
	compileString(readFileSync('projects/forms/src/lib/components/segmented/segmented.component.scss', 'utf8')).css;

/** The declared value of a custom property in the compiled `:root` block. */
const declared = (sheet: string, token: string): string => {
	const match = new RegExp(`${token}:\\s*([^;]+);`).exec(sheet);

	expect(match).not.toBeNull();

	return match![1].replace(/\s+/g, ' ').trim();
};

describe('segmented control height', () => {
	it('reads the same control height as the select, rather than a number of its own', () => {
		const sheet = css();

		expect(declared(sheet, '--hub-segmented-min-height')).toBe('var(--hub-field-control-min-height)');
		expect(declared(sheet, '--hub-select-min-height')).toBe('var(--hub-field-control-min-height)');
	});

	/**
	 * The subtraction lives in the rule, not in a token.
	 *
	 * A custom property holding a `var()` resolves where it is DECLARED, so an arithmetic token
	 * kept at `:root` reads the `:root` value of everything it names — and a container setting
	 * `--hub-segmented-min-height` would have been ignored, silently, by the only rule that cares.
	 * Measured in Chrome: with the arithmetic in the token, a 50px override changed nothing.
	 */
	it('takes the track frame off the option in the rule, so a local height override still lands', () => {
		expect(componentCss()).toContain('min-height: calc(var(--hub-segmented-min-height) - 2 * var(--hub-segmented-gap))');
	});

	it('keeps sm and lg a step either side of it', () => {
		const sheet = componentCss();

		expect(sheet).toContain('- var(--hub-segmented-size-step)');
		expect(sheet).toContain('+ var(--hub-segmented-size-step)');
		expect(declared(css(), '--hub-segmented-size-step')).toBe('var(--hub-ref-space-2, 0.5rem)');
	});
});
