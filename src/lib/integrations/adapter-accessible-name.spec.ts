import { Component, ViewContainerRef, inject, provideZonelessChangeDetection, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideHubForms } from '../services/forms-config';
import { HubFormControlConfig, hubFormControlAdapter } from './form-control-adapter';

/**
 * A control this adapter builds into somebody else's chrome still has a name.
 *
 * The adapter is how a library with no dependency on this one renders a real field — a table's
 * search box, a paginator's rows-per-page select. It read `kind`, `type`, `placeholder`, `cssClass`
 * and `options`, and silently dropped every route to a name the contract offered: `ariaLabel` was
 * declared and never applied, and there was no `label` at all. So the two controls a table builds
 * reached a screen reader as "edit text" and "combo box", in every application that wired it.
 *
 * `visually-hidden` is the default because this is the case the value exists for: the label is
 * rendered and bound, and only the ink goes.
 */
@Component({
	standalone: true,
	template: `<ng-container #slot />`
})
class AdapterHostComponent {
	readonly slot = viewChild.required('slot', { read: ViewContainerRef });
	readonly viewContainerRef = inject(ViewContainerRef);
}

const build = async (config: Partial<HubFormControlConfig>) => {
	TestBed.resetTestingModule();
	await TestBed.configureTestingModule({
		imports: [AdapterHostComponent],
		providers: [provideZonelessChangeDetection(), provideHubForms()]
	}).compileComponents();

	const fixture = TestBed.createComponent(AdapterHostComponent);
	fixture.detectChanges();

	const handle = hubFormControlAdapter.create(fixture.componentInstance.slot(), {
		kind: 'input',
		value: '',
		onValueChange: () => undefined,
		...config
	} as HubFormControlConfig);

	fixture.detectChanges();

	return { fixture, handle };
};

/** The name a screen reader would read off the control the adapter built. */
const accessibleName = (root: HTMLElement): string | null => {
	const control = root.querySelector('input, .ng-select input') as HTMLElement | null;
	const id = control?.getAttribute('id');
	const label = id ? root.querySelector(`label[for="${id}"]`) : null;

	return label?.textContent?.trim() ?? control?.getAttribute('aria-label') ?? null;
};

describe('hubFormControlAdapter accessible name', () => {
	it('renders the label the host asked for, clipped out of the page', async () => {
		const { fixture, handle } = await build({ label: 'Search' });
		const root = fixture.nativeElement as HTMLElement;

		expect(accessibleName(root)).toBe('Search');
		expect(root.querySelector('.hub-field__label--visually-hidden')).not.toBeNull();

		handle.destroy();
	});

	it('draws the label when the host asks for a visible one', async () => {
		const { fixture, handle } = await build({ label: 'Search', labelType: 'stacked' });
		const root = fixture.nativeElement as HTMLElement;

		expect(accessibleName(root)).toBe('Search');
		expect(root.querySelector('.hub-field__label--visually-hidden')).toBeNull();

		handle.destroy();
	});

	/** The field the contract always offered and the adapter never read. */
	it('falls back to ariaLabel, which used to reach nothing at all', async () => {
		const { fixture, handle } = await build({ ariaLabel: 'Rows per page' });

		expect(accessibleName(fixture.nativeElement)).toBe('Rows per page');

		handle.destroy();
	});

	it('names a select the same way', async () => {
		const { fixture, handle } = await build({
			kind: 'select',
			label: 'Rows per page',
			options: [{ value: 10, label: '10' }],
			value: 10
		});

		expect(accessibleName(fixture.nativeElement)).toBe('Rows per page');

		handle.destroy();
	});

	it('leaves a nameless control alone rather than inventing one', async () => {
		const { fixture, handle } = await build({});

		expect(fixture.nativeElement.querySelector('.hub-field__label')).toBeNull();

		handle.destroy();
	});
});
