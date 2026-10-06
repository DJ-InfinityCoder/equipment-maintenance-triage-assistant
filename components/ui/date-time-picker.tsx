"use client";

import * as React from "react";
import { format, isValid, parseISO, set } from "date-fns";
import { CalendarDays, Clock3 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTimePickerProps {
  id?: string;
  name: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
  inputRef?: React.Ref<HTMLButtonElement>;
}

function parseValue(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

function toTimeValue(date?: Date): string {
  return date ? format(date, "HH:mm") : "09:00";
}

function toIsoValue(date: Date): string {
  return date.toISOString();
}

export function DateTimePicker({
  id,
  name,
  value,
  onChange,
  onBlur,
  inputRef,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseValue(value);
  const displayDate = selectedDate
    ? format(selectedDate, "MMM d, yyyy")
    : "Select date";
  const displayTime = selectedDate ? format(selectedDate, "h:mm a") : "Add time";

  const handleDateSelect = (date?: Date) => {
    if (!date) {
      return;
    }

    const current = selectedDate ?? new Date();
    onChange(
      toIsoValue(
        set(date, {
          hours: current.getHours(),
          minutes: current.getMinutes(),
          seconds: 0,
          milliseconds: 0,
        })
      )
    );
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = event.target.value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return;
    }

    const base = selectedDate ?? new Date();
    onChange(
      toIsoValue(
        set(base, {
          hours,
          minutes,
          seconds: 0,
          milliseconds: 0,
        })
      )
    );
  };

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  };

  const handleToday = () => {
    handleDateSelect(new Date());
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          onBlur?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={inputRef}
          id={id}
          name={name}
          type="button"
          aria-label={
            selectedDate
              ? `Event date and time: ${format(selectedDate, "PPpp")}`
              : "Choose event date and time"
          }
          className="inline-flex h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
          <span
            className={`min-w-0 flex-1 truncate ${
              selectedDate ? "text-slate-800" : "text-slate-500"
            }`}
          >
            {displayDate}
          </span>
          <span className="h-4 w-px shrink-0 bg-slate-200" />
          <span
            className={`shrink-0 text-xs ${
              selectedDate ? "text-slate-600" : "text-slate-400"
            }`}
          >
            {displayTime}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(21rem,calc(100vw-2rem))] p-3"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          defaultMonth={selectedDate}
        />
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
          <label
            htmlFor={`${id ?? name}-time`}
            className="flex items-center gap-2 text-xs font-medium text-slate-600"
          >
            <Clock3 className="h-4 w-4 text-slate-500" />
            Time
          </label>
          <input
            id={`${id ?? name}-time`}
            aria-label="Event time"
            type="time"
            value={toTimeValue(selectedDate)}
            onChange={handleTimeChange}
            className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-md bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2"
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
