import { Component, signal, viewChildren } from '@angular/core';
import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HubScrollToErrorDirective } from './scroll-to-error.directive';

@Component({
	standalone: true,
	imports: [HubScrollToErrorDirective],
	template: `
		<form #form>
			@if (first()) {
				<input id="a" class="hub-field__control--invalid" />
			}
			<input id="ok" />
			<span id="b" class="my-error" tabindex="-1">Missing</span>
			<div class="hub-field">
				<input id="c" class="hub-field__control--invalid" aria-invalid="true" />
				<div class="hub-field__feedback" role="alert">Required</div>
			</div>
		</form>
		<form id="own">
			<input id="d" class="hub-field__control--invalid" />
			<button type="button" hubScrollToError>Next</button>
		</form>
		<button type="button" [hubScrollToError]="form" hubScrollToErrorSelector=".my-error">Save</button>
	`
})
class HostComponent {
	readonly first = signal(true);
	readonly directives = viewChildren(HubScrollToErrorDirective);

	/** The button outside both forms; the one inside `#own` comes first in the page. */
	directive(): HubScrollToErrorDirective {
		return this.directives()[1];
	}
}

describe('HubScrollToErrorDirective', () => {
	let fixture: ComponentFixture<HostComponent>;
	let host: HTMLElement;

	beforeEach(() => {
		TestBed.configureTestingModule({ imports: [HostComponent] });
		fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
		host = fixture.nativeElement;
		document.body.appendChild(host);
		// jsdom draws no layout: give every element a box and a scroll to spy on.
		vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
		Element.prototype.scrollIntoView = vi.fn();
	});

	afterEach(() => {
		host.remove();
		vi.restoreAllMocks();
	});

	it('walks the errors one press at a time and starts again after the last', () => {
		const directive = fixture.componentInstance.directive();

		directive.goToNextError();
		expect(document.activeElement?.id).toBe('a');

		directive.goToNextError();
		expect(document.activeElement?.id).toBe('b');

		directive.goToNextError();
		expect(document.activeElement?.id).toBe('c');

		directive.goToNextError();
		expect(document.activeElement?.id).toBe('a');
	});

	it('walks the form the button belongs to when given nothing', () => {
		fixture.componentInstance.directives()[0].goToNextError();

		expect(document.activeElement?.id).toBe('d');
	});

	it('does nothing when nothing on screen reads as an error', () => {
		fixture.componentInstance.first.set(false);
		fixture.detectChanges();
		host.querySelector('#b')!.classList.remove('my-error');
		host.querySelector('.hub-field')!.remove();

		fixture.componentInstance.directive().goToNextError();

		expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
	});
});
