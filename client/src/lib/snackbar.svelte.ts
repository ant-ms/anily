export type SnackbarType = 'info' | 'success' | 'error';

export interface SnackbarOptions {
  type?: SnackbarType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface SnackbarMessage {
  id: number;
  message: string;
  type: SnackbarType;
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
}

class SnackbarStore {
  current = $state<SnackbarMessage | null>(null);
  private queue: SnackbarMessage[] = [];
  private timer: number | null = null;
  private nextId = 1;

  show(message: string, options?: SnackbarOptions) {
    if (!message) return;
    const type = options?.type ?? 'info';
    const duration =
      options?.duration !== undefined
        ? options.duration
        : options?.actionLabel
          ? 0 // M3 guideline: actionable snackbars persist until action or dismissal
          : type === 'error'
            ? 6000
            : 4000;

    const item: SnackbarMessage = {
      id: this.nextId++,
      message,
      type,
      duration,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    };

    if (!this.current) {
      this.display(item);
    } else {
      // Avoid duplicate identical messages waiting in queue
      if (this.current.message === message) return;
      if (this.queue.some((q) => q.message === message)) return;
      this.queue.push(item);
    }
  }

  private display(item: SnackbarMessage) {
    this.current = item;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (item.duration > 0) {
      this.timer = window.setTimeout(() => {
        this.dismiss(item.id);
      }, item.duration);
    }
  }

  dismiss(id?: number) {
    if (id !== undefined && this.current?.id !== id) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.current = null;

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      window.setTimeout(() => {
        this.display(next);
      }, 150);
    }
  }

  success(message: string, duration?: number) {
    this.show(message, { type: 'success', duration });
  }

  error(message: string, duration?: number) {
    this.show(message, { type: 'error', duration });
  }

  info(message: string, duration?: number) {
    this.show(message, { type: 'info', duration });
  }
}

export const snackbar = new SnackbarStore();
