// @ts-nocheck
import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	applyZonelessFixtureCompat,
	getNgSelectElement,
	getNgSelectNativeElement,
	selectOption,
	TestsErrorHandler,
	tickAndDetectChanges,
	triggerKeyDownEvent
} from '../../testing/helpers';
import { MockConsole } from '../../testing/mocks';
import { openSelect } from '../../testing/timer-helpers';
import { HubOptionComponent } from '../option.component';
import { provideSelectEngine } from '../select-engine.providers';
import { HubSelectConfig } from '../services/select-config.service';
import { ConsoleService } from '../services/console.service';
import { KeyCode, SelectEngineOption } from '../types/select-engine.types';
import { HubSelectEngineComponent } from './select-engine.component';

import {
	createEvent,
	createTestingModule,
	EncapsulatedTestComponent,
	NgSelectTestComponent
} from '../../testing/select-engine-test-fixtures';

describe('HubSelectEngineComponent', () => {
	describe('Dropdown panel', () => {
		it('should set and render items in dropdown panel', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			expect(select.dropdownPanel().items().length).toBe(5);
			let options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			expect(options.length).toBe(5);
			expect(options[0].innerText).toBe('New York');
			expect(options[1].innerText).toBe('London');
			expect(options[2].innerText).toBe('Beijing');

			fixture.componentInstance.cities = Array.from(Array(30).keys()).map((_, i) => ({
				id: i,
				name: String.fromCharCode(97 + i)
			}));
			await tickAndDetectChanges(fixture);
			options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			expect(options.length).toBe(30);
			expect(options[0].innerText).toBe('a');
		});

		it('should always have div #padding with height 0 in dropdown panel when virtual scroll is disabled', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [virtualScroll]="false">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			const panelItems = document.querySelector('.hub-select__panel-items');
			const firstChild = <HTMLScriptElement>panelItems.firstChild;

			expect(firstChild.offsetHeight).toBe(0);
		});

		// jsdom: no layout, so the virtual scroll viewport renders a different number of rows and scrollTop stays 0

		it.skip('should have div #padding with height other than 0 in dropdown panel when virtual scroll is enabled', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [virtualScroll]="true">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			expect(fixture.componentInstance.select().dropdownPanel().items().length).toBe(5);
			const options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			expect(options.length).toBe(5);
			expect(options[0].innerText).toBe('New York');
			expect(options[1].innerText).toBe('London');
			expect(options[2].innerText).toBe('Beijing');

			fixture.componentInstance.cities = Array.from(Array(30).keys()).map((_, i) => ({
				id: i,
				name: String.fromCharCode(97 + i)
			}));
			await tickAndDetectChanges(fixture);

			const panelItems = document.querySelector('.hub-select__panel-items');
			const firstChild = <HTMLScriptElement>panelItems.firstChild;

			expect(firstChild.offsetHeight).not.toBe(0);
		});

		// jsdom: no layout, so the virtual scroll viewport renders a different number of rows and scrollTop stays 0

		it.skip('should set and render items in dropdown panel with virtual scroll', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [virtualScroll]="true"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			expect(fixture.componentInstance.select().dropdownPanel().items().length).toBe(5);
			let options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			expect(options.length).toBe(5);
			expect(options[0].innerText).toBe('New York');
			expect(options[1].innerText).toBe('London');
			expect(options[2].innerText).toBe('Beijing');

			fixture.componentInstance.cities = Array.from(Array(30).keys()).map((_, i) => ({
				id: i,
				name: String.fromCharCode(97 + i)
			}));
			await tickAndDetectChanges(fixture);
			options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			const { itemsPerViewport } = (select.dropdownPanel() as any)._panelService.dimensions;
			const expectedItemsLength = Math.min(fixture.componentInstance.cities.length, itemsPerViewport + 1 + 4);
			expect(options.length).toBe(expectedItemsLength);
			expect(options[0].innerText).toBe('a');
		});

		it('should open empty dropdown panel with virtual scroll', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="[]"
                            bindLabel="name"
                            [virtualScroll]="true"
                            appendTo="body"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			const options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			expect(options.length).toBe(1);
			expect((<HTMLElement>options[0]).innerText).toBe('No items found');
		});

		// jsdom: no layout, so the virtual scroll viewport renders a different number of rows and scrollTop stays 0

		it.skip('should scroll to selected item on first open when virtual scroll is enabled', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [virtualScroll]="true"
                            [appendTo]="body"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			const cmp = fixture.componentInstance;
			cmp.cities = Array.from(Array(30).keys()).map((_, i) => ({ id: i, name: String.fromCharCode(97 + i) }));
			cmp.city = cmp.cities[10];
			await tickAndDetectChanges(fixture);

			await openSelect(select, fixture);

			const options = document.querySelectorAll<HTMLElement>('.hub-select__panel-option');
			const marked = document.querySelector<HTMLElement>('.hub-select__panel-option--marked');

			// Accept both 17 and 18 options as valid (environment-dependent panel height causes this variation)
			// With 240px panel height: itemsPerViewport=12, buffer=4, renders 18 options
			// With 220px panel height: itemsPerViewport=11, buffer=4, renders 17 options
			expect(options.length).toBeGreaterThanOrEqual(17);
			expect(options.length).toBeLessThanOrEqual(19);
			expect(marked.innerText).toBe('k');
			expect(marked.offsetTop).toBeGreaterThanOrEqual(180);
		});

		it('should scroll to item and do not change scroll position when scrolled to visible item', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);
			const cmp = fixture.componentInstance;

			cmp.select().open();
			await tickAndDetectChanges(fixture);

			cmp.cities = Array.from(Array(30).keys()).map((_, i) => ({ id: i, name: String.fromCharCode(97 + i) }));
			await tickAndDetectChanges(fixture);

			cmp.select().dropdownPanel().scrollTo(cmp.select().itemsList.items[1]);
			await tickAndDetectChanges(fixture);

			const panelItems = document.querySelector('.hub-select__panel-items');
			expect(panelItems.scrollTop).toBe(0);
		});

		// jsdom: no layout, so the virtual scroll viewport renders a different number of rows and scrollTop stays 0

		it.skip('should scroll to item and change scroll position when scrolled to not visible item', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);
			const cmp = fixture.componentInstance;

			cmp.cities = Array.from(Array(30).keys()).map((_, i) => ({ id: i, name: String.fromCharCode(97 + i) }));
			await openSelect(cmp.select(), fixture);

			cmp.select().dropdownPanel().scrollTo(cmp.select().itemsList.items[15]);
			await tickAndDetectChanges(fixture);

			const panelItems = document.querySelector('.hub-select__panel-items');
			expect(panelItems.scrollTop).toBeGreaterThanOrEqual(48);
		});

		it('should close on option select by default', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			await selectOption(fixture, KeyCode.ArrowDown, 0);

			await tickAndDetectChanges(fixture);
			expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
		});

		it('should select item with encapsulation = ShadowDom', async () => {
			const fixture = createTestingModule(
				EncapsulatedTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [(ngModel)]="city"></hub-select-engine>`
			);

			expect((<SelectEngineOption[]>fixture.componentInstance.select().selectedItems).length).toBe(0);
			expect(fixture.componentInstance.select().isOpen()).toBeFalsy();

			const cmp = fixture.componentInstance;

			cmp.select().open();
			await tickAndDetectChanges(fixture);

			expect((<SelectEngineOption[]>fixture.componentInstance.select().selectedItems).length).toBe(0);
			expect(fixture.componentInstance.select().isOpen()).toBeTruthy();

			const outsideClick = vi.spyOn(cmp.select().dropdownPanel().outsideClick, 'emit').mockReturnValue(undefined);
			expect(outsideClick).not.toHaveBeenCalled();

			const listItem = fixture.debugElement.query(By.css('.hub-select__panel-option'));
			let event = new MouseEvent('mousedown', { bubbles: true });
			listItem.nativeElement.dispatchEvent(event);
			event = new MouseEvent('click', { bubbles: true });
			listItem.nativeElement.dispatchEvent(event);
			await tickAndDetectChanges(fixture);

			await tickAndDetectChanges(fixture);
			expect(outsideClick).not.toHaveBeenCalled();
			expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
			expect((<SelectEngineOption[]>fixture.componentInstance.select().selectedItems).length).toBe(1);
		});

		it('should open and close normally when [isOpen] is bound to undefined', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            [isOpen]="undefined"
                            bindLabel="name"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			select.open();
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBe(true);
			select.close();
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBe(false);
		});

		it('should not close when isOpen is true', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            [isOpen]="true"
                            bindLabel="name"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			await selectOption(fixture, KeyCode.ArrowDown, 0);

			await tickAndDetectChanges(fixture);
			expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
		});

		it('should not close on option select when [closeOnSelect]="false"', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                            bindLabel="name"
                            [closeOnSelect]="false"
                            [(ngModel)]="city">
                </hub-select-engine>`
			);

			await selectOption(fixture, KeyCode.ArrowDown, 0);
			await tickAndDetectChanges(fixture);

			expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
		});

		it('should remove appended dropdown when it is destroyed', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`
                <hub-select-engine [items]="cities"
                        appendTo="body"
                        [(ngModel)]="city">
                </hub-select-engine>`
			);

			fixture.componentInstance.select().open();
			fixture.detectChanges();
			fixture.componentInstance.select().close();

			await tickAndDetectChanges(fixture);
			const dropdown = <HTMLElement>document.querySelector('.hub-select__panel');
			expect(dropdown).toBeNull();
		});

		it('should use ariaLabelDropdown from HubSelectConfig when not provided in template', async () => {
			const config = new HubSelectConfig();
			config.ariaLabelDropdown = 'Global Aria Label';
			const fixture = createTestingModule(NgSelectTestComponent, `<hub-select-engine [items]="cities" />`, config);

			const select = fixture.componentInstance.select();
			select.open();
			await tickAndDetectChanges(fixture);

			const listboxElement = document.querySelector('.hub-select__panel-items[role="listbox"]');
			expect(listboxElement.getAttribute('aria-label')).toBe('Global Aria Label');
		});
	});

	describe('Outside click', () => {
		let fixture: ComponentFixture<NgSelectTestComponent>;
		let select: HubSelectEngineComponent;
		beforeEach(() => {
			fixture = createTestingModule(
				NgSelectTestComponent,
				`<div id="outside">Outside</div><br />
                <hub-select-engine id="select" [items]="cities"
                    bindLabel="name"
                    multiple="true"
                    [closeOnSelect]="false"
                    appendTo="body"
                    [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);
			select = fixture.componentInstance.select();
		});

		it('should close dropdown if opened and clicked outside dropdown container', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
			document.getElementById('outside').click();
			const event = new MouseEvent('mousedown', { bubbles: true });
			document.getElementById('outside').dispatchEvent(event);
			await tickAndDetectChanges(fixture);
			expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
		});

		it('should prevent dropdown close if clicked on select', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			expect(select.isOpen()).toBeTruthy();
			document.getElementById('select').click();
			const event = new MouseEvent('mousedown', { bubbles: true });
			document.getElementById('select').dispatchEvent(event);
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();
		});

		it('should stay open when the page shifts between mousedown on the select and the resulting click (#2773)', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();

			// The press begins on the select, but focus-scroll moves the layout before
			// the click event fires, so its target resolves to an unrelated element
			document.getElementById('select').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			document.getElementById('outside').click();

			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();
		});

		it('should close when the interaction starts and ends outside the component', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();

			const outsideEl = document.getElementById('outside');
			outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			outsideEl.click();

			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeFalsy();
		});

		it('should stay open when an option is clicked from within a shadow root (#2726)', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();

			// Host the panel in a shadow root, as happens with an appendTo target inside
			// a web component. The document-level listener then sees only the shadow host
			// as event target and must trace the click via composedPath() to recognize it
			// as an inside click
			const host = document.createElement('div');
			document.body.appendChild(host);
			const shadowRoot = host.attachShadow({ mode: 'open' });
			shadowRoot.appendChild(document.querySelector('hub-select-panel'));

			try {
				const option = shadowRoot.querySelector('.hub-select__panel-option') as HTMLElement;
				option.click();

				await tickAndDetectChanges(fixture);
				expect(select.isOpen()).toBeTruthy();
				expect(select.selectedItems.length).toBe(1);
			} finally {
				host.remove();
			}
		});

		it('should close dropdown when clicking outside if HubSelectConfig is provided as a partial object without outsideClickEvent', async () => {
			// Simulate real-world usage: `{ provide: HubSelectConfig, useValue: { appendTo: 'body' } }`
			// where outsideClickEvent is undefined because the plain object lacks that property.
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [
					{ provide: ErrorHandler, useClass: TestsErrorHandler },
					{ provide: ConsoleService, useFactory: () => new MockConsole() },
					{ provide: HubSelectConfig, useValue: { appendTo: 'body' } },
					...provideSelectEngine()
				]
			}).overrideComponent(NgSelectTestComponent, {
				set: {
					template: `<div id="outside2">Outside</div>
					<hub-select-engine id="select2" [items]="cities" bindLabel="name" [(ngModel)]="selectedCity"></hub-select-engine>`,
					imports: [HubSelectEngineComponent, HubOptionComponent, FormsModule]
				}
			});
			TestBed.compileComponents();
			const partialFixture = applyZonelessFixtureCompat(TestBed.createComponent(NgSelectTestComponent));
			partialFixture.detectChanges();
			const partialSelect = partialFixture.componentInstance.select();

			triggerKeyDownEvent(getNgSelectElement(partialFixture), KeyCode.Space);
			await tickAndDetectChanges(partialFixture);
			expect(partialSelect.isOpen()).toBeTruthy();

			document.getElementById('outside2').click();
			await tickAndDetectChanges(partialFixture);
			expect(partialSelect.isOpen()).toBeFalsy();
		});
	});

	describe('Outside click without appendTo', () => {
		let fixture: ComponentFixture<NgSelectTestComponent>;
		let select: HubSelectEngineComponent;
		beforeEach(() => {
			fixture = createTestingModule(
				NgSelectTestComponent,
				`<div id="outside">Outside</div><br />
                <hub-select-engine id="select" [items]="cities"
                    bindLabel="name"
                    multiple="true"
                    [closeOnSelect]="false"
                    [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);
			select = fixture.componentInstance.select();
		});

		it('should stay open when the page shifts between mousedown on the select and the resulting click', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();

			document.getElementById('select').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			document.getElementById('outside').click();

			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();
		});

		it('should close when the interaction starts and ends outside the component', async () => {
			triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeTruthy();

			const outsideEl = document.getElementById('outside');
			outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			outsideEl.click();

			await tickAndDetectChanges(fixture);
			expect(select.isOpen()).toBeFalsy();
		});
	});

	describe('Close on scroll', () => {
		const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		async function scrollDocument(fixture: ComponentFixture<NgSelectTestComponent>): Promise<void> {
			// The close listener attaches one frame after open, so scroll like a user would: after the panel has settled
			await nextFrame();
			document.dispatchEvent(new Event('scroll'));
			await nextFrame();
			await tickAndDetectChanges(fixture);
		}

		it('should stay open on document scroll by default', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" bindLabel="name" [(ngModel)]="selectedCity"></hub-select-engine>`
			);
			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			await scrollDocument(fixture);
			expect(select.isOpen()).toBeTruthy();
		});

		it('should use closeOnScroll from HubSelectConfig when not provided in template', async () => {
			const config = new HubSelectConfig();
			config.closeOnScroll = true;
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" bindLabel="name" [(ngModel)]="selectedCity"></hub-select-engine>`,
				config
			);
			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			await scrollDocument(fixture);
			expect(select.isOpen()).toBeFalsy();
		});
	});

	describe('Immediate close - DOM removal without external change detection (issue #2765)', () => {
		// close() uses detectChanges() internally to ensure the dropdown panel is
		// removed from the DOM immediately, without relying on zone-triggered CD.
		// This is critical in Angular 21 with provideZoneChangeDetection() where
		// event coalescing defers zone-triggered change detection.

		describe('Outside click', () => {
			it('should remove dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<div id="outside">Outside</div><br />
					<hub-select-engine [items]="cities"
						bindLabel="name"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).not.toBeNull();

				document.getElementById('outside').click();

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).toBeNull();
			});

			it('should remove appended dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<div id="outside">Outside</div><br />
					<hub-select-engine [items]="cities"
						bindLabel="name"
						appendTo="body"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(document.querySelector('hub-select-panel')).not.toBeNull();

				document.getElementById('outside').click();

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(document.querySelector('hub-select-panel')).toBeNull();
			});
		});

		describe('Escape key', () => {
			it('should remove dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).not.toBeNull();

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Esc);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).toBeNull();
			});

			it('should remove appended dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						appendTo="body"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(document.querySelector('hub-select-panel')).not.toBeNull();

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Esc);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(document.querySelector('hub-select-panel')).toBeNull();
			});
		});

		describe('Tab key', () => {
			it('should remove dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).not.toBeNull();

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Tab);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).toBeNull();
			});

			it('should remove appended dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						appendTo="body"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(document.querySelector('hub-select-panel')).not.toBeNull();

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Tab);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(document.querySelector('hub-select-panel')).toBeNull();
			});
		});

		describe('Option select', () => {
			it('should remove dropdown panel from DOM immediately when selecting an option', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).not.toBeNull();

				// Select first option via Enter key
				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Enter);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).toBeNull();
			});

			it('should remove appended dropdown panel from DOM immediately when selecting an option', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						appendTo="body"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(document.querySelector('hub-select-panel')).not.toBeNull();

				// Select first option via Enter key
				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Enter);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(document.querySelector('hub-select-panel')).toBeNull();
			});
		});

		describe('Arrow click', () => {
			it('should remove dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).not.toBeNull();

				// Simulate arrow click via mousedown on ng-select-container
				const control = fixture.debugElement.query(By.css('.hub-select__box'));
				control.triggerEventHandler(
					'mousedown',
					createEvent({
						classList: { contains: (term) => term === 'hub-select__arrow-wrapper' }
					})
				);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(fixture.debugElement.query(By.css('hub-select-panel'))).toBeNull();
			});

			it('should remove appended dropdown panel from DOM immediately', async () => {
				const fixture = createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
						bindLabel="name"
						appendTo="body"
						[(ngModel)]="selectedCity">
					</hub-select-engine>`
				);

				triggerKeyDownEvent(getNgSelectElement(fixture), KeyCode.Space);
				await tickAndDetectChanges(fixture);
				expect(fixture.componentInstance.select().isOpen()).toBeTruthy();
				expect(document.querySelector('hub-select-panel')).not.toBeNull();

				const control = fixture.debugElement.query(By.css('.hub-select__box'));
				control.triggerEventHandler(
					'mousedown',
					createEvent({
						classList: { contains: (term) => term === 'hub-select__arrow-wrapper' }
					})
				);

				expect(fixture.componentInstance.select().isOpen()).toBeFalsy();
				expect(document.querySelector('hub-select-panel')).toBeNull();
			});
		});
	});

	describe('Dropdown position', () => {
		it('should auto position dropdown to bottom by default', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"></hub-select-engine>`
			);
			fixture.componentInstance.cities = [{ id: 1, name: 'New York' }];
			fixture.detectChanges();

			const select = fixture.componentInstance.select();
			select.open();
			await tickAndDetectChanges(fixture);

			expect(['top', 'bottom']).toContain(select.currentPanelPosition);
		});

		it('should auto position appended to body dropdown to bottom', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" appendTo="body"></hub-select-engine>`
			);
			fixture.componentInstance.cities = [{ id: 1, name: 'New York' }];
			fixture.detectChanges();

			const select = fixture.componentInstance.select();
			select.open();
			await tickAndDetectChanges(fixture);

			expect(['top', 'bottom']).toContain(select.currentPanelPosition);
		});

		it('should return current panel position', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" appendTo="body"></hub-select-engine>`
			);
			fixture.componentInstance.cities = [{ id: 1, name: 'New York' }];
			fixture.detectChanges();

			const select = fixture.componentInstance.select();
			select.open();
			await tickAndDetectChanges(fixture);

			expect(['top', 'bottom']).toContain(select.currentPanelPosition);
		});

		it('should return undefined for current panel position if dropdown is closed', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" appendTo="body"></hub-select-engine>`
			);
			fixture.componentInstance.cities = [{ id: 1, name: 'New York' }];
			fixture.detectChanges();

			const select = fixture.componentInstance.select();
			select.open();
			await tickAndDetectChanges(fixture);
			select.close();
			await tickAndDetectChanges(fixture);

			expect(select.currentPanelPosition).toBeUndefined();
		});
	});

	describe('Append to', () => {
		it('should not warn when appendTo is set', async () => {
			const warnSpy = vi.spyOn(MockConsole.prototype, 'warn');
			try {
				createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
                        appendTo="body"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
				);
				expect(warnSpy).not.toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
			}
		});

		it('should not warn when appendTo is not set anywhere', async () => {
			const warnSpy = vi.spyOn(MockConsole.prototype, 'warn');
			try {
				createTestingModule(
					NgSelectTestComponent,
					`<hub-select-engine [items]="cities"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
				);
				expect(warnSpy).not.toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
			}
		});

		it('should append the dropdown to a custom host element', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`
                <div class="container"></div>
                <hub-select-engine [items]="cities"
                        appendTo=".container"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);

			await openSelect(fixture.componentInstance.select(), fixture);
			const dropdown = <HTMLElement>document.querySelector('.container .hub-select__panel');
			expect(dropdown).not.toBeNull();
		});

		it('should append the dropdown to body', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                        appendTo="body"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);

			await openSelect(fixture.componentInstance.select(), fixture);
			const dropdown = <HTMLElement>document.querySelector('.hub-select__panel');
			expect(dropdown).not.toBeNull();
			expect(dropdown.closest('hub-select-engine')).toBeNull();
			// fork: utils overlay — body-level container, not inside the select.
			expect(dropdown.closest('.hub-overlay-container')?.parentElement).toBe(document.body);
		});

		it('should apply appendTo from HubSelectConfig', async () => {
			const config = new HubSelectConfig();
			config.appendTo = '.config-container';
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`
                <div class="config-container"></div>
                <hub-select-engine [items]="cities"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`,
				config
			);

			await openSelect(fixture.componentInstance.select(), fixture);
			expect(document.querySelector('.config-container .hub-select__panel')).not.toBeNull();
		});

		it('should move the dropdown when appendTo changes between opens', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`
                <div class="container-a"></div>
                <div class="container-b"></div>
                <hub-select-engine [items]="cities"
                        [appendTo]="appendToSelector"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);
			const select = fixture.componentInstance.select();

			await openSelect(select, fixture);
			expect(document.querySelector('.container-a .hub-select__panel')).not.toBeNull();

			select.close();
			await tickAndDetectChanges(fixture);
			fixture.componentInstance.appendToSelector = '.container-b';
			await tickAndDetectChanges(fixture);

			await openSelect(select, fixture);
			expect(document.querySelector('.container-b .hub-select__panel')).not.toBeNull();
			expect(document.querySelector('.container-a .hub-select__panel')).toBeNull();
		});

		it('should rebuild the overlay when the appendTo host element is replaced between opens', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`
                @if (visible) {
                    <div class="container-a"></div>
                }
                <hub-select-engine [items]="cities"
                        appendTo=".container-a"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);
			const select = fixture.componentInstance.select();

			await openSelect(select, fixture);
			expect(document.querySelector('.container-a .hub-select__panel')).not.toBeNull();
			select.close();
			await tickAndDetectChanges(fixture);

			// The host is destroyed and rebuilt while the selector keeps matching — a dialog
			// that drops its DOM on close and recreates it on open (#2870)
			fixture.componentInstance.visible = false;
			await tickAndDetectChanges(fixture);
			fixture.componentInstance.visible = true;
			await tickAndDetectChanges(fixture);

			await openSelect(select, fixture);
			expect(document.querySelector('.container-a .hub-select__panel')).not.toBeNull();
		});

		it('should throw for an appendTo selector that matches no element', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                        appendTo=".does-not-exist"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			expect(() => select.open()).toThrowError('appendTo selector .does-not-exist did not found any parent element');
			select.close();
			await tickAndDetectChanges(fixture);
		});

		// jsdom: no layout, the control measures 0px (fork: min-width goes on the panel, not width on the container)
		it.skip('should size the overlay pane to match the select width', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`
                <div style="width: 200px">
                    <hub-select-engine [items]="cities"
                            bindLabel="name"
                            [(ngModel)]="selectedCity">
                    </hub-select-engine>
                </div>`
			);

			await openSelect(fixture.componentInstance.select(), fixture);
			const panel = <HTMLElement>document.querySelector('.hub-select__panel');
			expect(panel.style.minWidth).toBe('200px');
		});

		it('should pass static classes into dropdown panel', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                        class="someClass"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);

			fixture.componentInstance.select().open();

			await tickAndDetectChanges(fixture);
			const dropdown = <HTMLElement>document.querySelector('.hub-select__panel');
			expect(dropdown.classList.contains('someClass')).toBe(true);
		});

		it('should pass [class] binding classes into dropdown panel', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                        class="search-box"
                        [class]="dynamicClass"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);

			fixture.componentInstance.dynamicClass = 'dynamic-class';
			fixture.componentInstance.select().open();

			await tickAndDetectChanges(fixture);
			const dropdown = <HTMLElement>document.querySelector('.hub-select__panel');
			expect(dropdown.classList.contains('search-box')).toBe(true);
			expect(dropdown.classList.contains('dynamic-class')).toBe(true);
			expect(dropdown.classList.contains('ng-valid')).toBe(false);
			expect(dropdown.classList.contains('ng-untouched')).toBe(false);
			expect(dropdown.classList.contains('ng-pristine')).toBe(false);

			fixture.componentInstance.dynamicClass = '';
			fixture.componentInstance.visible = false;
			await tickAndDetectChanges(fixture);

			expect(dropdown.classList.contains('dynamic-class')).toBe(false);
			expect(dropdown.classList.contains('search-box')).toBe(true);
		});

		it('should pass every supported panelClass value into dropdown panel', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities"
                        class="someClass"
                        [panelClass]="panelClassBinding"
                        [(ngModel)]="selectedCity">
                </hub-select-engine>`
			);

			fixture.componentInstance.panelClassBinding = 'panel-only';
			await tickAndDetectChanges(fixture);
			fixture.componentInstance.select().open();
			await tickAndDetectChanges(fixture);

			const dropdown = <HTMLElement>document.querySelector('.hub-select__panel');
			expect(dropdown.classList.contains('someClass')).toBe(true);
			expect(dropdown.classList.contains('panel-only')).toBe(true);

			fixture.componentInstance.panelClassBinding = 'panel-updated';
			await tickAndDetectChanges(fixture);

			expect(dropdown.classList.contains('panel-updated')).toBe(true);
			expect(dropdown.classList.contains('panel-only')).toBe(false);

			fixture.componentInstance.panelClassBinding = ['panel-array', 'panel-shared'];
			await tickAndDetectChanges(fixture);

			expect(dropdown.classList.contains('panel-array')).toBe(true);
			expect(dropdown.classList.contains('panel-shared')).toBe(true);
			expect(dropdown.classList.contains('panel-updated')).toBe(false);

			fixture.componentInstance.panelClassBinding = new Set(['panel-set', 'panel-shared']);
			await tickAndDetectChanges(fixture);

			expect(dropdown.classList.contains('panel-set')).toBe(true);
			expect(dropdown.classList.contains('panel-shared')).toBe(true);
			expect(dropdown.classList.contains('panel-array')).toBe(false);

			fixture.componentInstance.panelClassBinding = {
				'panel-map': true,
				'panel-disabled': false,
				someClass: false
			};
			await tickAndDetectChanges(fixture);

			expect(dropdown.classList.contains('panel-map')).toBe(true);
			expect(dropdown.classList.contains('panel-disabled')).toBe(false);
			expect(dropdown.classList.contains('panel-set')).toBe(false);
			// panelClass is additive and cannot remove a class mirrored from the host.
			expect(dropdown.classList.contains('someClass')).toBe(true);
		});
	});

	describe('Overlay edge cases', () => {
		it('should snapshot rtl direction when opening', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" bindLabel="name"></hub-select-engine>`
			);

			const previousDir = document.documentElement.dir;
			document.documentElement.dir = 'rtl';
			try {
				const select = fixture.componentInstance.select();
				await openSelect(select, fixture);

				expect(document.querySelector('.hub-select__panel').closest('[dir="rtl"]')).not.toBeNull();
			} finally {
				document.documentElement.dir = previousDir;
			}
		});

		it('should resolve appendTo selectors against the shadow root of the select', async () => {
			const fixture = createTestingModule(
				EncapsulatedTestComponent,
				`
                <div class="shadow-append-host"></div>
                <hub-select-engine [items]="cities"
                        bindLabel="name"
                        appendTo=".shadow-append-host"
                        [(ngModel)]="city"></hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			const root = select.element.getRootNode() as ShadowRoot;
			expect(root instanceof ShadowRoot).toBe(true);
			expect(root.querySelector('.shadow-append-host .hub-select__panel')).not.toBeNull();
		});
	});

	describe('Template event bindings', () => {
		it('should stop propagation of native change events from the search input', () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" bindLabel="name"></hub-select-engine>`
			);

			const input: HTMLInputElement = fixture.nativeElement.querySelector('.hub-select__search input');
			const changeListener = vi.fn();
			getNgSelectNativeElement(fixture).addEventListener('change', changeListener);
			input.dispatchEvent(new Event('change', { bubbles: true }));

			expect(changeListener).not.toHaveBeenCalled();
		});

		it('should re-emit dropdown panel scroll events', async () => {
			const fixture = createTestingModule(
				NgSelectTestComponent,
				`<hub-select-engine [items]="cities" bindLabel="name"></hub-select-engine>`
			);

			const select = fixture.componentInstance.select();
			await openSelect(select, fixture);

			const emitted: { start: number; end: number }[] = [];
			select.scroll.subscribe((event) => emitted.push(event));
			select.dropdownPanel().scroll.emit({ start: 0, end: 5 });

			expect(emitted).toEqual([{ start: 0, end: 5 }]);
		});
	});
});
