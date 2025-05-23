export interface Position {
  readonly x: number;
  readonly y: number;
}
export interface Size {
  readonly width: number;
  readonly height: number;
}

export function computeCurrentAbsolutePosition (element: Element): Position;
export function computeCurrentAbsolutePosition (element: HTMLElement): Position {
  const parentElement = element.offsetParent as HTMLElement | null;
  const parent = parentElement ? computeCurrentAbsolutePosition(parentElement) : null;
  return {
    x: element.offsetLeft + (parent ? parent.x : 0),
    y: element.offsetTop + (parent ? parent.y : 0),
  };
}

export function computeCurrentSize (element: Element): Size;
export function computeCurrentSize (element: HTMLElement): Size {
  return {
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

export function setElementPosition (element: Element, x: number, y: number): void;
export function setElementPosition (element: HTMLElement, x: number, y: number) {
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
}
