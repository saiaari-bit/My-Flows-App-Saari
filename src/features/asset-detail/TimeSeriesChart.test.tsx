import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ChartSeries } from './chartGeometry';
import { TimeSeriesChart } from './TimeSeriesChart';

const START = Date.parse('2026-08-27T00:00:00.000Z');
const END = Date.parse('2026-08-28T00:00:00.000Z');

describe(TimeSeriesChart.name, () => {
  it('shows a textual no-data state', () => {
    render(<TimeSeriesChart end={END} series={[]} start={START} />);

    expect(screen.getByText('No numeric datapoints to display.')).toBeInTheDocument();
  });

  it('renders one point without an invalid line', () => {
    const { container } = render(
      <TimeSeriesChart end={END} series={[seriesWith([4.2])]} start={START} />
    );

    expect(container.querySelectorAll('circle[data-datapoint]')).toHaveLength(1);
    expect(container.querySelectorAll('path[data-series-line]')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('renders a line and focusable values for multiple points', () => {
    const { container } = render(
      <TimeSeriesChart end={END} series={[seriesWith([1, 2, 3])]} start={START} />
    );

    expect(container.querySelectorAll('path[data-series-line]')).toHaveLength(1);
    const points = container.querySelectorAll('circle[data-datapoint]');
    expect(points).toHaveLength(3);
    expect(points[0]).toHaveAttribute('tabindex', '0');
    expect(points[0]?.textContent).toContain('Discharge pressure');
  });

  it('handles identical Y values without invalid SVG coordinates', () => {
    const { container } = render(
      <TimeSeriesChart end={END} series={[seriesWith([5, 5])]} start={START} />
    );

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it.each([
    ['small', [0.000000001, 0.000000002]],
    ['large', [-1_000_000_000, 1_000_000_000]],
  ])('handles %s Y ranges', (_label, values) => {
    const { container } = render(
      <TimeSeriesChart end={END} series={[seriesWith(values)]} start={START} />
    );

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('does not draw a line across an explicit gap', () => {
    const gapped: ChartSeries = {
      id: 'pressure',
      label: 'Discharge pressure',
      points: [
        { timestamp: START, value: 1 },
        { timestamp: START + 1000, value: 2 },
        { timestamp: START + 2000, value: null },
        { timestamp: START + 3000, value: 3 },
        { timestamp: START + 4000, value: 4 },
      ],
    };
    const { container } = render(
      <TimeSeriesChart end={END} series={[gapped]} start={START} />
    );

    expect(container.querySelectorAll('path[data-series-line]')).toHaveLength(2);
  });

  it('uses responsive SVG dimensions and a meaningful accessible label', () => {
    const { container } = render(
      <TimeSeriesChart end={END} series={[seriesWith([1, 2])]} start={START} />
    );

    const chart = screen.getByRole('img', {
      name: 'Historical trend for Discharge pressure',
    });
    expect(chart).toHaveAttribute('width', '100%');
    expect(chart).toHaveAttribute('viewBox', '0 0 800 320');
    expect(chart).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    expect(container.querySelector('figcaption')).toHaveTextContent(
      'Discharge pressure'
    );
  });
});

function seriesWith(values: number[]): ChartSeries {
  const step = values.length > 1 ? (END - START) / (values.length - 1) : 0;
  return {
    id: 'pressure',
    label: 'Discharge pressure',
    unit: 'bar',
    points: values.map((value, index) => ({
      timestamp: START + index * step,
      value,
    })),
  };
}
