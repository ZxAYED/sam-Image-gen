import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SAM BACKEND')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    customSiteTitle: 'SAM BACKEND Docs',
    customCss: `
      :root {
        --bg:#0b1220;
        --card:#111a2e;
        --text:#d9e2f1;
        --muted:#94a3b8;
        --border:#1f2a44;
        --green:#22c55e;
      }
      body, .swagger-ui { background: var(--bg) !important; color: var(--text) !important; }
      .swagger-ui .topbar, .swagger-ui .info, .swagger-ui .scheme-container { background: var(--card) !important; border-color: var(--border) !important; }
      .swagger-ui .opblock, .swagger-ui .model-box, .swagger-ui .responses-inner, .swagger-ui section.models { background: var(--card) !important; border-color: var(--border) !important; }
      .swagger-ui .opblock .opblock-summary-description, .swagger-ui .info p, .swagger-ui .info h1, .swagger-ui .info h2, .swagger-ui .info h3, .swagger-ui label, .swagger-ui .parameter__name, .swagger-ui .response-col_status, .swagger-ui .response-col_description { color: var(--text) !important; }
      .swagger-ui .markdown p, .swagger-ui .model, .swagger-ui .prop-name, .swagger-ui .prop-type, .swagger-ui .parameter__type, .swagger-ui .opblock-description-wrapper p { color: var(--muted) !important; }
      .swagger-ui .opblock.opblock-post { border-color: #1d9f56 !important; }
      .swagger-ui .btn.authorize { border-color: var(--green) !important; color: var(--green) !important; }
      .swagger-ui input, .swagger-ui textarea, .swagger-ui select { background: #0f172a !important; color: var(--text) !important; border-color: var(--border) !important; }
      .swagger-ui .responses-table td, .swagger-ui .responses-table th { border-color: var(--border) !important; }
    `,
  });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
