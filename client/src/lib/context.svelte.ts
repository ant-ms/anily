class Context<T> {
  private _value: T | undefined = $state();
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
