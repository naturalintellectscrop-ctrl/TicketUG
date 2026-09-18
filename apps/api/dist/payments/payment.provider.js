var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
export class TestPaymentProvider {
    name = 'test';
    initiate(input) {
        return Promise.resolve({ providerAttemptReference: `test_${input.attemptPublicId}`, instructions: 'Non-production test adapter only.' });
    }
    signWebhook(body) {
        const secret = process.env.PAYMENT_TEST_WEBHOOK_SECRET ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'ticketug-development-test-only' : null);
        if (!secret)
            throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED');
        const rawBody = JSON.stringify(body);
        const timestamp = String(Date.now());
        const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
        return { rawBody, headers: { 'x-payment-signature': signature, 'x-payment-timestamp': timestamp } };
    }
    verifyWebhook(input) {
        const secret = process.env.PAYMENT_TEST_WEBHOOK_SECRET ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'ticketug-development-test-only' : null);
        if (!secret)
            throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED');
        const signature = input.headers['x-payment-signature'];
        const timestamp = input.headers['x-payment-timestamp'];
        if (!signature || !timestamp || Math.abs(Date.now() - Number(timestamp)) > 300_000)
            throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE');
        const expected = createHmac('sha256', secret).update(`${timestamp}.${input.rawBody}`).digest('hex');
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b))
            throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE');
        const event = input.body;
        if (typeof event.eventId !== 'string' || typeof event.attemptReference !== 'string' || typeof event.orderReference !== 'string' || typeof event.amountMinorUnits !== 'number' || typeof event.currency !== 'string' || typeof event.status !== 'string')
            throw new BadRequestException('Malformed webhook');
        return { providerEventId: event.eventId, eventType: typeof event.type === 'string' ? event.type : 'payment.updated', providerAttemptReference: event.attemptReference, orderReference: event.orderReference, amountMinorUnits: BigInt(event.amountMinorUnits), currency: event.currency, status: event.status };
    }
}
let ProviderRegistry = class ProviderRegistry {
    test = new TestPaymentProvider();
    get(name) {
        if (name === 'test' && process.env.NODE_ENV !== 'production')
            return this.test;
        throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED');
    }
    selected() { return process.env.PAYMENT_PROVIDER ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'test' : null); }
    testWebhook(body) { return this.test.signWebhook(body); }
};
ProviderRegistry = __decorate([
    Injectable()
], ProviderRegistry);
export { ProviderRegistry };
