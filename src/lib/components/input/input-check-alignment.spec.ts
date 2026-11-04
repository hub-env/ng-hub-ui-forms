import { compile } from 'sass';

/**
 * A checkbox or switch sits on the first line of its label. Asserted on the compiled rules: jsdom
 * lays nothing out, so the 1px centring is checked in a browser before release.
 */
const css = compile('projects/forms/src/lib/components/input/input.component.scss').css;

/** Body of the first compiled rule whose selector list has `selector` as an entry. */
const body = (selector: string): string => {
	const match = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) =>
		m[1].split(',').some((s) => s.trim().endsWith(selector))
	);
	expect(match, selector).toBeTruthy();
	return match![2];
};

describe('checkbox and switch alignment', () => {
	it('aligns the box to the top of a wrapping label', () => {
		expect(body('.hub-input--checkable .hub-input__check')).toMatch(/align-items:\s*flex-start;/);
	});

	it('measures the box line like the label and centres it on the first line', () => {
		const input = body('.hub-input__check-input');

		expect(input).toContain('font-size: var(--hub-input-font-size)');
		expect(input).toContain('line-height: inherit');
		expect(input).toContain('margin: calc((1lh - var(--hub-check-input-height)) / 2) 0 0');
	});

	it('uses the switch height in the same formula for the switch', () => {
		expect(css).toContain('margin-block-start: calc((1lh - var(--hub-switch-height)) / 2)');
	});
});
