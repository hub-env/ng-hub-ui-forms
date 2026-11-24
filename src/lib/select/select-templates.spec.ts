import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HubSelectComponent } from './select.component';
import { HubSelectEngineComponent } from './engine/lib/select-engine/select-engine.component';
import { NgLabelTemplateDirective, NgOptionTemplateDirective } from './engine/lib/directives/engine-templates.directive';

/**
 * Verifies that the engine template directives projected through `<hub-select>`
 * (a wrapper that re-projects them via `<ng-content>`) are still picked up by the
 * inner select engine's content queries. This is the contract behind exporting the
 * `Ng*TemplateDirective` set from the public API as a customization passthrough.
 */
@Component({
	standalone: true,
	imports: [HubSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective],
	template: `
		<hub-select [items]="items" bindLabel="name" bindValue="code">
			<ng-template ng-label-tmp let-item="item">L:{{ item.name }}</ng-template>
			<ng-template ng-option-tmp let-item="item">O:{{ item.name }}</ng-template>
		</hub-select>
	`
})
class TemplateHostComponent {
	readonly items = [
		{ code: 'a', name: 'Alpha' },
		{ code: 'b', name: 'Beta' }
	];
}

describe('HubSelectComponent template passthrough', () => {
	it('forwards projected ng-option-tmp / ng-label-tmp to the inner select engine', () => {
		const fixture = TestBed.configureTestingModule({ imports: [TemplateHostComponent] }).createComponent(
			TemplateHostComponent
		);
		fixture.detectChanges();

		const ngSelect = fixture.debugElement.query(By.directive(HubSelectEngineComponent))
			.componentInstance as HubSelectEngineComponent;

		expect(ngSelect.optionTemplate()).toBeTruthy();
		expect(ngSelect.labelTemplate()).toBeTruthy();
	});
});
