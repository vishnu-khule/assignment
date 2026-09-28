import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { WsAdapter } from "@nestjs/platform-ws";
import { json, raw } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(json());
  app.use(/^\/api\/v1\/files\/upload\/.+/, raw({ type: "*/*", limit: "50mb" }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
