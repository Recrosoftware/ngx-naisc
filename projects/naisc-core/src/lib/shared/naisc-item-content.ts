import {Directive, Input} from '@angular/core';
import {Observable} from 'rxjs';

import type {NaiscItemDescriptor} from './naisc-item-descriptor';
import type {NaiscValidationError} from './naisc-validation';


const DEFAULT_PIN_NAME = '---';

@Directive()
export abstract class NaiscItemContent {
  @Input() public item: NaiscItemDescriptor;
  @Input() public overlay: HTMLElement;
  @Input() public readonly: boolean;
  @Input() public notifyChanges: () => void;

  @Input() public viewState: { [key: string]: any };
  @Input() public viewState$: Observable<{ key: string, value: any }>;

  public abstract getTitle(): void | null | string | Promise<string> | Observable<string>;

  public getInputPinName(idx: number): void | null | string | Promise<string> | Observable<string> {
    return DEFAULT_PIN_NAME;
  }

  public getOutputPinName(idx: number): void | null | string | Promise<string> | Observable<string> {
    return DEFAULT_PIN_NAME;
  }

  public isPermanent(): void | null | boolean | Promise<boolean> | Observable<boolean> {
    return false;
  }

  public onReadonlyChanged(readonly: boolean): void {
  }

  public onValidate(): NaiscValidationError {
    return null;
  }
}
