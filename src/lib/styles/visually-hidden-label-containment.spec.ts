import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { readFileSync } from 'node:fs';
import { compileString } from 'sass';
import { HubInputComponent } from '../components/input/input.component';
import { provideHubForms } from '../services/forms-config';

/**
 * A `visually-hidden` label stays inside the field it names.
 *
 * The clipped label is `position: absolute`, which only says where it is NOT laid out; where it
 * ends up is decided by the nearest positioned ancestor. With none anywhere up the tree it
 * measured from the page, and in a scroll container that put it at the bottom of everything and
 * stretched the container's scroll height to reach it — a form that scrolled two thousand pixels
 * past its own last field.
 *
 * Nothing here is readable from the markup, so the real stylesheet is compiled and loaded: the
 * assertion is on the cascade, which is where the bug was.
 */
@Component({
	standalone: true,
	imports: [HubInputComponent, ReactiveFormsModule],
	template: `<hub-input [formControl]="amount" label="Discount" labelType="visually-hidden" />`
})
class HiddenLabelHostComponent {
	readonly amount = new FormControl<any>('');
}

/** The library stylesheet a consuming application imports, compiled from source. */
const stylesheet = (): string =>
	compileString(readFileSync('projects/forms/src/lib/styles/index.scss', 'utf8'), {
		loadPaths: ['projects/forms/src/lib/styles']
	}).css;

describe('visually hidden label containment', () => {
	let style: HTMLStyleElement;

	beforeEach(async () => {
		style = document.createElement('style');
		style.textContent = stylesheet();
		document.head.appendChild(style);

		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [HiddenLabelHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();
	});

	afterEach(() => style.remove());

	it('takes the label out of flow, and the field is what it is positioned against', () => {
		const fixture = TestBed.createComponent(HiddenLabelHostComponent);
		document.body.appendChild(fixture.nativeElement);
		fixture.detectChanges();

		const label = fixture.nativeElement.querySelector('.hub-field__label--visually-hidden') as HTMLElement;
		const field = fixture.nativeElement.querySelector('.hub-field') as HTMLElement;

		expect(getComputedStyle(label).position).toBe('absolute');

		// The first positioned ancestor is the containing block, so it has to be the field: any
		// ancestor above it is somebody else's box and not this field's to grow.
		let containing: HTMLElement | null = label.parentElement;

		while (containing && getComputedStyle(containing).position === 'static') {
			containing = containing.parentElement;
		}

		expect(containing).toBe(field);

		fixture.nativeElement.remove();
	});
});
