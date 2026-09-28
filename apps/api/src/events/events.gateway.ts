import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "ws";

export interface SessionEvent {
  session_id: string;
  step: string;
  message?: string;
  payload?: unknown;
}

@WebSocketGateway({ path: "/api/v1/ws" })
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  emitSessionEvent(event: SessionEvent) {
    const data = JSON.stringify({ type: "session.event", ...event });
    this.server?.clients.forEach((client) => {
      if (client.readyState === 1) client.send(data);
    });
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(@MessageBody() body: { session_id: string }) {
    return { ok: true, session_id: body.session_id };
  }
}
