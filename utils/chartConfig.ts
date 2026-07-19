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
  barPercentage: 12,
};
