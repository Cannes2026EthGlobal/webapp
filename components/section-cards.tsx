"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartUpIcon, ChartDownIcon } from "@hugeicons/core-free-icons";

const cards = [
  {
    title: "Treasury available",
    value: "$482,140",
    trend: "+6.8%",
    direction: "up" as const,
    summary: "USDC and short-duration operating balances remain healthy.",
    note: "Ready for the next two payroll cycles",
  },
  {
    title: "Payroll due",
    value: "$118,620",
    trend: "14 due",
    direction: "down" as const,
    summary: "Two contractors still need backup wallet confirmation.",
    note: "Next batch closes on April 5",
  },
  {
    title: "Pending receivables",
    value: "$94,300",
    trend: "4 invoices",
    direction: "up" as const,
    summary:
      "Three B2B invoices and one checkout link are awaiting settlement.",
    note: "Largest balance is Northwind Labs",
  },
  {
    title: "Usage revenue today",
    value: "$12,480",
    trend: "+18.2%",
    direction: "up" as const,
    summary: "Agent and API metering is settling faster than forecast.",
    note: "Top driver is prompt streaming volume",
  },
] as const;

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => {
        const icon = card.direction === "up" ? ChartUpIcon : ChartDownIcon;

        return (
          <Card key={card.title} className="@container/card">
            <CardHeader>
              <CardDescription>{card.title}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {card.value}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <HugeiconsIcon icon={icon} strokeWidth={2} />
                  {card.trend}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-2 flex gap-2 font-medium">
                {card.summary}
              </div>
              <div className="text-muted-foreground">{card.note}</div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
