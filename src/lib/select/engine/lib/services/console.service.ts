import { Injectable, isDevMode } from '@angular/core';

/**
 * Reports developer-facing warnings through the configured console.
 *
 * @since 3.0.0
 */
@Injectable({ providedIn: 'root' })
export class ConsoleService {
	/**
	 * Writes a developer-facing warning to the console.
	 *
	 * @param message - The message.
	 *
	 * @since 3.0.0
	 */
	warn(message: string) {
		// Advice for whoever wrote the form: kept, but only where that person reads it, and attributed.
		if (!isDevMode()) {
			return;
		}

		console.warn(`[ng-hub-ui-forms] ${message}`);
	}
}
