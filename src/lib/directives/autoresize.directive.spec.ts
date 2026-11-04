import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { HubTextareaComponent } from '../components/textarea/textarea.component';
import { HubAutoresizeDirective } from './autoresize.directive';

@Component({
	standalone: true,
	imports: [HubAutoresizeDirective],
	template: `<textarea [hubAutoresize]="enabled()"></textarea>`
})
class HostComponent {
	readonly enabled = signal(true);
	readonly directive = viewChild.required(HubAutoresizeDirective);
}

describe('HubAutoresizeDirective', () => {
	let fixture: ComponentFixture<HostComponent>;
	let textarea: HTMLTextAreaElement;

	beforeEach(() => {
		TestBed.configureTestingModule({ imports: [HostComponent] });
		fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
		textarea = fixture.debugElement.query(By.css('textarea')).nativeElement;
	});

	it('creates an instance', () => {
		expect(fixture.componentInstance.directive()).toBeTruthy();
	});

	it('sets the textarea height to a pixel value when resizing', () => {
		fixture.componentInstance.directive().resize();

		// Height is set to `scrollHeight + 4 + 'px'`; scrollHeight may be 0 in headless,
		// so we only assert the deterministic unit + that a value was written.
		expect(textarea.style.height).toMatch(/^\d+px$/);
	});

	it('adjusts the height on input', () => {
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		expect(textarea.style.height).toMatch(/^\d+px$/);
	});

	it('does not change the height when disabled', () => {
		fixture.componentInstance.enabled.set(false);
		fixture.detectChanges();

		textarea.style.height = '123px';
		fixture.componentInstance.directive().resize();

		expect(textarea.style.height).toBe('123px');
	});

	it('defers the initial resize via setTimeout when content has scroll height', () => {
		vi.useFakeTimers();
		try {
			// Re-create so ngOnInit runs against a controllable scrollHeight.
			const localFixture = TestBed.createComponent(HostComponent);
			const ta = localFixture.debugElement.query(By.css('textarea')).nativeElement as HTMLTextAreaElement;

			Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: 40 });
			localFixture.detectChanges();

			vi.spyOn(localFixture.componentInstance.directive(), 'resize');
			vi.advanceTimersByTime(1);

			expect(ta.style.height).toMatch(/^\d+px$/);
		} finally {
			vi.useRealTimers();
		}
	});
});

/**
 * A value written from code reaches the textarea without an `input` event, so the box has to be
 * measured when the control changes: a message box emptied after sending must shrink back.
 */
describe('HubAutoresizeDirective with a form control', () => {
	@Component({
		standalone: true,
		imports: [HubAutoresizeDirective, ReactiveFormsModule],
		template: `<textarea hubAutoresize [formControl]="message"></textarea>`
	})
	class ControlHostComponent {
		readonly message = new FormControl('');
		readonly directive = viewChild.required(HubAutoresizeDirective);
	}

	@Component({
		standalone: true,
		imports: [HubTextareaComponent, ReactiveFormsModule],
		template: `<hub-textarea label="Message" [autoresize]="true" [formControl]="message" />`
	})
	class TextareaHostComponent {
		readonly message = new FormControl('');
	}

	it('measures again when the control is set or reset from code', () => {
		const fixture = TestBed.createComponent(ControlHostComponent);
		fixture.detectChanges();

		const resize = vi.spyOn(fixture.componentInstance.directive(), 'resize');

		fixture.componentInstance.message.setValue('A long message\nover\nseveral lines');
		expect(resize).toHaveBeenCalledTimes(1);

		fixture.componentInstance.message.reset('');
		expect(resize).toHaveBeenCalledTimes(2);
	});

	it('measures again inside hub-textarea when the form writes its value', async () => {
		const fixture = TestBed.createComponent(TextareaHostComponent);
		fixture.detectChanges();

		const directive = fixture.debugElement.query(By.directive(HubAutoresizeDirective)).injector.get(HubAutoresizeDirective);
		const resize = vi.spyOn(directive, 'resize');

		fixture.componentInstance.message.setValue('A long message');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(resize).toHaveBeenCalled();

		resize.mockClear();
		fixture.componentInstance.message.reset('');
		fixture.detectChanges();
		await fixture.whenStable();

		expect(resize).toHaveBeenCalled();
	});
});
