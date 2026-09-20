class Context<T> {
  private _value: T | undefined = $state();
  constructor(initialValue?: T) {
    this._value = initialValue;
  }
  public set(value: T | undefined) {
    this._value = value;
  }
  public get current(): T | undefined {
    return this._value;
  }
}

export interface AnimeSetOptions {
  clearHistory?: boolean;
}

export class AnimeContext {
  private _value: number | undefined = $state();
  private _history: number[] = $state([]);

  constructor(initialValue?: number) {
    this._value = initialValue;
  }

  public get current(): number | undefined {
    return this._value;
  }

  public get hasHistory(): boolean {
    return this._history.length > 0;
  }

  public set(value: number | undefined, options?: AnimeSetOptions) {
    if (value === this._value) return;

    if (value === undefined || options?.clearHistory) {
      this._history = [];
      this._value = value;
      return;
    }

    if (this._value !== undefined) {
      this._history.push(this._value);
      if (this._history.length > 50) {
        this._history.shift();
      }
    }
    this._value = value;
  }

  public back(): boolean {
    if (this._history.length > 0) {
      this._value = this._history.pop();
      return true;
    }
    if (this._value !== undefined) {
      this._value = undefined;
      return true;
    }
    return false;
  }

  public clearHistory() {
    this._history = [];
  }
}

export const apiBaseUrl = new Context<URL>();
export const selectedAnimeAnilistId = new AnimeContext();

export const sidebarDataRefreshSeed = new Context<number>();
export const isSeasonsSidebarOpen = new Context<boolean>();
export const isMobileNavOpen = new Context<boolean>(false);
export const isGlobalSearchOpen = new Context<boolean>(false);
