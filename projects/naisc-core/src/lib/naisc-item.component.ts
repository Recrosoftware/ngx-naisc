import {AsyncPipe} from '@angular/common';
import {
  AfterViewInit,
  Component,
  ComponentRef,
  ElementRef,
  HostListener,
  inject,
  NgZone,
  OnDestroy,
  Type,
  viewChild,
  viewChildren,
  ViewContainerRef,
  ViewEncapsulation
} from '@angular/core';
import {fromEvent, Observable, Subscription} from 'rxjs';
import {filter, share, startWith, switchMap, takeUntil, tap} from 'rxjs/operators';
import {NaiscToObservablePipe} from './common/naisc-to-observable.pipe';
import {runAsyncTask} from './internal/functions';
import {NaiscLinkEvent, NaiscType, ViewProjection} from './internal/models';
import {NAISC_METADATA_ACCESSOR, NAISC_PIN_POSITION} from './internal/symbols';
import {NaiscDefaultItemComponent} from './naisc-default-item.component';
import {NaiscItemPinDirective} from './naisc-item-pin.directive';
import {NaiscExtent} from './shared/naisc-extent';
import {NaiscItemContent} from './shared/naisc-item-content';
import {NaiscItemDescriptor, NaiscPinDescriptor} from './shared/naisc-item-descriptor';
import {NaiscValidationError} from './shared/naisc-validation';


@Component({
  selector: 'div[naiscItem]',
  standalone: true,
  imports: [
    AsyncPipe,
    NaiscItemPinDirective,
    NaiscToObservablePipe
  ],
  template: `
    <div class="naisc-item-track-bar" #titleBar>
      {{ getTitle() | naiscToObservable | async }}
      @if ((isPermanent() | naiscToObservable | async) === false && !readonly) {
        <i class="naisc-item-close-btn {{removeItemIconClass}}"
           (click)="onRemoveClick($event)" (mousedown)="$event.stopPropagation()"></i>
      }
    </div>

    <div class="naisc-item-pins">
      <ul class="naisc-item-pins-in">
        @for (pin of item.pins.in; track pin) {
          <li>
            <span>{{ getInputPinName($index) | naiscToObservable | async }}</span>
            <div [naiscItemPin]="pin" [item]="item" [type]="'in'"
                 [readonly]="readonly"
                 [linkEvents]="linkEvents"
                 (linkEnd)="onLinkInternal('end', pin)"
                 (linkStart)="onLinkInternal('start', pin)"
                 (removeLinks)="onLinkInternal('remove', pin)"
                 (calculatePosition)="calculatePinPosition(pin, $event)"></div>
          </li>
        }
      </ul>

      <ul class="naisc-item-pins-out">
        @for (pin of item.pins.out; track pin) {
          <li>
            <span>{{ getOutputPinName($index) | naiscToObservable | async }}</span>
            <div [naiscItemPin]="pin" [item]="item" [type]="'out'"
                 [readonly]="readonly"
                 [linkEvents]="linkEvents"
                 (linkEnd)="onLinkInternal('end', pin)"
                 (linkStart)="onLinkInternal('start', pin)"
                 (removeLinks)="onLinkInternal('remove', pin)"
                 (calculatePosition)="calculatePinPosition(pin, $event)"></div>
          </li>
        }
      </ul>
    </div>

    <div class="naisc-item-content">
      <ng-container #itemContentContainer/>
    </div>
  `,
  host: {
    'class': 'naisc-item',
    '[style.z-index]': 'currentZIndex'
  },
  encapsulation: ViewEncapsulation.None
})
export class NaiscItemComponent implements AfterViewInit, OnDestroy {
  public readonly titleBarRef = viewChild.required<unknown, ElementRef<HTMLDivElement>>('titleBar', {read: ElementRef});
  public readonly itemContentContainer = viewChild.required('itemContentContainer', {read: ViewContainerRef});
  public readonly pinRefs = viewChildren(NaiscItemPinDirective);

  public get readonly(): boolean {
    return this._readonly;
  }

  public set readonly(ro: boolean) {
    this._readonly = ro;

    if (this.contentRef) {
      this.contentRef.instance.readonly = ro;
      this.contentRef.instance.onReadonlyChanged(ro);
    }
  }

