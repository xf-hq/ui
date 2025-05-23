import type { ArraySource, Subscribable } from '@xf-common/dynamic';
import { disposableFunction } from '@xf-common/general/disposables';
import { ThisShouldBeUnreachable } from '@xf-common/general/errors';
import { elementAt, firstElement, lastElement } from '@xf-common/primitive';
import { DOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange } from './dom-node-range';

export function appendDynamicDOMNodeRange (location: DOMLocationPointer, source: ArraySource<DOMNodeRange>): DisposableFunction {
  const controller = new DynamicDOMController(location);
  const sub = source.subscribe((event) => controller.signal(event));
  controller.push(...sub.__array);
  return disposableFunction(sub);
}

class DynamicDOMController implements Subscribable.Receiver<[event: ArraySource.Event<DOMNodeRange>], []> {
  constructor (public readonly location: DOMLocationPointer) {}

  signal (event: ArraySource.Event<DOMNodeRange>) {
    switch (event.kind) {
      case 'push': this.push(...event.values); break;
      case 'pop': this.pop(); break;
      case 'unshift': this.unshift(...event.values); break;
      case 'shift': this.shift(); break;
      case 'splice': this.splice(event.index, event.deletions, ...event.insertions); break;
      case 'set': this.set(event.index, event.value); break;
      case 'batch': this.batch(event.events); break;
      default: throw new ThisShouldBeUnreachable();
    }
  }

  readonly #segments: DynamicDOMSegment[] = [];
  public readonly segments: readonly DynamicDOMSegment[] = this.#segments;

  private createAndAttachSegment (range: DOMNodeRange, previous: DynamicDOMSegment | null, next: DynamicDOMSegment | null): DynamicDOMSegment {
    const segment = new DynamicDOMSegment(this, range);
    if (previous) {
      previous.__next = segment;
      segment.__previous = previous;
    }
    if (next) {
      next.__previous = segment;
      segment.__next = next;
    }
    range.attachTo(segment.location);
    return segment;
  }

  push (...ranges: DOMNodeRange[]) {
    let previous: DynamicDOMSegment | null = lastElement(this.#segments) ?? null;
    for (let i = 0; i < ranges.length; ++i) {
      const segment = this.createAndAttachSegment(ranges[i], previous, null);
      this.#segments.push(segment);
      previous = segment;
    }
  }
  pop () {
    const last = this.#segments.pop();
    if (last) {
      last.range.remove();
      if (last.__previous) last.__previous.__next = null;
    }
  }
  unshift (...ranges: DOMNodeRange[]) {
    let next: DynamicDOMSegment | null = firstElement(this.#segments) ?? null;
    for (let i = ranges.length - 1; i >= 0; --i) {
      const segment = this.createAndAttachSegment(ranges[i], null, next);
      this.#segments.unshift(segment);
      next = segment;
    }
  }
  shift () {
    const first = this.#segments.shift();
    if (first) {
      first.range.remove();
      if (first.__next) first.__next.__previous = null;
    }
  }
  splice (index: number, deletions: number, ...insertions: DOMNodeRange[]) {
    const previous = index > 0 ? this.#segments[index - 1] : null;
    const next = index + deletions < this.#segments.length ? this.#segments[index + deletions] : null;

    for (let i = 0; i < deletions; ++i) {
      const segment = this.#segments[index + i];
      segment.range.remove();
    }

    const newSegments: DynamicDOMSegment[] = [];
    for (let i = 0; i < insertions.length; ++i) {
      const segment = this.createAndAttachSegment(
        insertions[i],
        i === 0 ? previous : newSegments[i - 1],
        i === insertions.length - 1 ? next : null
      );
      newSegments.push(segment);
    }

    this.#segments.splice(index, deletions, ...newSegments);
  }
  set (index: number, range: DOMNodeRange) {
    const oldSegment = elementAt(index, this.#segments);
    if (oldSegment) oldSegment.range.remove();
    const previous = index > 0 ? this.#segments[index - 1] : null;
    const next = index < this.#segments.length - 1 ? this.#segments[index + 1] : null;
    const newSegment = this.createAndAttachSegment(range, previous, next);
    this.#segments[index] = newSegment;
  }
  batch (events: ArraySource.Event<DOMNodeRange>[]) {
    for (let i = 0; i < events.length; ++i) {
      this.signal(events[i]);
    }
  }
}

class DynamicDOMSegment implements DOMLocationPointer.Props {
  constructor (
    private readonly controller: DynamicDOMController,
    public readonly range: DOMNodeRange,
  ) {
    this.location = DOMLocationPointer.from(this);
  }
  public __previous: DynamicDOMSegment | null = null;
  public __next: DynamicDOMSegment | null = null;

  get parentElement (): Element { return this.controller.location.parentElement; }
  readonly previousOuterSibling = () => this.__previous ? this.__previous.lastNodeOrPreviousOuterSibling : this.controller.location.previousOuterSibling;
  readonly nextOuterSibling = () => this.__next ? this.__next.firstNodeOrNextOuterSibling : this.controller.location.nextOuterSibling;
  readonly location: DOMLocationPointer;

  get lastNodeOrPreviousOuterSibling (): ChildNode | null { return this.range.lastActiveNode ?? this.previousOuterSibling(); }
  get firstNodeOrNextOuterSibling (): ChildNode | null { return this.range.firstActiveNode ?? this.nextOuterSibling(); }
}
