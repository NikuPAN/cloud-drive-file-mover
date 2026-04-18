export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	message: string;
	variant: ToastVariant;
	duration: number;
}

class ToastStore {
	items = $state<Toast[]>([]);
	#nextId = 0;

	push(message: string, variant: ToastVariant = 'info', duration = 5000) {
		const id = this.#nextId++;
		this.items = [...this.items, { id, message, variant, duration }];
		if (duration > 0) setTimeout(() => this.dismiss(id), duration);
		return id;
	}

	success(message: string, duration = 5000) {
		return this.push(message, 'success', duration);
	}

	error(message: string, duration = 8000) {
		return this.push(message, 'error', duration);
	}

	info(message: string, duration = 5000) {
		return this.push(message, 'info', duration);
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toastStore = new ToastStore();
