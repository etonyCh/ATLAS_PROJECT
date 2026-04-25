import React from "react";

type DataPoint = { date: string; value: number };

// A compact 12x31 calendar heatmap: 12 columns (months) and 31 rows (days)
export function CalendarHeatmap({ data, title }: { data: DataPoint[]; title?: string }) {
  // 7 rows (Mon-Sun) x 53 weeks calendar heatmap for a year
  const year = data?.length
    ? new Date(data[0].date).getFullYear()
    : new Date().getFullYear();

  const weeks = 53;
  const days = 7;

  // Initialize grid with zeros
  const grid = Array.from({ length: days }, () => Array(weeks).fill(0));

  let maxVal = 1;
  if (data && data.length > 0) {
    maxVal = Math.max(...data.map((d) => d.value), 1);
  }

  // Fill grid by iterating each day of the year and mapping to weekIndex and weekday
  for (let date = new Date(year, 0, 1), i = 0; date.getFullYear() === year; date.setDate(date.getDate() + 1), i++) {
    const diff = i;
    const weekIndex = Math.floor(diff / 7);
    const weekday = (date.getDay() + 6) % 7; // Monday=0 .. Sunday=6
    const isoDate = date.toISOString().slice(0, 10);
    const found = data.find((d) => d.date === isoDate);
    const value = found ? found.value : 0;
    if (weekIndex < weeks) grid[weekday][weekIndex] = value;
  }

  const monthStarts: string[] = [];
  for (let w = 0; w < weeks; w++) {
    const firstDay = new Date(year, 0, 1 + w * 7);
    monthStarts.push(firstDay.toLocaleDateString(undefined, { month: 'short' }));
  }

  const colorFor = (v: number) => {
    if (v <= 0) return '#ebf5ea';
    const t = Math.min(1, v / maxVal);
    const idx = Math.floor(t * 4); // 0..4
    const palette = ['#e6f5e6','#c8e8c1','#9bd6a0','#5cc07a','#0f9b2f'];
    return palette[idx];
  };

  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <section aria-label={title ?? 'Activity Heatmap'}>
      {title && <div className="text-sm font-semibold mb-1">{title}</div>}
      <table style={{ borderCollapse: 'collapse' }} aria-label="Calendar heatmap">
        <thead>
          <tr>
            <th style={{ width: 48 }}></th>
            {Array.from({ length: weeks }).map((_, w) => (
              <th key={w} style={{ width: 14, padding: 0, textAlign: 'center' }}>
                {monthStarts[w]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekdays.map((dayLabel, r) => (
            <tr key={r}>
              <td style={{ fontSize: 11, paddingRight: 6, paddingLeft: 0, textAlign: 'left', width: 48 }}>{dayLabel}</td>
              {Array.from({ length: weeks }).map((_, c) => (
                <td
                  key={`${r}-${c}`}
                  title={`${dayLabel} week ${c + 1} value: ${grid[r][c]}`}
                  style={{ width: 14, height: 14, padding: 0, background: colorFor(grid[r][c]), borderRadius: 2 }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground" aria-hidden>
        <span>Less</span>
        <span className="inline-flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: i === 0 ? '#ebf5ea' : i === 4 ? '#0f9b2f' : '#c8e8c1' }} />
          ))}
        </span>
        <span>More</span>
      </div>
    </section>
  );
}

export default CalendarHeatmap;
