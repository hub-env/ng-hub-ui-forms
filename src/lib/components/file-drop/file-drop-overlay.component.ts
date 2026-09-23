import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/**
 * The card a {@link HubFileDropDirective} raises while files are being dragged over its target.
 *
 * Created by the directive rather than written by the consumer, so turning a page into a drop
 * zone stays one attribute. It is `aria-hidden` on purpose: dragging a file is a pointer gesture
 * and there is nothing here for a screen reader to do — the file field the drop feeds is what
 * answers to the keyboard, and it is still there.
 */
@Component({
	selector: 'hub-file-drop-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	host: {
		class: 'hub-file-drop__overlay',
		'aria-hidden': 'true',
		'[class.hub-file-drop__overlay--fixed]': 'fixed()',
		'[class.hub-file-drop__overlay--visible]': 'visible()'
	},
	template: `
		<div class="hub-file-drop__card">
			<span class="hub-file-drop__icon" aria-hidden="true"></span>
			<span class="hub-file-drop__text">{{ text() }}</span>
			@if (subtext()) {
				<span class="hub-file-drop__subtext">{{ subtext() }}</span>
			}
		</div>
	`,
	styleUrl: './file-drop-overlay.component.scss'
})
export class HubFileDropOverlayComponent {
	/** Whether a drag is currently over the target. */
	readonly visible = input(false);

	/** Whether the card covers the viewport (window scope) rather than its container. */
	readonly fixed = input(false);

	/** The invitation. */
	readonly text = input('');

	/** The second line, usually the restrictions. */
	readonly subtext = input('');
}
