import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { calculateLineTotal, calculateOrderTotal, validateOrderItems } from './order.rules';
const orderSummary = `o.id, o.public_id, o.order_number, o.user_profile_id, o.purchaser_name, o.purchaser_email, o.status, o.currency, o.total_minor_units, o.created_at, o.updated_at, o.cancelled_at`;
export class OrdersService {
    db;
    constructor(db) {
        this.db = db;
    }
    tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
    orderNumber() { return `UG-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`; }
    present(order, items) {
        return { publicId: order.public_id, orderNumber: order.order_number, status: order.status, purchaserName: order.purchaser_name, purchaserEmail: order.purchaser_email, currency: order.currency, totalMinorUnits: Number(order.total_minor_units), createdAt: order.created_at, updatedAt: order.updated_at, cancelledAt: order.cancelled_at, items: items.map((item) => ({ ticketTypeId: item.ticket_type_id, ticketName: item.ticket_name_snapshot, quantity: item.quantity, unitPriceMinorUnits: Number(item.unit_price_minor_units), currency: item.currency_snapshot, lineTotalMinorUnits: Number(item.line_total_minor_units) })) };
    }
    async withItems(order) {
        const items = await this.db.query('SELECT ticket_type_id, ticket_name_snapshot, quantity, unit_price_minor_units, currency_snapshot, line_total_minor_units FROM ticketug.order_item WHERE order_id=$1 ORDER BY created_at', [order.id]);
        return this.present(order, items.rows);
    }
    async create(user, body, guest = false) {
        try {
            validateOrderItems(body.items);
        }
        catch (error) {
            throw new BadRequestException(error instanceof Error ? error.message : 'Invalid order items');
        }
        if (!guest && !user)
            throw new ForbiddenException('Authentication required');
        if (guest && !body.purchaserEmail)
            throw new BadRequestException('Guest email is required');
        const purchaserEmail = body.purchaserEmail.trim().toLowerCase();
        const guestToken = guest ? randomBytes(32).toString('base64url') : null;
        const guestHash = guestToken ? this.tokenHash(guestToken) : null;
        const result = await this.db.transaction(async (client) => {
            if (body.idempotencyKey) {
                const existing = await client.query(`SELECT ${orderSummary} FROM ticketug.order o WHERE ${guest ? 'o.user_profile_id IS NULL AND o.purchaser_email=$1' : 'o.user_profile_id=$1'} AND o.idempotency_key=$2`, [guest ? purchaserEmail : user.profileId, body.idempotencyKey]);
                if (existing.rows[0]) {
                    if (guest)
                        throw new ConflictException('Guest idempotency key was already used; use the original access token');
                    return { order: existing.rows[0], token: null, reused: true };
                }
            }
            const requested = [...body.items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
            const locked = [];
            for (const item of requested) {
                const ticket = await client.query('SELECT t.id, t.public_id, t.event_id, t.active, t.name, t.price_minor_units, t.currency, t.remaining_capacity, t.sale_starts_at, t.sale_ends_at, e.lifecycle_state AS event_state, e.publication_state FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id=t.event_id WHERE (t.id=$1 OR t.public_id=$1) FOR UPDATE OF t', [item.ticketTypeId]);
                const row = ticket.rows[0];
                if (!row)
                    throw new NotFoundException('Ticket type not found');
                locked.push(row);
            }
            const now = Date.now();
            const lines = [];
            for (const item of body.items) {
                const ticket = locked.find((candidate) => candidate.id === item.ticketTypeId || candidate.public_id === item.ticketTypeId);
                if (!ticket.active)
                    throw new ConflictException('Ticket type is inactive');
                if (ticket.event_state !== 'SALES_OPEN' || ticket.publication_state !== 'PUBLIC')
                    throw new ConflictException('Event is not accepting orders');
                if (ticket.sale_starts_at && now < Date.parse(ticket.sale_starts_at))
                    throw new ConflictException('Ticket sales have not started');
                if (ticket.sale_ends_at && now >= Date.parse(ticket.sale_ends_at))
                    throw new ConflictException('Ticket sales have ended');
                if (ticket.remaining_capacity < item.quantity)
                    throw new ConflictException('Insufficient ticket inventory');
                let line;
                try {
                    line = calculateLineTotal(Number(ticket.price_minor_units), item.quantity);
                }
                catch (error) {
                    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid order total');
                }
                lines.push({ item, ticket, line });
            }
            const total = calculateOrderTotal(lines.map((line) => line.line));
            for (const line of lines) {
                const consumed = await client.query('UPDATE ticketug.ticket_type SET remaining_capacity=remaining_capacity-$2, updated_at=now() WHERE id=$1 AND remaining_capacity >= $2', [line.ticket.id, line.item.quantity]);
                if (consumed.rowCount !== 1)
                    throw new ConflictException('Insufficient ticket inventory');
            }
            const orderId = randomUUID();
            const order = await client.query(`INSERT INTO ticketug.order (id, public_id, order_number, user_profile_id, purchaser_name, purchaser_email, guest_access_token_hash, currency, total_minor_units, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,'UGX',$8,$9) RETURNING ${orderSummary}`, [orderId, `ord_${randomBytes(12).toString('hex')}`, this.orderNumber(), user?.profileId ?? null, body.purchaserName.trim(), purchaserEmail, guestHash, total, body.idempotencyKey ?? null]);
            for (const line of lines)
                await client.query('INSERT INTO ticketug.order_item (id,order_id,ticket_type_id,quantity,ticket_name_snapshot,unit_price_minor_units,currency_snapshot,line_total_minor_units) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), orderId, line.ticket.id, line.item.quantity, line.ticket.name, line.ticket.price_minor_units, line.ticket.currency, line.line]);
            return { order: order.rows[0], token: guestToken, reused: false };
        });
        const full = await this.withItems(result.order);
        return result.token ? { ...full, guestAccessToken: result.token } : full;
    }
    async listMine(user) { const result = await this.db.query(`SELECT ${orderSummary} FROM ticketug.order o WHERE o.user_profile_id=$1 ORDER BY o.created_at DESC`, [user.profileId]); return Promise.all(result.rows.map((order) => this.withItems(order))); }
    async getMine(user, publicId) { const order = await this.findByPublicId(publicId); if (order.user_profile_id !== user.profileId)
        throw new NotFoundException('Order not found'); return this.withItems(order); }
    async getGuest(publicId, token) { const result = await this.db.query(`SELECT ${orderSummary}, o.guest_access_token_hash FROM ticketug.order o WHERE o.public_id=$1`, [publicId]); const order = result.rows[0]; if (!order || !order.guest_access_token_hash || order.guest_access_token_hash !== this.tokenHash(token))
        throw new NotFoundException('Order not found'); return this.withItems(order); }
    async findByPublicId(publicId) { const result = await this.db.query(`SELECT ${orderSummary} FROM ticketug.order o WHERE o.public_id=$1`, [publicId]); if (!result.rows[0])
        throw new NotFoundException('Order not found'); return result.rows[0]; }
    async cancel(user, publicId) {
        const order = await this.findByPublicId(publicId);
        if (order.user_profile_id !== user.profileId)
            throw new NotFoundException('Order not found');
        return this.db.transaction(async (client) => {
            const locked = (await client.query(`SELECT ${orderSummary} FROM ticketug.order o WHERE o.id=$1 FOR UPDATE`, [order.id])).rows[0];
            if (locked.status !== 'AWAITING_PAYMENT')
                throw new ConflictException('Order cannot be cancelled in its current state');
            const items = (await client.query('SELECT ticket_type_id, ticket_name_snapshot, quantity, unit_price_minor_units, currency_snapshot, line_total_minor_units FROM ticketug.order_item WHERE order_id=$1 ORDER BY created_at', [order.id])).rows;
            for (const item of items)
                await client.query('UPDATE ticketug.ticket_type SET remaining_capacity=remaining_capacity+$2, updated_at=now() WHERE id=$1 AND remaining_capacity + $2 <= capacity', [item.ticket_type_id, item.quantity]);
            const updated = (await client.query(`UPDATE ticketug.order SET status='CANCELLED', cancelled_at=now(), updated_at=now() WHERE id=$1 RETURNING ${orderSummary}`, [order.id])).rows[0];
            return this.present(updated, items);
        });
    }
    async listForEvent(user, eventId) {
        const access = await this.db.query('SELECT organizer_id FROM ticketug.event WHERE id=$1', [eventId]);
        const organizerId = access.rows[0]?.organizer_id;
        if (!organizerId)
            throw new NotFoundException('Event not found');
        const membership = user.organizerMemberships.find((item) => item.organizerId === organizerId && item.status === 'ACTIVE' && ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER'].includes(item.role));
        if (!membership)
            throw new ForbiddenException('Organizer access denied');
        const result = await this.db.query(`SELECT DISTINCT ${orderSummary} FROM ticketug.order o JOIN ticketug.order_item oi ON oi.order_id=o.id JOIN ticketug.ticket_type t ON t.id=oi.ticket_type_id WHERE t.event_id=$1 ORDER BY o.created_at DESC`, [eventId]);
        return Promise.all(result.rows.map((order) => this.withItems(order)));
    }
}
