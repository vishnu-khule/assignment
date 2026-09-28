import type { SessionContext } from "@proposal/schemas";
import { getTradeChecklist, type TradeKey } from "@proposal/schemas";

type Trade = NonNullable<SessionContext["trade"]>;

export function getChecklist(trade: Trade) {
  return getTradeChecklist(trade as TradeKey);
}
