import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
    const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false });
    app.use(express.json({ limit: '256kb', verify: (request, _response, buffer) => { request.rawBody = Buffer.from(buffer); } }));
    app.use(helmet());
    app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',').filter(Boolean) ?? ['http://localhost:3000'], credentials: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    const config = new DocumentBuilder().setTitle('TicketUG API').setDescription('TicketUG identity and organizer API').setVersion('1.0').addCookieAuth('better-auth.session_token').build();
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));
    app.enableShutdownHooks();
    await app.listen(Number(process.env.API_PORT ?? 4000), process.env.API_HOST ?? '0.0.0.0');
}
void bootstrap();
