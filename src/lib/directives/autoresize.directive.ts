import { booleanAttribute, DestroyRef, Directive, ElementRef, inject, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';

/**
 * Auto-resizes a `<textarea>` to fit its content height.
 *
 * It measures when the reader types and also when a form control on the same textarea changes its
 * value from code (`setValue`, `reset`, `ngModel`), so a box emptied after sending a long message
 * shrinks back instead of keeping the height of the text it held.
 *
 * @example
 * ```html
 * <textarea hubAutoresize></textarea>
 * ```
 */
@Directive({
	selector: 'textarea[hubAutoresize]',
	host: {
		'(:focusin)': 'onChange()',
		'(:focusout)': 'onChange()',
		'(:input)': 'onChange()'
	}
})
export class HubAutoresizeDirective implements OnInit {
	readonly #elementRef = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
	readonly #control = inject(NgControl, { self: true, optional: true });
	readonly #destroyRef = inject(DestroyRef);

	/** Whether auto-resizing is enabled. */
	readonly hubAutoresize = input(true, { transform: booleanAttribute });

	onChange(): void {
		this.resize();
	}

	ngOnInit(): void {
		if (this.#elementRef.nativeElement.scrollHeight) {
			setTimeout(() => this.resize(), 1);
		}

		// The control writes the new text into the textarea before it emits, so the measurement
		// already sees it.
		this.#control?.valueChanges?.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.resize());
	}

	/** Resizes the textarea to fit its content. */
	resize(): void {
		if (this.hubAutoresize()) {
			const el = this.#elementRef.nativeElement;
			el.style.height = '0';
			el.style.height = el.scrollHeight + 4 + 'px';
		}
	}
}
