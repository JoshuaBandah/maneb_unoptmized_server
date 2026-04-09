import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class AppService {
    constructor(
    @InjectMetric('http_requests_total')
    private readonly httpCounter: Counter<string>,
  ) {}
  getHello(): string {
    return 'Hello World!';
  }

    handleRequest() {
      this.httpCounter.labels('GET', '/users', '200').inc();
  }
}
