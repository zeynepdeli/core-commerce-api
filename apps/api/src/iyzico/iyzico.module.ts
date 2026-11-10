import { Module } from '@nestjs/common';

import { IyzicoClient } from './iyzico.client.js';
import { RefundsService } from './refunds.service.js';

@Module({ providers: [IyzicoClient, RefundsService], exports: [IyzicoClient, RefundsService] })
export class IyzicoModule {}
