import { Component, provideZonelessChangeDetection, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { compile } from 'sass';
import { HubFormComponent } from '../components/form/form.component';
import { HubInputComponent } from '../components/input/input.component';
import { defaultHubFormsConfig, HubFeedbackAnimation, provideHubForms } from '../services/forms-config';
import { feedbackAnimationClasses } from './hub-error-display';

/**
 * Validation messages animate in and out through Angular's `animate.enter` / `animate.leave`,
 * with the classes picked once from `provideHubForms({ feedbackAnimation })`.
 *
 * jsdom has no `getAnimations`, so Angular skips `animate.*` there and the classes never reach
 * the element in a unit test; the binding itself was checked in a browser. What is fixed here
 * is everything around it: the config resolves to the right classes on every field and
 * container, and the stylesheet ships a rule for each class it hands out, so a preset can
 * never name a class nothing styles (Angular would then just drop the message at once).
 */
describe('feedback motion', () => {
	describe('feedbackAnimationClasses', () => {
		it('names the enter and leave classes of a built-in preset', () => {
			expect(feedbackAnimationClasses('collapse')).toEqual({
				enter: 'hub-field__feedback--collapse-enter',
				leave: 'hub-field__feedback--collapse-leave'
			});
			expect(feedbackAnimationClasses('slide').enter).toBe('hub-field__feedback--slide-enter');
		});

		it('returns no classes for `none`, so the message is added and removed at once', () => {
			expect(feedbackAnimationClasses('none')).toEqual({ enter: '', leave: '' });
		});

		it('passes custom classes through untouched', () => {
			expect(feedbackAnimationClasses({ enter: 'in a', leave: 'out' })).toEqual({ enter: 'in a', leave: 'out' });
		});

		it('leaves the exit unanimated when a custom motion has no leave classes', () => {
			expect(feedbackAnimationClasses({ enter: 'in' })).toEqual({ enter: 'in', leave: '' });
		});

		it('defaults to collapse', () => {
			expect(defaultHubFormsConfig.feedbackAnimation).toBe('collapse');
		});
	});

	describe('fields and containers', () => {
		@Component({
			standalone: true,
			imports: [HubInputComponent, HubFormComponent, ReactiveFormsModule],
			template: `
				<form hubForm [formGroup]="group">
					<hub-input formControlName="name" label="Name" />
				</form>
			`
		})
		class HostComponent {
			readonly group = new FormGroup({ name: new FormControl('') });
			readonly input = viewChild.required(HubInputComponent);
			readonly form = viewChild.required(HubFormComponent);
		}

		/** Reads the protected motion a field or container resolved from the config. */
		const motionOf = (cmp: object) =>
			(cmp as unknown as { feedbackMotion: { enter: string; leave: string } }).feedbackMotion;

		async function render(feedbackAnimation?: HubFeedbackAnimation) {
			TestBed.resetTestingModule();
			await TestBed.configureTestingModule({
				imports: [HostComponent],
				providers: [
					provideZonelessChangeDetection(),
					feedbackAnimation ? provideHubForms({ feedbackAnimation }) : provideHubForms()
				]
			}).compileComponents();

			const fixture = TestBed.createComponent(HostComponent);
			await fixture.whenStable();

			return fixture.componentInstance;
		}

		it('animates fields and containers with collapse when nothing is configured', async () => {
			const host = await render();

			expect(motionOf(host.input()).enter).toBe('hub-field__feedback--collapse-enter');
			expect(motionOf(host.form()).leave).toBe('hub-field__feedback--collapse-leave');
		});

		it('takes the preset from the config', async () => {
			const host = await render('slide');

			expect(motionOf(host.input())).toEqual(feedbackAnimationClasses('slide'));
			expect(motionOf(host.form())).toEqual(feedbackAnimationClasses('slide'));
		});

		it('takes custom classes from the config', async () => {
			const host = await render({ enter: 'app-error-in', leave: 'app-error-out' });

			expect(motionOf(host.input())).toEqual({ enter: 'app-error-in', leave: 'app-error-out' });
		});
	});

	describe('stylesheet', () => {
		const css = compile('projects/forms/src/lib/styles/_field.scss').css.replace(/\/\*[\s\S]*?\*\//g, '');

		/** Declarations of the first top-level rule whose selector list contains `selector`. */
		function rule(selector: string, from = css): string {
			const match = [...from.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) =>
				sel.split(',').some((s) => s.trim() === selector)
			);

			return match?.[2] ?? '';
		}

		for (const preset of ['collapse', 'fade', 'slide'] as const) {
			const { enter, leave } = feedbackAnimationClasses(preset);

			it(`styles both classes of ${preset} with a keyframes block that exists`, () => {
				for (const cls of [enter, leave]) {
					expect(rule(`.${cls}`)).toContain(`animation: hub-field-feedback-${preset} `);
				}
				expect(css).toContain(`@keyframes hub-field-feedback-${preset} `);
			});

			it(`plays ${preset} backwards to leave`, () => {
				expect(css).toMatch(new RegExp(`\\.${leave} \\{\\s*animation-direction: reverse;`));
			});

			it(`turns ${preset} off under prefers-reduced-motion`, () => {
				const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

				expect(rule(`.${enter}`, reduced)).toContain('animation: none');
				expect(rule(`.${leave}`, reduced)).toContain('animation: none');
			});
		}

		it('does not animate a message shown as a tooltip, which is clipped off the page', () => {
			expect(rule('.hub-field-host--feedback-tooltip .hub-field__feedback')).toContain('animation: none');
		});
	});
});
