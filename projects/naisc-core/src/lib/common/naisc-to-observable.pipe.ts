import {Pipe, PipeTransform, ɵisObservable as isObservable, ɵisPromise as isPromise} from '@angular/core';
import {from, Observable, of} from 'rxjs';


@Pipe({name: 'naiscToObservable'})
export class NaiscToObservablePipe<T> implements PipeTransform {
  public transform(value: T | Promise<T> | Observable<T>): Observable<T> {
    if (isObservable(value)) return value;
    if (isPromise(value)) return from(value);

    return of(value);
  }
}
