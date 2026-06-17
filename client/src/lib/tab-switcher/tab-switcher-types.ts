import type { IconComponentProps } from "phosphor-svelte";
import type { Component } from "svelte";

export interface Tab {
  id: string;
  Icon?: Component<IconComponentProps, {}, "">;
  name?: string;
  default?: true | undefined;
}