  public item: NaiscItemDescriptor;
  public state: { [key: string]: any };
  public state$: Observable<{ key: string, value: any }>;

  public overlayRef: HTMLElement;
  public currentZIndex: number;

  public fireStateChange: () => void;
  public generateZIndex: (zindex: number) => number;
  public removeFn: () => void;

  public onLink: (a: 'start' | 'end' | 'remove', p: NaiscPinDescriptor) => void;
  public linkEvents: Observable<NaiscLinkEvent>;
  public onMove: Observable<MouseEvent>;
  public onActionEnd: Observable<Event>;
  public parentProjection: ViewProjection;

  public snap: boolean;
  public templates: NaiscType[];
  public animationDuration: number;
  public animationFunction: (start: number, end: number, t: number) => number;
  public removeItemIconClass: string;

  public readonly projectionCurrent: ViewProjection = {x: 0, y: 0};
  private animationRequestRef: number;

  private dragging = false;

  private contentRef: ComponentRef<NaiscItemContent>;
  private contentRefType: NaiscType;

  private dragSubscription = Subscription.EMPTY;

  private _readonly: boolean;

  private readonly el = inject(ElementRef) as ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);

  public ngAfterViewInit(): void {
    this.render();
    this.listenDragEvents();

    runAsyncTask(() => this.updateContentTemplate());
  }

  public ngOnDestroy(): void {
    this.dragSubscription.unsubscribe();
  }

  @HostListener('mousedown', ['$event'])
  public onMouseDown(evt: Event): void {
    if (this.readonly) return;

    evt.stopPropagation();
    this.updateZIndex();
  }

  public getTitle() {
    return this.contentRef?.instance.getTitle() ?? '';
  }

  public getInputPinName(index: number) {
    return this.contentRef?.instance.getInputPinName(index) ?? '';
  }

  public getOutputPinName(index: number) {
    return this.contentRef?.instance.getOutputPinName(index) ?? '';
  }

  public isPermanent() {
    return this.contentRef?.instance.isPermanent() ?? false;
  }

  public onRemoveClick(evt: Event): void {
    evt.preventDefault();
    evt.stopPropagation();

    this.removeFn();
  }

  public triggerValidation(): NaiscValidationError {
    return this.contentRef ? this.contentRef.instance.onValidate() : null;
  }

  public updateContentTemplate(): void {
    if (!this.itemContentContainer()) {
      return;
    }

    const templateType: Type<NaiscItemContent> = (
      this.templates ?
        this.templates
          .find(te => te[NAISC_METADATA_ACCESSOR].type.some(ty => ty === this.item.type)) as any :
        null
    ) || NaiscDefaultItemComponent;

    if (templateType === this.contentRefType) {
      return;
    }

    if (this.contentRef) {
      this.contentRef.destroy();
    }

    this.contentRef = this.itemContentContainer().createComponent(templateType);
    this.contentRefType = templateType;

    this.contentRef.instance.item = this.item;
    this.contentRef.instance.overlay = this.overlayRef;
    this.contentRef.instance.readonly = this.readonly;
    this.contentRef.instance.notifyChanges = this.fireStateChange;

    this.contentRef.instance.viewState = this.state;
    this.contentRef.instance.viewState$ = this.state$;

    runAsyncTask(() => this.render(false, true, true));
  }

  public onLinkInternal(a: 'start' | 'end' | 'remove', p: NaiscPinDescriptor): void {
    this.render(false, true, true);
    this.onLink(a, p);

    this.updateZIndex();
  }

  public render(useAnimations = false,
                forced = false,
                thisZone = false): void {

    if (!forced && this.item.position.x === this.projectionCurrent.x && this.item.position.y === this.projectionCurrent.y) {
      return;
    }

    const _render = () => {
      useAnimations = useAnimations && typeof window.requestAnimationFrame === 'function';

      const setStyle = (x: number, y: number) => {
        this.el.nativeElement.style.transform = `translate(${x}px, ${y}px)`;

        this.projectionCurrent.x = x;
        this.projectionCurrent.y = y;

        this.recalculatePinsPosition();
      };

      const pt = this.item.position;

      if (!useAnimations) {
        setStyle(pt.x, pt.y);
      } else {
        const pc = this.projectionCurrent;
        const af = this.animationFunction;

        let startTs: number = null;
        const animate = (timestamp) => {
          if (startTs == null) {
            startTs = timestamp;
          }

          const span = timestamp - startTs;

          if (span >= this.animationDuration) {
            setStyle(pt.x, pt.y);
            return;
          }

          const t = span / this.animationDuration;

          setStyle(af(pc.x, pt.x, t), af(pc.y, pt.y, t));
          this.animationRequestRef = requestAnimationFrame(animate);
        };

        cancelAnimationFrame(this.animationRequestRef);
        this.animationRequestRef = requestAnimationFrame(animate);
      }
    };

    if (thisZone) {
      _render();
    } else {
      this.zone.runOutsideAngular(_render);
    }
  }

  public getItemExtent(): NaiscExtent {
    let width = 100;
    let height = 100;

    if (typeof this.el.nativeElement.getBoundingClientRect === 'function') {
      const rect = this.el.nativeElement.getBoundingClientRect();

      width = rect.width / this.parentProjection.z;
      height = rect.height / this.parentProjection.z;
    }

    return [
      this.item.position.y,
      this.item.position.x + width,
      this.item.position.y + height,
      this.item.position.x
    ];
  }

  public calculatePinPosition(pin: NaiscPinDescriptor,
                              pinPosition: ViewProjection,
                              itemPosition: ViewProjection = this.getItemPosition()): void {
    const diffX = (pinPosition.x - itemPosition.x) / this.parentProjection.z;
    const diffY = (pinPosition.y - itemPosition.y) / this.parentProjection.z;

    pin[NAISC_PIN_POSITION] = {
      x: this.projectionCurrent.x + diffX,
      y: this.projectionCurrent.y + diffY
    };
  }

  private listenDragEvents(): void {
    const cDown = fromEvent<MouseEvent>(this.titleBarRef().nativeElement, 'mousedown').pipe(
      filter(() => !this.readonly)
    );
    const cDrag = cDown.pipe(
      tap(() => this.updateZIndex()),
      filter(down => down.button === 0), // Left Click
      switchMap(down => this.onMove.pipe(
        tap(() => this.dragging = true),
        startWith(down),
        takeUntil(
          this.onActionEnd.pipe(
            tap(() => this.dragging = false),
            tap(() => this.fireStateChange())
          )
        )
      )),
      share()
    );

    let evtPos: ViewProjection;
    let itemPos: ViewProjection;

    this.dragSubscription = cDrag.subscribe(evt => {
      evt.preventDefault();
      evt.stopPropagation();

      const curX = evt.clientX;
      const curY = evt.clientY;

      if (evt.type === 'mousedown') {
        evtPos = {x: curX, y: curY};
        itemPos = {
          x: this.item.position.x,
          y: this.item.position.y
        };
        return;
      }

      const diffX = (curX - evtPos.x) / this.parentProjection.z;
      const diffY = (curY - evtPos.y) / this.parentProjection.z;

      let x = itemPos.x + diffX;
      let y = itemPos.y + diffY;

      if (this.snap) {
        x = Math.round(x / 10) * 10;
        y = Math.round(y / 10) * 10;
      }

      this.item.position.x = x;
      this.item.position.y = y;

      this.render();
    });
  }

  private updateZIndex(): void {
    this.currentZIndex = this.generateZIndex(this.currentZIndex);
  }

  private recalculatePinsPosition(): void {
    if (!this.el || typeof this.el.nativeElement.getBoundingClientRect !== 'function') {
      return;
    }

    const localPosition = this.getItemPosition();
    this.pinRefs().forEach(pinRef => this.calculatePinPosition(pinRef.pin, pinRef.getPinPosition(), localPosition));
  }

  private getItemPosition(): ViewProjection {
    if (typeof this.el.nativeElement.getBoundingClientRect !== 'function') {
      return {x: 0, y: 0};
    }

    const rect = this.el.nativeElement.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    const x = rect.left + scrollLeft;
    const y = rect.top + scrollTop;

    return {x, y};
  }
}
