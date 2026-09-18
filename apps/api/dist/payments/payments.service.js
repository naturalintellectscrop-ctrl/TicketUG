var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../common/database.service';
import { assertPaymentTransition } from './payment.rules';
import { ProviderRegistry } from './payment.provider';
import { TicketsService } from '../tickets/tickets.service';
const paymentSelect = `p.id,p.public_id,p.order_id,o.public_id AS order_public_id,o.order_number,p.amount_minor_units,p.currency,p.provider,p.status,o.payment_expires_at`;
let PaymentsService = class PaymentsService {
    db;
    providers;
    tickets;
    constructor(db, providers, tickets) {
        this.db = db;
        this.providers = providers;
        this.tickets = tickets;
    }
    async orderForAccess(publicId, user) { const result = await this.db.query('SELECT id,public_id,order_number,user_profile_id,status,payment_expires_at,total_minor_units,currency FROM ticketug.order WHERE public_id=$1', [publicId]); const order = result.rows[0]; if (!order)
        throw new NotFoundException('Order not found'); if (order.user_profile_id !== user.profileId)
        throw new NotFoundException('Order not found'); return order; }
    async initiate(user, publicId, body) {
        const order = await this.orderForAccess(publicId, user);
        const providerName = body.provider ?? this.providers.selected();
        if (!providerName)
            throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED');
        const provider = this.providers.get(providerName);
        return this.db.transaction(async (client) => {
            const locked = (await client.query('SELECT id,public_id,order_number,user_profile_id,status,payment_expires_at,total_minor_units,currency FROM ticketug.order WHERE id=$1 FOR UPDATE', [order.id])).rows[0];
            if (locked.status === 'PAID')
                throw new ConflictException('PAYMENT_ALREADY_SUCCEEDED');
            if (['CANCELLED', 'EXPIRED'].includes(locked.status))
                throw new ConflictException('ORDER_EXPIRED');
            const existing = (await client.query(`SELECT ${paymentSelect},a.public_id AS attempt_public_id,a.status AS attempt_status,a.provider_attempt_reference FROM ticketug.payment p JOIN ticketug.order o ON o.id=p.order_id LEFT JOIN ticketug.payment_attempt a ON a.payment_id=p.id AND a.status IN ('PENDING','PROCESSING') WHERE p.order_id=$1 AND a.idempotency_key=$2`, [locked.id, body.idempotencyKey])).rows[0];
            if (existing)
                return this.present(existing);
            const paymentId = randomUUID();
            const paymentPublicId = `pay_${randomBytes(12).toString('hex')}`;
            const attemptId = randomUUID();
            const attemptPublicId = `pat_${randomBytes(12).toString('hex')}`;
            await client.query(`INSERT INTO ticketug.payment(id,public_id,order_id,provider,amount_minor_units,currency) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(order_id) DO NOTHING`, [paymentId, paymentPublicId, locked.id, providerName, locked.total_minor_units, locked.currency]);
            const payment = (await client.query('SELECT id,public_id FROM ticketug.payment WHERE order_id=$1 FOR UPDATE', [locked.id])).rows[0];
            const inserted = await client.query(`INSERT INTO ticketug.payment_attempt(id,public_id,payment_id,provider,amount_minor_units,currency,idempotency_key,status) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING')`, [attemptId, attemptPublicId, payment.id, providerName, locked.total_minor_units, locked.currency, body.idempotencyKey]);
            if (inserted.rowCount !== 1)
                throw new ConflictException('Duplicate payment initiation');
            const initiation = await provider.initiate({ paymentPublicId: payment.public_id, attemptPublicId, amountMinorUnits: BigInt(locked.total_minor_units), currency: locked.currency, orderReference: locked.public_id });
            await client.query('UPDATE ticketug.payment_attempt SET provider_attempt_reference=$2,provider_metadata=$3,status=$4,processing_at=now() WHERE id=$1', [attemptId, initiation.providerAttemptReference, JSON.stringify(initiation.metadata ?? {}), 'PROCESSING']);
            await client.query("UPDATE ticketug.payment SET status='PROCESSING',updated_at=now() WHERE id=$1", [payment.id]);
            await client.query("UPDATE ticketug.order SET status='PAYMENT_PROCESSING', payment_state='PAYMENT_PROCESSING', updated_at=now() WHERE id=$1", [locked.id]);
            return { paymentId: payment.public_id, attemptId: attemptPublicId, status: 'PROCESSING', provider: providerName, providerAttemptReference: initiation.providerAttemptReference, redirectUrl: initiation.redirectUrl, instructions: initiation.instructions, amountMinorUnits: Number(locked.total_minor_units), currency: locked.currency };
        });
    }
    async simulateTestSuccess(publicId, token) {
        if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE !== 'test')
            throw new ServiceUnavailableException('TEST_PAYMENT_DISABLED');
        const order = await this.guestOrder(publicId, token);
        const result = await this.db.query(`SELECT a.provider_attempt_reference,a.amount_minor_units,a.currency,o.public_id FROM ticketug.payment_attempt a JOIN ticketug.payment p ON p.id=a.payment_id JOIN ticketug.order o ON o.id=p.order_id WHERE a.payment_id=(SELECT id FROM ticketug.payment WHERE order_id=$1) ORDER BY a.initiated_at DESC LIMIT 1`, [order.id]);
        const attempt = result.rows[0];
        if (!attempt?.provider_attempt_reference)
            throw new NotFoundException('PAYMENT_ATTEMPT_NOT_FOUND');
        const event = { eventId: `test_evt_${randomUUID()}`, type: 'payment.succeeded', attemptReference: attempt.provider_attempt_reference, orderReference: attempt.public_id, amountMinorUnits: Number(attempt.amount_minor_units), currency: attempt.currency, status: 'SUCCEEDED' };
        const signed = this.providers.testWebhook(event);
        return this.webhook('test', signed.headers, event, signed.rawBody);
    }
    async status(user, publicId) { const order = await this.orderForAccess(publicId, user); const result = await this.db.query(`SELECT ${paymentSelect},a.public_id AS attempt_public_id,a.status AS attempt_status,a.provider_attempt_reference FROM ticketug.payment p JOIN ticketug.order o ON o.id=p.order_id LEFT JOIN ticketug.payment_attempt a ON a.payment_id=p.id WHERE p.order_id=$1 ORDER BY a.initiated_at DESC LIMIT 1`, [order.id]); if (!result.rows[0])
        throw new NotFoundException('PAYMENT_NOT_FOUND'); return this.present(result.rows[0]); }
    async guestOrder(publicId, token) { const result = await this.db.query('SELECT id,public_id,order_number,user_profile_id,status,payment_expires_at,total_minor_units,currency,guest_access_token_hash FROM ticketug.order WHERE public_id=$1', [publicId]); const order = result.rows[0]; if (!order || order.guest_access_token_hash !== createHash('sha256').update(token).digest('hex'))
        throw new NotFoundException('Order not found'); return order; }
    async initiateGuest(publicId, token, body) { const order = await this.guestOrder(publicId, token); const providerName = body.provider ?? this.providers.selected(); if (!providerName)
        throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED'); const provider = this.providers.get(providerName); return this.db.transaction(async (client) => { const locked = (await client.query('SELECT id,public_id,order_number,user_profile_id,status,payment_expires_at,total_minor_units,currency,guest_access_token_hash FROM ticketug.order WHERE id=$1 FOR UPDATE', [order.id])).rows[0]; if (['PAID', 'CANCELLED', 'EXPIRED'].includes(locked.status))
        throw new ConflictException('ORDER_EXPIRED'); const paymentId = randomUUID(); const paymentPublicId = `pay_${randomBytes(12).toString('hex')}`; const attemptId = randomUUID(); const attemptPublicId = `pat_${randomBytes(12).toString('hex')}`; await client.query(`INSERT INTO ticketug.payment(id,public_id,order_id,provider,amount_minor_units,currency) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(order_id) DO NOTHING`, [paymentId, paymentPublicId, locked.id, providerName, locked.total_minor_units, locked.currency]); const payment = (await client.query('SELECT id,public_id FROM ticketug.payment WHERE order_id=$1 FOR UPDATE', [locked.id])).rows[0]; const existing = (await client.query('SELECT ' + paymentSelect + ',a.public_id AS attempt_public_id,a.status AS attempt_status,a.provider_attempt_reference FROM ticketug.payment p JOIN ticketug.order o ON o.id=p.order_id JOIN ticketug.payment_attempt a ON a.payment_id=p.id WHERE p.id=$1 AND a.idempotency_key=$2', [payment.id, body.idempotencyKey])).rows[0]; if (existing)
        return this.present(existing); await client.query(`INSERT INTO ticketug.payment_attempt(id,public_id,payment_id,provider,amount_minor_units,currency,idempotency_key,status) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING')`, [attemptId, attemptPublicId, payment.id, providerName, locked.total_minor_units, locked.currency, body.idempotencyKey]); const initiation = await provider.initiate({ paymentPublicId: payment.public_id, attemptPublicId, amountMinorUnits: BigInt(locked.total_minor_units), currency: locked.currency, orderReference: locked.public_id }); await client.query('UPDATE ticketug.payment_attempt SET provider_attempt_reference=$2,provider_metadata=$3,status=\'PROCESSING\',processing_at=now() WHERE id=$1', [attemptId, initiation.providerAttemptReference, JSON.stringify(initiation.metadata ?? {})]); await client.query("UPDATE ticketug.payment SET status='PROCESSING',updated_at=now() WHERE id=$1", [payment.id]); await client.query("UPDATE ticketug.order SET status='PAYMENT_PROCESSING',payment_state='PAYMENT_PROCESSING',updated_at=now() WHERE id=$1", [locked.id]); return { paymentId: payment.public_id, attemptId: attemptPublicId, status: 'PROCESSING', provider: providerName, providerAttemptReference: initiation.providerAttemptReference, instructions: initiation.instructions, redirectUrl: initiation.redirectUrl, amountMinorUnits: Number(locked.total_minor_units), currency: locked.currency }; }); }
    async statusGuest(publicId, token) { const order = await this.guestOrder(publicId, token); const result = await this.db.query(`SELECT ${paymentSelect},a.public_id AS attempt_public_id,a.status AS attempt_status,a.provider_attempt_reference FROM ticketug.payment p JOIN ticketug.order o ON o.id=p.order_id LEFT JOIN ticketug.payment_attempt a ON a.payment_id=p.id WHERE p.order_id=$1 ORDER BY a.initiated_at DESC LIMIT 1`, [order.id]); if (!result.rows[0])
        throw new NotFoundException('PAYMENT_NOT_FOUND'); return this.present(result.rows[0]); }
    present(row) { return { paymentId: row.public_id, attemptId: row.attempt_public_id, status: row.status, attemptStatus: row.attempt_status, provider: row.provider, providerAttemptReference: row.provider_attempt_reference, amountMinorUnits: Number(row.amount_minor_units), currency: row.currency, orderId: row.order_public_id, orderNumber: row.order_number }; }
    async webhook(providerName, headers, body, rawBody) {
        const provider = this.providers.get(providerName);
        const event = provider.verifyWebhook({ headers, body, rawBody });
        return this.db.transaction(async (client) => {
            const inserted = await client.query(`INSERT INTO ticketug.webhook_event(id,provider,provider_event_id,event_type,signature_verified,payload,provider_reference) VALUES($1,$2,$3,$4,true,$5,$6) ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING id`, [randomUUID(), providerName, event.providerEventId, event.eventType, JSON.stringify(body), event.providerAttemptReference]);
            if (!inserted.rows[0])
                return { status: 'DUPLICATE' };
            const attempt = (await client.query(`SELECT p.id,p.public_id,p.order_id,o.public_id AS order_public_id,o.order_number,p.amount_minor_units,p.currency,p.provider,p.status,o.payment_expires_at,a.public_id AS attempt_public_id,a.status AS attempt_status,a.provider_attempt_reference FROM ticketug.payment_attempt a JOIN ticketug.payment p ON p.id=a.payment_id JOIN ticketug.order o ON o.id=p.order_id WHERE p.provider=$1 AND a.provider_attempt_reference=$2 FOR UPDATE OF p,a,o`, [providerName, event.providerAttemptReference])).rows[0];
            if (!attempt)
                throw new NotFoundException('Unknown provider transaction');
            if (attempt.amount_minor_units !== event.amountMinorUnits.toString())
                throw new UnprocessableEntityException('INVALID_PAYMENT_AMOUNT');
            if (attempt.currency !== event.currency)
                throw new UnprocessableEntityException('INVALID_PAYMENT_CURRENCY');
            if (event.orderReference !== attempt.order_public_id)
                throw new UnprocessableEntityException('INVALID_PAYMENT_ORDER');
            if (attempt.status === 'SUCCEEDED') {
                await client.query("UPDATE ticketug.webhook_event SET processing_status='DUPLICATE',processed_at=now() WHERE id=$1", [inserted.rows[0].id]);
                return { status: 'DUPLICATE' };
            }
            assertPaymentTransition(attempt.status, event.status);
            await client.query('UPDATE ticketug.payment_attempt SET status=$2,completed_at=now() WHERE id=$1', [attempt.attempt_public_id ? (await client.query('SELECT id FROM ticketug.payment_attempt WHERE public_id=$1', [attempt.attempt_public_id])).rows[0].id : '', event.status]);
            await client.query('UPDATE ticketug.payment SET status=$2,successful_provider_reference=CASE WHEN $2=\'SUCCEEDED\' THEN $3 ELSE successful_provider_reference END,updated_at=now(),succeeded_at=CASE WHEN $2=\'SUCCEEDED\' THEN now() ELSE succeeded_at END WHERE id=$1', [attempt.id, event.status, event.providerAttemptReference]);
            await client.query('UPDATE ticketug.order SET status=CASE WHEN $2=\'SUCCEEDED\' THEN \'PAID\' ELSE status END,payment_state=CASE WHEN $2=\'SUCCEEDED\' THEN \'PAID\' ELSE payment_state END,updated_at=now() WHERE id=$1', [attempt.order_id, event.status]);
            if (event.status === 'SUCCEEDED')
                await this.tickets.issuePaidOrder(client, { orderId: attempt.order_id, paymentId: attempt.id, providerReference: event.providerAttemptReference });
            await client.query("UPDATE ticketug.webhook_event SET processing_status='PROCESSED',processed_at=now() WHERE id=$1", [inserted.rows[0].id]);
            return { status: 'PROCESSED' };
        });
    }
};
PaymentsService = __decorate([
    Injectable(),
    __param(0, Inject(DatabaseService)),
    __metadata("design:paramtypes", [DatabaseService, ProviderRegistry, TicketsService])
], PaymentsService);
export { PaymentsService };
