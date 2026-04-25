"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeatmapProps {
  data: Array<{
    date: string;
    value: number;
    label?: string;
  }>;
  title: string;
  description?: string;
  minColor?: string;
  maxColor?: string;
  colorStops?: number;
}

export function ActivityHeatmap({
  data,
  title,
  description,
  minColor = "bg-muted",
  maxColor = "bg-emerald-500",
  colorStops = 5,
}: HeatmapProps) {
  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);

  const getIntensityColor = (value: number): string => {
    const intensity = value / maxValue;
    if (intensity === 0) return minColor;
    if (intensity <= 0.25) return "bg-emerald-100 dark:bg-emerald-900/40";
    if (intensity <= 0.5) return "bg-emerald-200 dark:bg-emerald-900/60";
    if (intensity <= 0.75) return "bg-emerald-300 dark:bg-emerald-900/80";
    return maxColor;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {data.map((day, index) => (
            <div
              key={index}
              className={`aspect-square rounded-sm ${getIntensityColor(day.value)} transition-colors cursor-help`}
              title={`${day.date}: ${day.value} ${day.label || "activities"}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <div className={`w-3 h-3 rounded-sm ${minColor}`} />
            <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/40" />
            <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/60" />
            <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-900/80" />
            <div className={`w-3 h-3 rounded-sm ${maxColor}`} />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface ContributionHeatmapProps {
  data: Array<{
    date: string;
    contributions: number;
    approved: number;
    pending: number;
  }>;
  title: string;
}

export function ContributionHeatmap({ data, title }: ContributionHeatmapProps) {
  const totalContributions = data.reduce((sum, d) => sum + d.contributions, 0);
  const maxContributions = Math.max(...data.map((d) => d.contributions), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalContributions} total contributions
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1">
            {data.map((day, index) => {
              const intensity = day.contributions / maxContributions;
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-sm transition-all ${
                    day.contributions === 0
                      ? "bg-muted"
                      : intensity < 0.25
                      ? "bg-blue-200 dark:bg-blue-900/40"
                      : intensity < 0.5
                      ? "bg-blue-300 dark:bg-blue-900/60"
                      : intensity < 0.75
                      ? "bg-blue-400 dark:bg-blue-900/80"
                      : "bg-blue-500"
                  }`}
                  title={`${day.date}: ${day.contributions} contributions`}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-blue-500" />
                <span>Approved</span>
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-amber-400" />
                <span>Pending</span>
              </span>
            </div>
            <span className="text-muted-foreground">
              Last {data.length} days
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}