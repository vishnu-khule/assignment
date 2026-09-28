import { Controller, Get } from "@nestjs/common";
import { llmStatus } from "@proposal/llm";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      ts: new Date().toISOString(),
      llm: llmStatus(),
    };
  }
}
