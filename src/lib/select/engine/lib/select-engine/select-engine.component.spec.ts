// @ts-nocheck
import { ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { getNgSelectNativeElement } from '../../testing/helpers';

import { createTestingModule, NgSelectTestComponent } from '../../testing/select-engine-test-fixtures';
describe('HubSelectEngineComponent', () => {
	const selectTypes = [
		{
			name: 'single',
			classContains: 'hub-select__control--single',
			classNotContains: 'hub-select__control--multiple',
			isMultiple: false
		},
		{
			name: 'multiple',
			classContains: 'hub-select__control--multiple',
			classNotContains: 'hub-select__control--single',
			isMultiple: true
		}
	];

	selectTypes.forEach(({ name, classContains, classNotContains, isMultiple }) => {
		describe(`Check class existence of classes on ${name} select scenario`, () => {
			let fixture: ComponentFixture<NgSelectTestComponent>;
			let componentInstance: NgSelectTestComponent;

			beforeEach(() => {
				fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [typeahead]="typeahead"
						[multiple]="${isMultiple}"
						[clearable]="clearable"
						[searchable]="searchable"
						[readonly]="readonly"
						[addTag]="addTag" />`
				);
				componentInstance = fixture.componentInstance;
				fixture.detectChanges();

				// set default values
				componentInstance.searchable = false;
				componentInstance.clearable = false;
				fixture.detectChanges();
			});

			it('should have ng-select class on host element', () => {
				const ngSelectEl = getNgSelectNativeElement(fixture);
				expect(ngSelectEl.classList.contains('hub-select__control')).toBe(true);
				expect(ngSelectEl.classList.contains(classContains)).toBe(true);

				expect(ngSelectEl.classList.contains(classNotContains)).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--typeahead')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--taggable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--searchable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--clearable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--opened')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--filtered')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--disabled')).toBe(false);
			});

			it('should have ng-select-typeahead class when typeahead is true', () => {
				componentInstance.typeahead = true;
				fixture.detectChanges();

				const ngSelectEl = getNgSelectNativeElement(fixture);
				expect(ngSelectEl.classList.contains('hub-select__control')).toBe(true);
				expect(ngSelectEl.classList.contains('hub-select__control--typeahead')).toBe(true);
				expect(ngSelectEl.classList.contains(classContains)).toBe(true);

				expect(ngSelectEl.classList.contains(classNotContains)).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--taggable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--searchable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--clearable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--opened')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--filtered')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--disabled')).toBe(false);
			});

			it('should have appropriate ng-select-typeahead when taggable is true', () => {
				componentInstance.addTag = () => 'new tag';
				fixture.detectChanges();

				const ngSelectEl = getNgSelectNativeElement(fixture);
				expect(ngSelectEl.classList.contains('hub-select__control')).toBe(true);
				expect(ngSelectEl.classList.contains('hub-select__control--taggable')).toBe(true);
				expect(ngSelectEl.classList.contains(classContains)).toBe(true);

				expect(ngSelectEl.classList.contains(classNotContains)).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--typeahead')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--searchable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--clearable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--opened')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--filtered')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--disabled')).toBe(false);
			});

			it('should have appropriate ng-select-typeahead when searchable is true', () => {
				componentInstance.searchable = true;
				fixture.detectChanges();

				const ngSelectEl = getNgSelectNativeElement(fixture);
				expect(ngSelectEl.classList.contains('hub-select__control')).toBe(true);
				expect(ngSelectEl.classList.contains('hub-select__control--searchable')).toBe(true);
				expect(ngSelectEl.classList.contains(classContains)).toBe(true);

				expect(ngSelectEl.classList.contains(classNotContains)).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--typeahead')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--taggable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--clearable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--opened')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--filtered')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--disabled')).toBe(false);
			});

			it('should have appropriate ng-select-typeahead when clearable is true', () => {
				componentInstance.clearable = true;
				fixture.detectChanges();

				const ngSelectEl = getNgSelectNativeElement(fixture);
				expect(ngSelectEl.classList.contains('hub-select__control')).toBe(true);
				expect(ngSelectEl.classList.contains('hub-select__control--clearable')).toBe(true);
				expect(ngSelectEl.classList.contains(classContains)).toBe(true);

				expect(ngSelectEl.classList.contains(classNotContains)).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--typeahead')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--taggable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--searchable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--opened')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--filtered')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--disabled')).toBe(false);
			});

			it('should have appropriate ng-select-typeahead when disabled is true', () => {
				componentInstance.readonly = true;
				fixture.detectChanges();

				const ngSelectEl = getNgSelectNativeElement(fixture);
				expect(ngSelectEl.classList.contains('hub-select__control')).toBe(true);
				expect(ngSelectEl.classList.contains('hub-select__control--disabled')).toBe(true);
				expect(ngSelectEl.classList.contains(classContains)).toBe(true);

				expect(ngSelectEl.classList.contains(classNotContains)).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--typeahead')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--taggable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--searchable')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--opened')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--filtered')).toBe(false);
				expect(ngSelectEl.classList.contains('hub-select__control--clearable')).toBe(false);
			});
		});
	});
});
