import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { readFileSync } from 'node:fs';
import { compileString } from 'sass';
import { provideHubForms } from '../../services/forms-config';
import { HubSegmentedComponent, HubSegmentedOption } from './segmented.component';

/**
 * Read-only keeps the value legible and focusable but refuses every change; disabled dims only the
 * options that are not selected, so the chosen value can still be read.
 */
@Component({
	standalone: true,
	imports: [HubSegmentedComponent, ReactiveFormsModule],
	template: `<hub-segmented [formControl]="ctrl" [options]="options" [multiple]="multiple()" [readonly]="readonly()" />`
})
class ReadonlyHostComponent {
	readonly ctrl = new FormControl<unknown>('list');
	readonly multiple = signal(false);
	readonly readonly = signal(true);
	readonly options: HubSegmentedOption[] = [
		{ value: 'list', label: 'List' },
		{ value: 'grid', label: 'Grid' }
	];
}

const componentCss = (): string =>
	compileString(readFileSync('projects/forms/src/lib/components/segmented/segmented.component.scss', 'utf8')).css;

/** Body of the first compiled rule whose selector list contains `selector` as one of its entries. */
const body = (css: string, selector: string): string => {
	const match = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === selector));
	expect(match, selector).toBeTruthy();
	return match![2];
};

describe('hub-segmented readonly', () => {
	let fixture: any;
	let changes: unknown[];

	const setup = async (multiple = false, readonly = true) => {
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [ReadonlyHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();

		fixture = TestBed.createComponent(ReadonlyHostComponent);
		fixture.componentInstance.multiple.set(multiple);
		fixture.componentInstance.readonly.set(readonly);
		if (multiple) fixture.componentInstance.ctrl.setValue(['list']);
		await fixture.whenStable();
		changes = [];
		fixture.componentInstance.ctrl.valueChanges.subscribe((v: unknown) => changes.push(v));
	};

	const options = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('.hub-segmented__option'));
	const group = (): HTMLElement => fixture.nativeElement.querySelector('.hub-segmented');

	it('ignores a click on another option', async () => {
		await setup();

		options()[1].click();
		await fixture.whenStable();

		expect(fixture.componentInstance.ctrl.value).toBe('list');
		expect(changes).toEqual([]);
	});

	it('ignores Space and Enter on another option', async () => {
		await setup();

		// Activation by key is a click on a native button; the keydown reaches the group first.
		for (const key of [' ', 'Enter']) {
			options()[1].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
			options()[1].click();
		}
		await fixture.whenStable();

		expect(fixture.componentInstance.ctrl.value).toBe('list');
		expect(changes).toEqual([]);
	});

	it('does not toggle in multiple mode either', async () => {
		await setup(true);

		options()[1].click();
		await fixture.whenStable();

		expect(fixture.componentInstance.ctrl.value).toEqual(['list']);
		expect(changes).toEqual([]);
	});

	it('changes the value when not readonly (control for the tests above)', async () => {
		await setup(false, false);

		options()[1].click();

		expect(fixture.componentInstance.ctrl.value).toBe('grid');
	});

	it('keeps the options focusable', async () => {
		await setup();

		expect(options().every((o) => !o.disabled)).toBe(true);
		expect(options().some((o) => o.tabIndex === 0)).toBe(true);
	});

	it('marks the radiogroup aria-readonly in single mode', async () => {
		await setup();

		expect(group().getAttribute('role')).toBe('radiogroup');
		expect(group().getAttribute('aria-readonly')).toBe('true');
	});

	it('leaves aria-readonly off the group of multiple mode, where ARIA does not allow it', async () => {
		await setup(true);

		expect(group().getAttribute('role')).toBe('group');
		expect(group().hasAttribute('aria-readonly')).toBe(false);
	});
});

describe('hub-segmented disabled', () => {
	it('does not fade the whole bar, so the selected option stays at full strength', () => {
		expect(body(componentCss(), '.hub-segmented--disabled')).not.toContain('opacity');
	});

	it('paints the selected option from the disabled-selected tokens at full opacity', () => {
		const css = componentCss();

		expect(body(css, '.hub-segmented--disabled .hub-segmented__indicator')).toContain(
			'background: var(--hub-segmented-disabled-selected-bg)'
		);
		const selected = body(css, '.hub-segmented--disabled .hub-segmented__option--selected:disabled');
		expect(selected).toContain('color: var(--hub-segmented-disabled-selected-color)');
		expect(selected).toContain('opacity: 1');
	});

	it('declares both tokens', () => {
		const tokens = readFileSync('projects/forms/src/lib/styles/_tokens.scss', 'utf8');

		expect(tokens).toContain('--hub-segmented-disabled-selected-bg:');
		expect(tokens).toContain('--hub-segmented-disabled-selected-color:');
	});
});
