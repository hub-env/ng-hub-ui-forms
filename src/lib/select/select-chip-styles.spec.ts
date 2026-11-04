import { compile, compileString } from 'sass';

/**
 * The chip look and the multiple-select chip rows, asserted on the compiled stylesheets: jsdom
 * resolves no `var()` and lays nothing out, so measuring would pass whatever it was given.
 */
const select = (): string => compile('projects/forms/src/lib/select/select.component.scss').css;

/** Body of the first compiled rule whose selector list has `selector` as an entry. */
const body = (css: string, selector: string): string => {
	const match = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === selector));
	expect(match, selector).toBeTruthy();
	return match![2];
};

describe('hub-select-chip', () => {
	const accents = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'neutral', 'light', 'dark'];

	it('applies the mixin through .hub-select-chip', () => {
		expect(body(select(), '.hub-select-chip')).toContain('--hub-select-chip-accent-emphasis');
	});

	it.each(accents)('hub-select-chip-%s sets the accent from its semantic colour', (accent) => {
		expect(body(select(), `.hub-select-chip-${accent}`)).toMatch(
			new RegExp(`--hub-select-chip-accent:\\s*var\\(--hub-sys-color-${accent},`)
		);
	});

	it('asks for the group anchor in the mixin and for the control by default', () => {
		const tokens = compile('projects/forms/src/lib/styles/_tokens.scss').css;

		expect(body(select(), '.hub-select-chip')).toContain('--hub-select-dropdown-anchor: group');
		expect(tokens).toMatch(/--hub-select-dropdown-anchor:\s*control;/);
	});

	it('forwards the mixin from the styles index', () => {
		const css = compileString(`@use 'index' as forms; .mine { @include forms.hub-select-chip($accent: red); }`, {
			loadPaths: ['projects/forms/src/lib/styles']
		}).css;

		expect(body(css, '.mine')).toContain('--hub-select-chip-accent: red');
	});
});

describe('hub-select multiple chips', () => {
	it('puts no margin on a chip, so the rows are centred by the container padding', () => {
		expect(body(select(), '.hub-select__control.ng-select.ng-select-multiple .ng-value')).toMatch(/margin:\s*0;/);
	});

	it('pads the container equally above and below and parts the chips with a gap', () => {
		const container = body(select(), '.hub-select__control.ng-select.ng-select-multiple .ng-value-container');

		expect(container).toMatch(/padding-block:\s*0\.25rem;/);
		expect(container).toMatch(/gap:\s*0\.25rem;/);
	});
});
