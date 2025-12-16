import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';

interface DateTimePickerProps {
  selected: string;
  onChange: (date: string) => void;
  minDate?: Date;
  maxDate?: Date;
  showTimeSelect?: boolean;
  timeIntervals?: number;
  dateFormat?: string;
  placeholderText?: string;
  className?: string;
  disabled?: boolean;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  selected,
  onChange,
  minDate,
  maxDate,
  showTimeSelect = true,
  timeIntervals = 15,
  dateFormat = "dd/MM/yyyy HH:mm",
  placeholderText = "Selecione data e hora",
  className = "",
  disabled = false,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Atualiza a data selecionada quando a prop 'selected' muda
  useEffect(() => {
    if (selected) {
      const date = typeof selected === 'string' ? new Date(selected) : selected;
      setSelectedDate(isValidDate(date) ? date : null);
    } else {
      setSelectedDate(null);
    }
  }, [selected]);

  const handleChange = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      onChange(date.toISOString());
    } else {
      onChange('');
    }
  };

  // Função auxiliar para verificar se uma data é válida
  const isValidDate = (date: any): date is Date => {
    return date instanceof Date && !isNaN(date.getTime());
  };

  return (
    <div className={`relative ${className}`}>
      <DatePicker
        selected={selectedDate}
        onChange={handleChange}
        minDate={minDate}
        maxDate={maxDate}
        showTimeSelect={showTimeSelect}
        timeIntervals={timeIntervals}
        dateFormat={dateFormat}
        placeholderText={placeholderText}
        disabled={disabled}
        locale={ptBR}
        showPopperArrow={false}
        popperClassName="z-50"
        calendarClassName="border border-gray-200 rounded-md shadow-lg"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
};

export default DateTimePicker;
