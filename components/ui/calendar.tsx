"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Calendar({
  className = "",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={`p-1 ${className}`}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex h-9 items-center justify-center px-9",
        caption_label: "text-sm font-semibold text-slate-900",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
        button_next:
          "absolute right-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "flex h-8 w-9 items-center justify-center text-[11px] font-medium text-slate-500",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md font-normal text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
        selected:
          "[&>button]:bg-slate-950 [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-slate-800 [&>button]:hover:text-white",
        today:
          "[&>button]:bg-slate-100 [&>button]:font-semibold [&>button]:text-slate-950",
        outside: "[&>button]:text-slate-400 [&>button]:opacity-60",
        disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-40",
        hidden: "invisible",
        ...props.classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={iconClassName} />
          ) : (
            <ChevronRight className={iconClassName} />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}
