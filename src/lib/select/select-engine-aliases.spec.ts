import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HubOptionComponent, HubSelectConfig, NgOptionComponent, NgSelectConfig } from '../../public-api';
import { HubSelectEngineComponent } from './engine/lib/select-engine/select-engine.component';

/** The old names must stay the same classes, or a consumer providing `NgSelectConfig` would configure nothing. */
@Component({
	template: `
		<hub-select-engine>
			<hub-option [value]="1">One</hub-option>
			<ng-option [value]="2">Two</ng-option>
		</hub-select-engine>
	`,
	imports: [HubSelectEngineComponent, HubOptionComponent]
})
class OptionTagsHostComponent {}

describe('deprecated select engine names', () => {
	it('exports the old config and option names as the same classes', () => {
		expect(NgSelectConfig).toBe(HubSelectConfig);
		expect(NgOptionComponent).toBe(HubOptionComponent);
	});

	it('configures the engine through a provided NgSelectConfig', () => {
		const config = new NgSelectConfig();
		config.notFoundText = 'Nothing here';
		TestBed.configureTestingModule({ providers: [{ provide: NgSelectConfig, useValue: config }] });
		expect(TestBed.inject(HubSelectConfig).notFoundText).toBe('Nothing here');
	});

	it('reads options from both <hub-option> and <ng-option>', async () => {
		const fixture = TestBed.createComponent(OptionTagsHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		const engine = fixture.debugElement.children[0].componentInstance as HubSelectEngineComponent;
		expect(engine.itemsList.items.map((item) => item.value)).toEqual([1, 2]);
	});
});
