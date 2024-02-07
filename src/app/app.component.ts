import { Component, OnInit, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { KeyValue } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import * as forge from 'node-forge';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'TriggMeFrontend';
  showImage = false;
  showBuckets = true;
  qrCode = '';

  triggmebody = {
    token: '',
    discount_level: 2.0,
    average_purchase_count: 0,
    innkjopspris_prosent: 2.0,
    average_purchase: 240.0,
    triggme_fee_prosent: 10.0,
    humaniter_fee_prosent: 10.0,
    total_purchase: 0.0,
    trigg_purchase: [0],
    tilgodelapp: [0],
    triggme_avgift: [0],
    humaniter_andel: [0],
    qrcode: [{}],
  };

  last_purchase = {
    lastPurchase: 0.0,
    token: '',
  };

  maxAmount: number = 0;
  minimumBucketAmount: number = 0.0;
  username: string = '';
  password: string = '';
  token: any = null;

  bucketInput: any[] = [];
  buyBucket: any = {};
  simulate_count = 100;
  httpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });
  httpOptions = {
    headers: this.httpHeaders,
    responseType: 'json',
    observe: 'body',
    withCredentials: true,
  };

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {}

  login(): void {
    if (this.username.length > 1 && this.password.length > 1) {
      this.http
        .post(
          'http://localhost:8778/triggme/demo',
          { user: this.username, pass: this.password },
          {
            headers: this.httpHeaders,
            responseType: 'json',
            observe: 'body',
            withCredentials: false,
          }
        )
        .subscribe((result: any) => {
          console.log(result);
          this.token = result.token;
          this.last_purchase.token = this.token;
          this.triggmebody.token = this.token;
        });
    }
  }

  teller: number = 0;

  simulatePurchase(): void {
    this.triggmebody.total_purchase = 0.0;
    this.triggmebody.tilgodelapp = [];
    this.triggmebody.triggme_avgift = [];
    this.triggmebody.trigg_purchase = [];
    this.triggmebody.humaniter_andel = [];
    this.triggmebody.qrcode = [];
    this.teller = 0;
    let buck = [];
    let low = 0.0;
    let high = this.maxAmount;
    if (this.triggmebody.average_purchase >= this.minimumBucketAmount) {
      buck = this.bucketInput.filter(
        (bucket: any) =>
          this.triggmebody.average_purchase >= bucket.purchaseLimitLow &&
          this.triggmebody.average_purchase <= bucket.purchaseLimitHigh
      );
      low = buck[0].purchaseLimitLow;
      high = buck[0].purchaseLimitHigh;
    }

    for (let i = 0; i < this.simulate_count; i++) {
      setTimeout(() => {
        const r = Math.random() * Math.random();
        const p = Math.floor((high - low) * r + low);
        this.buySomething(p);
      }, 60 * i);
    }
  }

  buySomething(p?: number): void {
    if (!p || p < this.minimumBucketAmount) return;
    let lp = this.last_purchase;
    if (p) {
      lp = {
        lastPurchase: p,
        token: this.token,
      };
    }
    this.last_purchase = lp;
    this.triggmebody.total_purchase += this.last_purchase.lastPurchase;
    this.http
      .post('http://localhost:8778/triggme/demo/buy', lp, {
        headers: this.httpHeaders,
        responseType: 'json',
        observe: 'body',
        withCredentials: false,
      })
      .subscribe((result: any) => {
        this.teller++;
        this.buyBucket = result;
        this.bucketInput.forEach((bucket: any) => {
          const arr = Object.keys(bucket);
          arr.forEach((item: string) => {
            if (item.includes('Hot')) {
              delete bucket[item];
            } else {
              bucket[item + 'Hot'] = false;
            }
          });
          if (result.bucketId === bucket.bucketId) {
            const a = Object.keys(result);
            bucket.buyCount++;
            a.forEach((item: string) => {
              if (item.includes('Hot')) {
                delete bucket[item];
              } else {
                bucket[item + 'Hot'] =
                  Math.abs(bucket[item] - result[item]) > 0.01;
                bucket[item] = result[item];
              }
            });
            if (bucket.latestDiscountValue > 0.0) {
              this.triggmebody.trigg_purchase.push(
                this.last_purchase.lastPurchase
              );
              this.triggmebody.tilgodelapp.push(bucket.latestDiscountValue);
              const qrcontent = {
                qrcode_content: 'Tilgodelapp kr ' + bucket.latestDiscountValue,
                token: this.token,
              };
              this.http
                .post('http://localhost:8778/triggme/demo/qrcode', qrcontent, {
                  headers: this.httpHeaders,
                  responseType: 'text',
                  observe: 'body',
                  withCredentials: false,
                })
                .subscribe((result: any) => {
                  const qr =
                    this.sanitizer.bypassSecurityTrustResourceUrl(result);
                  this.triggmebody.qrcode.push(qr);
                });
              this.triggmebody.triggme_avgift.push(bucket.triggMeFeeValue);
              this.triggmebody.humaniter_andel.push(bucket.humanitarianValue);
            }
          }
        });
      });
  }

  getBuckets(): void {
    this.http
      .post('http://localhost:8778/triggme/demo/setup', this.triggmebody, {
        headers: this.httpHeaders,
        responseType: 'json',
        observe: 'body',
        withCredentials: false,
      })
      .subscribe((result: any) => {
        console.log(result);

        this.bucketInput = result['buckets'];
        this.bucketInput.forEach((bucket: any) => (bucket.buyCount = 0));
        this.minimumBucketAmount = this.bucketInput[0].purchaseLimitLow;
        this.maxAmount =
          this.bucketInput[this.bucketInput.length - 1].purchaseLimitHigh;
      });
  }
}
