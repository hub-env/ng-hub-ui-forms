import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { compile } from 'sass';
import { HubDatepickerComponent } from '../components/datepicker/datepicker.component';
import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from '../select/select.component';

/**
 * The glass layer of `ng-hub-ui-ds` reaches the two floating panels of this package: they
 * carry `hub-glass-surface`, and their stylesheet reads `--hub-sys-glass-*` with fallbacks that
 * reproduce the opaque panel when the layer is off. Fields stay opaque on purpose.
 */
@Component({
	standalone: true,
	imports: [HubSelectComponent, HubDatepickerComponent, ReactiveFormsModule],
	template: `
		<hub-select [formControl]="select" [items]="['One', 'Two']" label="Pick" />
		<hub-datepicker [formControl]="date" label="Day" />
	`
})
class GlassHostComponent {
	readonly select = new FormControl<unknown>(null);
	readonly date = new FormControl<unknown>(null);
}

describe('glass layer', () => {
	afterEach(() => {
		document.querySelectorAll('.hub-overlay-container, .hub-overlay-backdrop').forEach((el) => el.remove());
	});

	async function render() {
		await TestBed.configureTestingModule({
			imports: [GlassHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();
		const fixture = TestBed.createComponent(GlassHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		return fixture;
	}

	it('marks the open select list as a glass surface', async () => {
		const fixture = await render();
		const container = fixture.nativeElement.querySelector('.ng-select-container') as HTMLElement;
		container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await fixture.whenStable();
		await new Promise((r) => setTimeout(r, 20));

		const panel = document.querySelector('hub-select-panel') as HTMLElement;
		expect(panel.classList.contains('hub-glass-surface')).toBe(true);
		expect(panel.classList.contains('hub-select__panel')).toBe(true);
	});

	it('marks the open datepicker calendar as a glass surface', async () => {
		const fixture = await render();
		(fixture.nativeElement.querySelector('.hub-datepicker__input') as HTMLInputElement).click();
		fixture.detectChanges();
		await fixture.whenStable();

		expect(document.querySelector('.hub-datepicker__panel')?.classList.contains('hub-glass-surface')).toBe(true);
	});

	describe('stylesheets', () => {
		const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
		const select = strip(compile('projects/forms/src/lib/select/select.component.scss').css);
		const datepicker = strip(compile('projects/forms/src/lib/components/datepicker/datepicker.component.scss').css);

		for (const [name, css] of [
			['select', select],
			['datepicker', datepicker]
		] as const) {
			it(`${name} panel reads the glass variables with opaque fallbacks`, () => {
				expect(css).toMatch(
					/color-mix\(in srgb, var\(--hub-[a-z-]+\) var\(--hub-sys-glass-opacity, 100%\), transparent\)/
				);
				expect(css).toContain('var(--hub-sys-glass-sheen, none)');
				expect(css).toContain('backdrop-filter: var(--hub-sys-glass-filter, none)');
				expect(css).toContain('var(--hub-sys-glass-rim, 0 0 rgba(0, 0, 0, 0))');
			});
		}
	});
});
