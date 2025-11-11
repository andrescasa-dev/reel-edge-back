import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './modules/shared/presentation/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Casino Research Assistant API')
    .setDescription(
      'API for managing casino research data, missing casinos discovery, and promotion comparisons across NJ, MI, PA, and WV jurisdictions',
    )
    .setVersion('1.0.0')
    .setContact('API Support', '', 'api@casinoresearch.com')
    .addServer('https://api.casinoresearch.com/v1', 'Production server')
    .addServer('https://staging-api.casinoresearch.com/v1', 'Staging server')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
        description:
          'NextAuth.js session cookie for authentication. The session token is automatically included in requests via HTTP-only cookies.',
      },
      'NextAuthSession',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
