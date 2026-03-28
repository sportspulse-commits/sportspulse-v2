'use client';
import { useState, useRef, useEffect } from 'react';

interface DateSliderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

function toDateStr(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function todayStr(): string { return toDateStr(new Date()); }

function formatDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  function isSame(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  if (isSame(date, today)) return 'Today';
  if (isSame(date, tomorrow)) return 'Tomorrow';
  if (isSame(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function offsetDate(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DateSlider({ selectedDate, onDateChange }: DateSliderProps) {
  const [showCal, setShowCal] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setShowCal(false);
    }
    if (showCal) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCal]);

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function handleDayClick(day: number) {
    const d = new Date(calMonth.year, calMonth.month, day);
    onDateChange(toDateStr(d));
    setShowCal(false);
  }

  function prevMonth() {
    setCalMonth(function(c) {
      if (c.month === 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month: c.month - 1 };
    });
  }

  function nextMonth() {
    setCalMonth(function(c) {
      if (c.month === 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: c.month + 1 };
    });
  }

  function openCal() {
    const d = new Date(selectedDate + 'T12:00:00');
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
    setShowCal(true);
  }

  const today = todayStr();
  const daysInMonth = getDaysInMonth(calMonth.year, calMonth.month);
  const firstDay = getFirstDayOfMonth(calMonth.year, calMonth.month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const btnStyle = { background: 'none', border: '1px solid #1e3a5f', color: '#94a3b8', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', lineHeight: '1' };

  return (
    <div ref={calRef} style={{ position: 'relative' as const }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '4px 10px' }}>
        <button style={btnStyle as any} onClick={() => onDateChange(offsetDate(selectedDate, -1))}>{'<'}</button>
        <div onClick={openCal} style={{ fontFamily: 'monospace', fontSize: '13px', color: '#e2e8f0', minWidth: '90px', textAlign: 'center' as const, fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' as const }}>
          {formatDisplay(selectedDate)}
        </div>
        <button style={btnStyle as any} onClick={() => onDateChange(offsetDate(selectedDate, 1))}>{'>'}</button>
      </div>

      {showCal && (
        <div style={{ position: 'absolute' as const, top: '40px', left: '50%', transform: 'translateX(-50%)', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '12px', zIndex: 9999, width: '240px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <button onClick={prevMonth} style={{ ...btnStyle as any, fontSize: '12px' }}>{'<'}</button>
            <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
              {MONTHS[calMonth.month].toUpperCase()} {calMonth.year}
            </span>
            <button onClick={nextMonth} style={{ ...btnStyle as any, fontSize: '12px' }}>{'>'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center' as const, color: '#475569', fontSize: '10px', fontFamily: 'monospace', padding: '4px 0', letterSpacing: '0.5px' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = toDateStr(new Date(calMonth.year, calMonth.month, day));
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              return (
                <button key={i} onClick={() => handleDayClick(day)} style={{
                  background: isSelected ? '#22c55e' : isToday ? '#1e3a5f' : 'transparent',
                  color: isSelected ? '#000' : isToday ? '#22c55e' : '#94a3b8',
                  border: isToday && !isSelected ? '1px solid #22c55e' : '1px solid transparent',
                  borderRadius: '4px', padding: '4px 0', fontFamily: 'monospace', fontSize: '11px',
                  cursor: 'pointer', fontWeight: isSelected || isToday ? 'bold' : 'normal',
                  textAlign: 'center' as const,
                }}>{day}</button>
              );
            })}
          </div>

          <div style={{ marginTop: '8px', borderTop: '1px solid #1e3a5f', paddingTop: '8px' }}>
            <button onClick={() => { onDateChange(today); setShowCal(false); }} style={{ width: '100%', padding: '6px', background: 'none', border: '1px solid #1e3a5f', color: '#22c55e', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '1px', fontWeight: 'bold' }}>TODAY</button>
          </div>
        </div>
      )}
    </div>
  );
}