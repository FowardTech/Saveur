import { AbstractChartConfig } from "react-native-chart-kit/dist/AbstractChart";

export const chartConfig: AbstractChartConfig = {
  backgroundGradientFrom: "transparent",
  backgroundGradientFromOpacity: 0,
  backgroundGradientTo: "transparent",
  backgroundGradientToOpacity: 0,
  color: (opacity = 1) => `rgba(37, 116, 255, 1)`,
  labelColor: (opacity = 1) => `rgba(147, 147, 170, 1)`,
  strokeWidth: 2,
  useShadowColorFromDataset: false,
  fillShadowGradientOpacity: 0.15,
  fillShadowGradient: `rgba(37, 116, 255, 0.1)`,
  // Was 12 — react-native-chart-kit's barPercentage is a fraction of the
  // computed per-bar slot width (chart-kit's own default is 0.62, meaning
  // "62% of the available slot"), not a multiplier. A value of 12 scaled
  // every bar to ~1200% of its slot, which breaks the underlying SVG bar
  // geometry so badly that no bars render at all — only the y-axis tick
  // labels (computed independently from the real max value) showed up,
  // which is exactly what looked like "the chart isn't showing even though
  // I've done several practice sessions."
  barPercentage: 0.6,
};
