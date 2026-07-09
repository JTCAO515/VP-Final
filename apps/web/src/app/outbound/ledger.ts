import type { OutboundClick } from "@visepanda/domain";

const store = globalThis as typeof globalThis & {
  __visepandaOutboundClicks?: OutboundClick[];
};

export function recordOutboundClick(click: OutboundClick) {
  store.__visepandaOutboundClicks ??= [];
  store.__visepandaOutboundClicks.push(click);
}

export function listOutboundClicks(): OutboundClick[] {
  return store.__visepandaOutboundClicks ?? [];
}
