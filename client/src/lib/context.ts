class Context<T> {
  private _value: T | undefined;
  public set(value: T | undefined) {
    this._value = value;
  }
  public get(): T | undefined {
    return this._value;
  }
}

export const apiBaseUrl = new Context<URL>();
