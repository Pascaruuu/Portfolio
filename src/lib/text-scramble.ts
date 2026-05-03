interface ScrambleTextOptions {
	delay: number;
	shouldContinue?: () => boolean;
}

const SCRAMBLE_CHARS = '!@#$%^&*?><[]{}|~';
const SCRAMBLE_DURATION_MS = 800;

export function scrambleText(el: HTMLElement, options: ScrambleTextOptions): void {
	const finalText = el.textContent ?? '';
	const locked = Array.from({ length: finalText.length }, () => false);
	let frameId = 0;
	let startedAt = 0;

	const canContinue = (): boolean => options.shouldContinue?.() ?? true;

	const scrambleFrame = (now: number): void => {
		if (!canContinue()) {
			cancelAnimationFrame(frameId);
			return;
		}

		if (startedAt === 0) startedAt = now;

		const progress = Math.min(1, (now - startedAt) / SCRAMBLE_DURATION_MS);
		const nextText = Array.from(finalText, (char, index) => {
			if (progress >= 1) {
				locked[index] = true;
				return char;
			}

			const threshold = progress * (index / finalText.length * 0.5 + 0.5);
			if (locked[index] || Math.random() < threshold) {
				locked[index] = true;
				return char;
			}

			return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)] ?? char;
		}).join('');

		el.textContent = nextText;

		if (progress < 1) {
			frameId = requestAnimationFrame(scrambleFrame);
		} else {
			cancelAnimationFrame(frameId);
		}
	};

	setTimeout(() => {
		if (!canContinue()) return;
		frameId = requestAnimationFrame(scrambleFrame);
	}, options.delay);
}
