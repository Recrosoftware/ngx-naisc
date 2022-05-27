import type {TypeDecorator} from '@angular/core';
import {AUTO_INJECTED_CONTENTS} from '../internal/containers';
import type {NaiscType} from '../internal/models';
import {NaiscMetadata} from '../internal/models';
import {NAISC_METADATA_ACCESSOR} from '../internal/symbols';
import {NaiscItemContent} from './naisc-item-content';
import type {NaiscItemDescriptor} from './naisc-item-descriptor';
import type {NaiscItemOptions} from './naisc-item-options';


export function NaiscItem(type: string | string[], opts?: Partial<NaiscItemOptions>): TypeDecorator {
  const {
    autoInject = false,
    inputPins = [],
    outputPins = []
  } = opts || {};

  if (!Array.isArray(type)) type = [type];

  type = type
    .sort()
    .filter((t, i, a) => i === 0 || t !== a[i - 1]);

  return (target: NaiscType) => {
    if (type.length < 1) {
      throw new Error(`You must specify at least one type '${target.name}'`);
    }

    if (!(target.prototype instanceof NaiscItemContent)) {
      throw new Error(`Decorated class '${target.name}' must extend 'NaiscItemContent' class.`);
    }

    if (autoInject) {
      (type as string[]).forEach(t => {
        if (t in AUTO_INJECTED_CONTENTS) {
          const existing = AUTO_INJECTED_CONTENTS[t];

          throw new Error(`Cannot auto-inject '${target.name}' found already '${existing.name}' as provider for type '${t}'`);
        }

        AUTO_INJECTED_CONTENTS[t] = target;
      });
    }

    const metadata = new NaiscMetadata();

    metadata.type = type as string[];
    metadata.factory = () => {
      const descriptor: NaiscItemDescriptor = {
        type: type[0],
        position: Object.seal({x: 0, y: 0}),
        pins: Object.freeze({
          in: inputPins.map(p => ({...p})),
          out: outputPins.map(p => ({...p}))
        }),
        state: {}
      };

      return Object.freeze(descriptor);
    };
    Object.seal(metadata);

    Object.defineProperty(target, NAISC_METADATA_ACCESSOR, {
      value: metadata,
      enumerable: false,
      configurable: false,
      writable: false
    });

    return target;
  };
}
