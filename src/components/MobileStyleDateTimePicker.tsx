import { useEffect, useMemo, useState } from "react";

interface Props {
  value?: string; // ISO string or empty
  onChange: (isoString: string) => void;
  placeholder?: string;
  className?: string;
}

const monthShortNames = (locale = "pt-BR") => {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
  return Array.from({ length: 12 }).map((_, i) => fmt.format(new Date(2000, i, 1)));
};

const pad = (n: number) => n.toString().padStart(2, "0");

export default function MobileStyleDateTimePicker({
  value,
  onChange,
  placeholder = "Selecione data e hora",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => (value ? new Date(value) : new Date()));

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) setTempDate(d);
    }
  }, [value]);

  const months = useMemo(() => monthShortNames(), []);
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearRange = Array.from({ length: 11 }).map((_, i) => currentYear - 5 + i); // -5..+5

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  const days = useMemo(() => {
    const d = daysInMonth(tempDate.getFullYear(), tempDate.getMonth());
    return Array.from({ length: d }).map((_, i) => i + 1);
  }, [tempDate.getFullYear(), tempDate.getMonth(), tempDate]);

  const hours = useMemo(() => Array.from({ length: 24 }).map((_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }).map((_, i) => i), []);

  const openPicker = () => {
    setTempDate(value ? new Date(value) : new Date());
    setOpen(true);
  };

  const closePicker = () => setOpen(false);

  const onDefine = () => {
    onChange(tempDate.toISOString());
    closePicker();
  };

  const onClear = () => {
    onChange("");
    closePicker();
  };

  const setDay = (day: number) => {
    const y = tempDate.getFullYear();
    const m = tempDate.getMonth();
    const dayCap = Math.min(day, daysInMonth(y, m));
    setTempDate(new Date(y, m, dayCap, tempDate.getHours(), tempDate.getMinutes()));
  };

  const setMonth = (m: number) => {
    const y = tempDate.getFullYear();
    const d = Math.min(tempDate.getDate(), daysInMonth(y, m));
    setTempDate(new Date(y, m, d, tempDate.getHours(), tempDate.getMinutes()));
  };

  const setYear = (y: number) => {
    const m = tempDate.getMonth();
    const d = Math.min(tempDate.getDate(), daysInMonth(y, m));
    setTempDate(new Date(y, m, d, tempDate.getHours(), tempDate.getMinutes()));
  };

  const setHour = (h: number) => setTempDate(new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), h, tempDate.getMinutes()));
  const setMinute = (mm: number) => setTempDate(new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), tempDate.getHours(), mm));

  const formattedValue = value ? new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className={`relative ${className}`}>
      <button type="button" onClick={openPicker} className={`w-full text-left rounded-md border px-3 py-2 text-sm ${formattedValue ? "text-gray-800" : "text-gray-400"}`}>
        {formattedValue || placeholder}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-neutral-800 text-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Definir data e hora</h3>

            <div className="grid grid-cols-3 gap-2 text-center text-gray-300">
              {/* Day */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-400 mb-2">Dia</div>
                <div className="h-32 w-full overflow-y-auto hide-scrollbar">
                  <div className="flex flex-col items-center space-y-2 py-2">
                    {days.map((d) => (
                      <button
                        key={d}
                        className={`w-full text-center ${d === tempDate.getDate() ? "text-white text-lg font-semibold" : "text-gray-400 text-sm"}`}
                        onClick={() => setDay(d)}
                        type="button"
                      >
                        {pad(d)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Month */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-400 mb-2">Mês</div>
                <div className="h-32 w-full overflow-y-auto hide-scrollbar">
                  <div className="flex flex-col items-center space-y-2 py-2">
                    {months.map((m, i) => (
                      <button
                        key={m}
                        className={`w-full text-center ${i === tempDate.getMonth() ? "text-white text-lg font-semibold" : "text-gray-400 text-sm"}`}
                        onClick={() => setMonth(i)}
                        type="button"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Year */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-400 mb-2">Ano</div>
                <div className="h-32 w-full overflow-y-auto hide-scrollbar">
                  <div className="flex flex-col items-center space-y-2 py-2">
                    {yearRange.map((y) => (
                      <button
                        key={y}
                        className={`w-full text-center ${y === tempDate.getFullYear() ? "text-white text-lg font-semibold" : "text-gray-400 text-sm"}`}
                        onClick={() => setYear(y)}
                        type="button"
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="my-4" />

            <div className="grid grid-cols-2 gap-2 text-center text-gray-300">
              {/* Hour */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-400 mb-2">Hora</div>
                <div className="h-32 w-full overflow-y-auto hide-scrollbar">
                  <div className="flex flex-col items-center space-y-2 py-2">
                    {hours.map((h) => (
                      <button
                        key={h}
                        className={`w-full text-center ${h === tempDate.getHours() ? "text-white text-lg font-semibold" : "text-gray-400 text-sm"}`}
                        onClick={() => setHour(h)}
                        type="button"
                      >
                        {pad(h)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Minute */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-400 mb-2">Min</div>
                <div className="h-32 w-full overflow-y-auto hide-scrollbar">
                  <div className="flex flex-col items-center space-y-2 py-2">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        className={`w-full text-center ${m === tempDate.getMinutes() ? "text-white text-lg font-semibold" : "text-gray-400 text-sm"}`}
                        onClick={() => setMinute(m)}
                        type="button"
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <button type="button" onClick={onClear} className="text-sm text-blue-300">Limpar</button>
              <div className="flex gap-4">
                <button type="button" onClick={closePicker} className="text-sm text-gray-300">Cancelar</button>
                <button type="button" onClick={onDefine} className="text-sm font-semibold text-blue-200">Definir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
