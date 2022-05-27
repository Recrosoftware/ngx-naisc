import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {NaiscToObservablePipe} from './common/naisc-to-observable.pipe';
import {Naisc} from './naisc';
import {NaiscDefaultItemComponent} from './naisc-default-item.component';
import {NaiscItemLinkDirective} from './naisc-item-link.directive';
import {NaiscItemPinDirective} from './naisc-item-pin.directive';
import {NaiscItemComponent} from './naisc-item.component';


@NgModule({
  imports: [CommonModule],
  declarations: [
    Naisc,

    NaiscItemComponent,
    NaiscItemLinkDirective,
    NaiscItemPinDirective,
    NaiscDefaultItemComponent,

    NaiscToObservablePipe
  ],
  exports: [Naisc]
})
export class NaiscModule {
}
