'use client';

interface DateSliderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

function formatDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function offsetDate(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + days);
  const d = date;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function DateSlider({ selectedDate, onDateChange }: DateSliderProps) {
  const btnStyle = {
    background: 'none',
    border: '1px solid #1e3a5f',
    color: '#94a3b8',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    lineHeight: '1',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '4px 10px' }}>
      <button style={btnStyle as any} onClick={function() { onDateChange(offsetDate(selectedDate, -1)); }}>{'<'}</button>
      <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#e2e8f0', minWidth: '90px', textAlign: 'center', fontWeight: 'bold' }}>
        {formatDisplay(selectedDate)}
      </div>
      <button style={btnStyle as any} onClick={function() { onDateChange(offsetDate(selectedDate, 1)); }}>{'>'}</button>
    </div>
  );
}
