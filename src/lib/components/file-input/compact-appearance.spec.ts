import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { HubFileInputAppearance } from '../../interfaces/file-input.interface';
import { provideHubForms } from '../../services/forms-config';
import { HubFileInputComponent } from './file-input.component';

/**
 * `appearance="compact"` — the same field, one row high.
 *
 * The tall dropzone earns its height when files are the point of the screen. Beside four text
 * inputs in a dialog it is the wrong shape: a logo, a signature, one small file, and the panel
 * took half the height of the window to ask for it. Turning the drag off did not help — the box,
 * the glyph, the browse link and the constraints all stayed, and only the "drag here" line went.
 *
 * So the compact row drops the panel's copy and keeps the field's: the browse control and the
 * constraints. The drop keeps working, which is why the drag copy is what goes and not the
 * behaviour — a row that refused a drop while saying nothing about it would be worse than the
 * panel ever was.
 */
@Component({
	standalone: true,
	imports: [HubFileInputComponent],
	template: ` <hub-file-input label="Logo" accept="image/*" [appearance]="appearance()" [dragDrop]="dragDrop()" /> `
})
class AppearanceHostComponent {
	readonly appearance = signal<HubFileInputAppearance>('dropzone');
	readonly dragDrop = signal(true);
}

/** A compact field with a subtitle the consumer wrote. */
@Component({
	standalone: true,
	imports: [HubFileInputComponent],
	template: `<hub-file-input label="Logo" appearance="compact" dropSubtext="Square, at least 256px" />`
})
class CompactSubtextHostComponent {}

/**
 * The minimal `DragEvent` shape the field reads. A real `DataTransfer` cannot be constructed in
 * the test DOM, so the payload is described rather than built.
 *
 * @param files - The files the event carries.
 * @returns The event stand-in.
 */
const dragEvent = (files: File[]): DragEvent =>
	({
		preventDefault: () => undefined,
		dataTransfer: {
			types: ['Files'],
			files,
			items: files.map((file) => ({ kind: 'file', getAsFile: () => file }))
		}
	}) as unknown as DragEvent;

const render = async () => {
	TestBed.resetTestingModule();
	await TestBed.configureTestingModule({
		imports: [AppearanceHostComponent],
		providers: [provideZonelessChangeDetection(), provideHubForms()]
	}).compileComponents();

	const fixture = TestBed.createComponent(AppearanceHostComponent);
	fixture.detectChanges();

	return fixture;
};

describe('hub-file-input appearance', () => {
	it('defaults to the panel, glyph and drag copy included', async () => {
		const fixture = await render();
		const zone = fixture.nativeElement.querySelector('.hub-file-input__dropzone') as HTMLElement;

		expect(zone.classList.contains('hub-file-input__dropzone--compact')).toBe(false);
		expect(zone.querySelector('.hub-file-input__icon')).not.toBeNull();
		expect(zone.querySelector('.hub-file-input__drop-text')).not.toBeNull();
	});

	it('compact drops the glyph and the drag copy, and keeps the control and the constraints', async () => {
		const fixture = await render();
		fixture.componentInstance.appearance.set('compact');
		fixture.detectChanges();

		const zone = fixture.nativeElement.querySelector('.hub-file-input__dropzone') as HTMLElement;

		expect(zone.classList.contains('hub-file-input__dropzone--compact')).toBe(true);
		expect(zone.querySelector('.hub-file-input__icon')).toBeNull();
		expect(zone.querySelector('.hub-file-input__drop-text')).toBeNull();
		expect(zone.querySelector('.hub-file-input__browse')?.textContent).toContain('Browse files');
		expect(zone.querySelector('.hub-file-input__hint')?.textContent).toContain('image/*');
	});

	/** The row is still a drop target; only the copy that described one is gone. */
	it('still takes a drop', async () => {
		const fixture = await render();
		fixture.componentInstance.appearance.set('compact');
		fixture.detectChanges();

		const field = fixture.debugElement.query(By.directive(HubFileInputComponent)).componentInstance;
		const file = new File(['x'], 'logo.png', { type: 'image/png' });

		field['handleDragEnter'](dragEvent([file]));
		fixture.detectChanges();

		expect(field.isDragging()).toBe(true);

		field['handleDrop'](dragEvent([file]));
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.hub-file-input__name')?.textContent).toContain('logo.png');
	});

	it('keeps a subtitle the consumer wrote, which is not the panel talking', async () => {
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [CompactSubtextHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();

		const fixture = TestBed.createComponent(CompactSubtextHostComponent);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.hub-file-input__drop-subtext')?.textContent).toContain(
			'Square, at least 256px'
		);
	});
});
