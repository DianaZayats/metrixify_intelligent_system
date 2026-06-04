import { onUnmounted, shallowRef, type Ref } from 'vue';
import * as echarts from 'echarts/core';
import { HeatmapChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  HeatmapChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export type EChartsThemeColors = {
  primary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  surface: string;
  surfaceMuted: string;
  aiPale: string;
  aiSoft: string;
  correlationStrong: string;
  correlationWeak: string;
  positive: string;
  negative: string;
  fontFamily: string;
};

export type HeatmapLegendBand = {
  color: string;
  labelKey: 'legendNone' | 'legendWeak' | 'legendModerate' | 'legendStrong';
};

export type HeatmapChartTheme = {
  colors: EChartsThemeColors;
  emptyCell: string;
  legendBands: HeatmapLegendBand[];
  gap: string;
  tooltip: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  };
  emphasisBorder: string;
};

function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getEChartsThemeColors(): EChartsThemeColors {
  return {
    primary: readCssVar('--color-primary', '#7E67CC'),
    textPrimary: readCssVar('--color-text-primary', '#171827'),
    textSecondary: readCssVar('--color-text-secondary', '#3B2F68'),
    textTertiary: readCssVar('--color-text-tertiary', '#7E67CC'),
    border: readCssVar('--color-border', '#D9CFFD'),
    surface: readCssVar('--color-surface', '#FFFFFF'),
    surfaceMuted: readCssVar('--color-surface-muted', '#EDE8FA'),
    aiPale: readCssVar('--color-ai-pale', '#F5F2FF'),
    aiSoft: readCssVar('--color-ai-soft', '#B7A7EA'),
    correlationStrong: readCssVar('--color-correlation-strong', '#7E67CC'),
    correlationWeak: readCssVar('--color-correlation-weak', '#D9CFFD'),
    positive: readCssVar('--color-positive', '#2D8A4E'),
    negative: readCssVar('--color-negative', '#C40F3A'),
    fontFamily: readCssVar('--font-sans', 'Inter, system-ui, sans-serif'),
  };
}

export function getHeatmapChartTheme(): HeatmapChartTheme {
  const colors = getEChartsThemeColors();
  const emptyCell = readCssVar('--color-surface-muted', '#EDE8FA');
  return {
    colors,
    emptyCell,
    legendBands: [
      { color: emptyCell, labelKey: 'legendNone' },
      { color: colors.aiPale, labelKey: 'legendWeak' },
      { color: colors.correlationStrong, labelKey: 'legendModerate' },
      { color: readCssVar('--color-night-violet', '#2B2948'), labelKey: 'legendStrong' },
    ],
    gap: colors.surface,
    tooltip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textColor: colors.textPrimary,
    },
    emphasisBorder: colors.correlationStrong,
  };
}

export function useEChartsTheme() {
  const colors = getEChartsThemeColors();

  function baseTextStyle() {
    return {
      color: colors.textPrimary,
      fontFamily: colors.fontFamily,
    };
  }

  function axisStyle() {
    return {
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.textSecondary, fontFamily: colors.fontFamily },
      splitLine: { lineStyle: { color: colors.border, type: 'dashed' as const } },
    };
  }

  return {
    colors,
    baseTextStyle,
    axisStyle,
  };
}

export function useEChartsChart(containerRef: Ref<HTMLElement | null>) {
  const chart = shallowRef<echarts.ECharts | null>(null);

  function ensureChart(): echarts.ECharts | null {
    if (!containerRef.value) {
      return null;
    }
    if (!chart.value) {
      chart.value = echarts.init(containerRef.value);
    }
    return chart.value;
  }

  function setOption(option: echarts.EChartsCoreOption, notMerge = true) {
    ensureChart()?.setOption(option, notMerge);
  }

  function resize() {
    chart.value?.resize();
  }

  function dispose() {
    chart.value?.dispose();
    chart.value = null;
  }

  onUnmounted(dispose);

  return { chart, setOption, resize, dispose };
}
