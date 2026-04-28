import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const clientOrigin = config.get<string>('CLIENT_ORIGIN', 'http://localhost:4201');
  const port = Number(config.get<string>('PORT', '3000'));

  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
