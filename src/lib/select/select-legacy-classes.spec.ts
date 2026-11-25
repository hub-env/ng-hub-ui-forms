import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';

/**
 * The engine emits the upstream `.ng-*` names next to the `hub-select__*` ones so consumer
 * stylesheets written against ng-select keep matching for one release. This pins every pair,
 * so the compatibility layer cannot be dropped by accident.
 */
@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `<hub-select [formControl]="ctrl" [items]="items" [multiple]="true" label="Pick" />`
})
class LegacyClassesHostComponent {
	readonly ctrl = new FormControl<unknown>(['Green']);
	readonly items = ['Red', 'Green', 'Blue'];
}

describe('hub-select legacy .ng-* classes', () => {
	it('emits both the old and the new class on every element', async () => {
		await TestBed.configureTestingModule({
			imports: [LegacyClassesHostComponent],
			providers: [provideHubForms()]
		}).compileComponents();
		const fixture = TestBed.createComponent(LegacyClassesHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();

		const root = fixture.nativeElement as HTMLElement;
		root.querySelector('.hub-select__box')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await fixture.whenStable();
		await new Promise((r) => setTimeout(r, 20));
		fixture.detectChanges();

		const pairs: [string, string][] = [
			['ng-select', 'hub-select__control'],
			['ng-select-multiple', 'hub-select__control--multiple'],
			['ng-select-opened', 'hub-select__control--opened'],
			['ng-select-container', 'hub-select__box'],
			['ng-has-value', 'hub-select__box--has-value'],
			['ng-value-container', 'hub-select__values'],
			['ng-value', 'hub-select__value'],
			['ng-value-label', 'hub-select__value-label'],
			['ng-value-icon', 'hub-select__value-remove'],
			['ng-input', 'hub-select__search'],
			['ng-arrow-wrapper', 'hub-select__arrow-wrapper'],
			['ng-arrow', 'hub-select__arrow'],
			['ng-dropdown-panel', 'hub-select__panel'],
			['ng-dropdown-panel-items', 'hub-select__panel-items'],
			['ng-option', 'hub-select__panel-option'],
			['ng-option-marked', 'hub-select__panel-option--marked'],
			['ng-option-selected', 'hub-select__panel-option--selected'],
			['ng-option-label', 'hub-select__panel-option-label']
		];
		for (const [legacy, current] of pairs) {
			const el = document.querySelector(`.${current}`);
			expect(el, current).not.toBeNull();
			expect(el!.classList.contains(legacy), `${current} also carries ${legacy}`).toBe(true);
		}

		// The placeholder only renders while nothing is selected.
		fixture.componentInstance.ctrl.setValue([]);
		fixture.detectChanges();
		await fixture.whenStable();
		await new Promise((r) => setTimeout(r, 20));
		fixture.detectChanges();
		const placeholder = document.querySelector('.hub-select__placeholder');
		expect(placeholder?.classList.contains('ng-placeholder')).toBe(true);
	});
});
