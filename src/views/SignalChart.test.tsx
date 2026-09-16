import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FIXTURE_NOW, pressureChartSeries } from '../__mocks__/asset360Fixtures';
import type { ChartSeries } from '../domain/asset360Types';
import { resolveTimeWindow } from '../domain/timeWindow';

import { SignalChart } from './SignalChart';

const WINDOW = resolveTimeWindow('24h', FIXTURE_NOW);

describe(SignalChart.name, () => {
  it('suggests a longer window when nothing reported in this one', () => {
    render(<SignalChart series={[series('a', [])]} window={WINDOW} />);

    expect(screen.getByText('No data points in this window')).toBeInTheDocument();
    expect(screen.getByText(/last 24 hours/)).toBeInTheDocument();
  });

  it('describes the chart in text for assistive technology', () => {
    render(<SignalChart series={[pressureChartSeries]} window={WINDOW} />);

    expect(screen.getByLabelText(/Average values for 1 signal/)).toBeInTheDocument();
  });

  it('states the aggregation and the range beside the chart', () => {
    render(<SignalChart series={[pressureChartSeries]} window={WINDOW} />);

    expect(screen.getByText(/Average per 5m bucket/)).toBeInTheDocument();
  });
});

function series(externalId: string, points: ChartSeries['points']): ChartSeries {
  return {
    ref: { space: 'test-instances', externalId },
    label: externalId,
    points,
  };
}
