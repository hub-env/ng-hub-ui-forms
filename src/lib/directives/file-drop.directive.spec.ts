import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HubFileRejection } from '../interfaces/file-input.interface';
import { provideHubForms } from '../services/forms-config';
import { HubFileDropDirective, HubFileDropScope } from './file-drop.directive';

/**
 * `hubFileDrop` — a container, or a whole page, that takes dropped files.
 *
 * A file field only accepts a drop inside its own box, which is right for a field and wrong for
 * a screen: on a list of expenses the gesture is to drop the receipt anywhere on the page. Every
 * application that wanted it wrote the same component again, and the detail they all got wrong
 * is the one nobody tests for — a file dropped beside the target, with no listener calling
 * `preventDefault`, makes the browser open it and lose the page, half-filled form included.
 */
const dragEvent = (type: string, files: File[]): DragEvent => {
	const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;

	Object.defineProperty(event, 'dataTransfer', {
		value: {
			types: ['Files'],
			files,
			items: files.map((file) => ({ kind: 'file', getAsFile: () => file })),
			dropEffect: 'none'
		}
	});

	return event;
};

const makeFile = (name: string, size = 10, type = 'image/png'): File => {
	const file = new File(['x'], name, { type });

	Object.defineProperty(file, 'size', { value: size });

	return file;
};

@Component({
	standalone: true,
	imports: [HubFileDropDirective],
	template: `
		<section
			[hubFileDrop]="scope()"
			[accept]="accept()"
			[maxSize]="maxSize()"
			[maxFiles]="maxFiles()"
			[dropDisabled]="dropDisabled()"
			[overlay]="overlay()"
			(filesDropped)="dropped.push(...$event)"
			(rejected)="refused.push(...$event)"
		>
			<p class="child">Expenses</p>
		</section>
	`
})
class DropHostComponent {
	readonly scope = signal<HubFileDropScope>('element');
	readonly accept = signal('*');
	readonly maxSize = signal<number | null>(null);
	readonly maxFiles = signal<number | null>(null);
	readonly dropDisabled = signal(false);
	readonly overlay = signal(true);
	readonly dropped: File[] = [];
	readonly refused: HubFileRejection[] = [];
}

const render = async () => {
	TestBed.resetTestingModule();
	await TestBed.configureTestingModule({
		imports: [DropHostComponent],
		providers: [provideZonelessChangeDetection(), provideHubForms()]
	}).compileComponents();

	const fixture = TestBed.createComponent(DropHostComponent);

	document.body.appendChild(fixture.nativeElement);
	fixture.detectChanges();
	await fixture.whenStable();

	const zone = fixture.nativeElement.querySelector('section') as HTMLElement;

	return { fixture, host: fixture.componentInstance as DropHostComponent, zone };
};

