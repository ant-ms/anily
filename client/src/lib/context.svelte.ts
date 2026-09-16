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

export const apiBaseUrl = new Context<URL>();
export const selectedAnimeAnilistId = new Context<number>();

export const sidebarDataRefreshSeed = new Context<number>();
export const isSeasonsSidebarOpen = new Context<boolean>();
export const isMobileNavOpen = new Context<boolean>(false);
