import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { HttpLoggingInterceptor } from './common/http-logging.interceptor';
import { AppModule } from './app.module';
import { swaggerBasicAuth } from './common/swagger-basic-auth';
import { trustProxySetting } from './config/trust-proxy';
import { requestIdMiddleware } from './common/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxySetting(process.env.TRUST_PROXY));
  app.use(requestIdMiddleware);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  const swagger = new DocumentBuilder()
    .setTitle('Hotel Business Manager API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  app.use('/api/docs', swaggerBasicAuth(process.env.SWAGGER_USERNAME, process.env.SWAGGER_PASSWORD));
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: 'api/docs/openapi.json',
    yamlDocumentUrl: 'api/docs/openapi.yaml',
  });
  await app.listen(process.env.API_PORT ?? 3001);
}
void bootstrap();
