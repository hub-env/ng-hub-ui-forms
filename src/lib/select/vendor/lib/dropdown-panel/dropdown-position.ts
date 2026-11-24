// @ts-nocheck -- vendored ng-select source (type-checked upstream); see ../PATCHES.md
import { ConnectionPosition } from 'ng-hub-ui-utils';

import { DropdownPosition } from '../types/ng-select.types';

const DROPDOWN_POSITION_BELOW: ConnectionPosition = { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' };
const DROPDOWN_POSITION_ABOVE: ConnectionPosition = { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' };
const DROPDOWN_POSITION_BELOW_END: ConnectionPosition = { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' };
const DROPDOWN_POSITION_ABOVE_END: ConnectionPosition = { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' };
const DROPDOWN_POSITION_AFTER: ConnectionPosition = { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top' };
const DROPDOWN_POSITION_BEFORE: ConnectionPosition = { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' };

export const DROPDOWN_POSITIONS: Readonly<Record<DropdownPosition, readonly ConnectionPosition[]>> = {
	// 'auto' prefers below and flips above when the panel does not fit the viewport;
	// the fit check measures the rendered overlay, so header/footer templates and
	// item count are accounted for (#2687, #2575)
	// The end-aligned variants let a list wider than its control open from the control's end
	// instead of running off the screen.
	auto: [DROPDOWN_POSITION_BELOW, DROPDOWN_POSITION_BELOW_END, DROPDOWN_POSITION_ABOVE, DROPDOWN_POSITION_ABOVE_END],
	bottom: [DROPDOWN_POSITION_BELOW],
	top: [DROPDOWN_POSITION_ABOVE],
	right: [DROPDOWN_POSITION_AFTER],
	left: [DROPDOWN_POSITION_BEFORE],
};

export const DROPDOWN_CSS_POSITIONS: readonly DropdownPosition[] = ['top', 'right', 'bottom', 'left'];

/**
 * Converts an overlay connection position into the matching ng-select dropdown position.
 *
 * @param pair - The active overlay connection position.
 * @returns The corresponding ng-select dropdown position.
 *
 * @since 24.0.5
 */
export function connectionPairToDropdownPosition(pair: ConnectionPosition): DropdownPosition {
	if (pair.originY === 'bottom' && pair.overlayY === 'top') {
		return 'bottom';
	}
	if (pair.originY === 'top' && pair.overlayY === 'bottom') {
		return 'top';
	}
	if (pair.originX === 'end' && pair.overlayX === 'start') {
		return 'right';
	}
	if (pair.originX === 'start' && pair.overlayX === 'end') {
		return 'left';
	}
	return 'bottom';
}
