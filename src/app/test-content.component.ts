import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {NaiscItem, NaiscItemContent} from '@naisc/core';


@Component({
  standalone: true,
  template: `
    <div #testRef>test</div>

    Hello World
    <input [readonly]="readonly" [value]="viewState['state-key']"/>
  `
})
@NaiscItem('test', {
  inputPins: [
    {type: 'a', multiple: true}
  ],
  outputPins: [
    {type: 'a', multiple: false}
  ]
})
export class TestContentComponent extends NaiscItemContent implements AfterViewInit {
  @ViewChild('testRef', {static: true}) public testRef: ElementRef;

  private readonly title = 'My Node';

  public ngAfterViewInit(): void {
    // this.overlay.appendChild(this.testRef.nativeElement);
    this.viewState$.subscribe(evt => {
      console.log('State changed:', evt);
    });
  }

  public getTitle(): string {
    return this.title;
  }

  public getInputPinName(idx: number): string {
    return 'Generic input';
  }

  public getOutputPinName(idx: number): string {
    return 'Generic output';
  }
}