describe('hubFileDrop', () => {
	afterEach(() => document.querySelectorAll('hub-file-drop-overlay').forEach((node) => node.remove()));

	it('raises the card while a file drag is over the container, and lowers it on leave', async () => {
		const { fixture, zone } = await render();

		zone.dispatchEvent(dragEvent('dragenter', [makeFile('a.png')]));
		fixture.detectChanges();
		await fixture.whenStable();

		const overlay = zone.querySelector('hub-file-drop-overlay') as HTMLElement;

		expect(overlay).not.toBeNull();
		expect(overlay.classList.contains('hub-file-drop__overlay--visible')).toBe(true);
		expect(zone.classList.contains('hub-file-drop--active')).toBe(true);

		zone.dispatchEvent(dragEvent('dragleave', [makeFile('a.png')]));
		fixture.detectChanges();
		await fixture.whenStable();

		expect(overlay.classList.contains('hub-file-drop__overlay--visible')).toBe(false);
	});

	/** A page of children would otherwise flicker the card on every element the drag crosses. */
	it('stays up while the drag moves between children', async () => {
		const { fixture, zone } = await render();
		const child = zone.querySelector('.child') as HTMLElement;

		zone.dispatchEvent(dragEvent('dragenter', [makeFile('a.png')]));
		child.dispatchEvent(dragEvent('dragenter', [makeFile('a.png')]));
		zone.dispatchEvent(dragEvent('dragleave', [makeFile('a.png')]));
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.componentInstance.scope()).toBe('element');
		expect(zone.classList.contains('hub-file-drop--active')).toBe(true);
	});

	it('claims the drag, which is what stops the browser opening the file instead', async () => {
		const { zone } = await render();
		const over = dragEvent('dragover', [makeFile('a.png')]);

		zone.dispatchEvent(over);

		expect(over.defaultPrevented).toBe(true);
		expect(over.dataTransfer?.dropEffect).toBe('copy');
	});

	it('hands back what passed and what did not, with the reason and the limit', async () => {
		const { fixture, host, zone } = await render();

		host.accept.set('image/*');
		host.maxSize.set(100);
		fixture.detectChanges();

		zone.dispatchEvent(
			dragEvent('drop', [makeFile('ok.png', 50), makeFile('notes.txt', 10, 'text/plain'), makeFile('big.png', 500)])
		);
		fixture.detectChanges();

		expect(host.dropped.map((file) => file.name)).toEqual(['ok.png']);
		expect(host.refused.map((rejection) => [rejection.file.name, rejection.reason, rejection.limit])).toEqual([
			['notes.txt', 'accept', 'image/*'],
			['big.png', 'maxSize', 100]
		]);
	});

	it('refuses everything past maxFiles rather than quietly keeping the first ones', async () => {
		const { fixture, host, zone } = await render();

		host.maxFiles.set(1);
		fixture.detectChanges();

		zone.dispatchEvent(dragEvent('drop', [makeFile('a.png'), makeFile('b.png')]));
		fixture.detectChanges();

		expect(host.dropped.map((file) => file.name)).toEqual(['a.png']);
		expect(host.refused[0].reason).toBe('maxFiles');
	});

	it('takes nothing while disabled', async () => {
		const { fixture, host, zone } = await render();

		host.dropDisabled.set(true);
		fixture.detectChanges();

		zone.dispatchEvent(dragEvent('dragenter', [makeFile('a.png')]));
		zone.dispatchEvent(dragEvent('drop', [makeFile('a.png')]));
		fixture.detectChanges();
		await fixture.whenStable();

		expect(zone.classList.contains('hub-file-drop--active')).toBe(false);
		expect(host.dropped).toEqual([]);
	});

	it('draws no card when the consumer wants to draw its own', async () => {
		const { fixture, host, zone } = await render();

		host.overlay.set(false);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(zone.querySelector('hub-file-drop-overlay')).toBeNull();

		// And the behaviour is still there, which is the half worth keeping.
		zone.dispatchEvent(dragEvent('drop', [makeFile('a.png')]));
		fixture.detectChanges();

		expect(host.dropped.map((file) => file.name)).toEqual(['a.png']);
	});

	describe('window scope', () => {
		it('watches the whole document and puts its card on the body', async () => {
			const { fixture, host } = await render();

			host.scope.set('window');
			fixture.detectChanges();
			await fixture.whenStable();

			const overlay = document.body.querySelector(':scope > hub-file-drop-overlay') as HTMLElement;

			expect(overlay).not.toBeNull();
			expect(overlay.classList.contains('hub-file-drop__overlay--fixed')).toBe(true);

			// A drop far away from the host still lands, which is the whole point of the scope.
			const elsewhere = document.createElement('div');

			document.body.appendChild(elsewhere);
			elsewhere.dispatchEvent(dragEvent('drop', [makeFile('receipt.png')]));
			fixture.detectChanges();

			expect(host.dropped.map((file) => file.name)).toEqual(['receipt.png']);

			elsewhere.remove();
		});
	});
});
