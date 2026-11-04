import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideHubForms } from '../../services/forms-config';
import { HubDatepickerComponent } from './datepicker.component';

/**
 * The calendar opens in an overlay on `<body>`, far from its field in the document. The field names
 * it through `aria-controls` while it is open, which is how assistive technology ties the two
 * together, and how a host that closes an editor when the focus leaves it (a spreadsheet cell)
 * knows the calendar is still part of the field.
 */
@Component({
	standalone: true,
	imports: [HubDatepickerComponent, ReactiveFormsModule],
	template: `<hub-datepicker [formControl]="ctrl" label="Arrival" />`
})
class PopupNameHostComponent {
	readonly ctrl = new FormControl<Date | null>(null);
}

describe('hub-datepicker popup name', () => {
	let fixture: ComponentFixture<PopupNameHostComponent>;

	const input = (): HTMLInputElement => fixture.nativeElement.querySelector('.hub-datepicker__input');

	beforeEach(async () => {
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [PopupNameHostComponent, ReactiveFormsModule],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();

		fixture = TestBed.createComponent(PopupNameHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	afterEach(() => {
		document.querySelectorAll('.hub-overlay-container, .hub-overlay-backdrop').forEach((el) => el.remove());
	});

	it('names nothing while the calendar is closed', () => {
		expect(input().hasAttribute('aria-controls')).toBe(false);
	});

	it('names the open calendar from the field', async () => {
		input().click();
		fixture.detectChanges();
		await fixture.whenStable();

		const id = input().getAttribute('aria-controls');

		expect(id).toBeTruthy();
		expect(document.getElementById(id!)?.classList.contains('hub-datepicker__panel')).toBe(true);
	});
});
