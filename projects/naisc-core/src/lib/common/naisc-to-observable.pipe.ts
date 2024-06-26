import {Pipe, PipeTransform, ɵisPromise as isPromise} from '@angular/core';
import {from, isObservable, Observable, of} from 'rxjs';


@Pipe({name: 'naiscToObservable', standalone: true})
export class NaiscToObservablePipe<T> implements PipeTransform {
  public transform(value: T | Promise<T> | Observable<T>): Observable<T> {
    if (isObservable(value)) return value;
    if (isPromise(value)) return from(value);

    return of(value);
  }
}
