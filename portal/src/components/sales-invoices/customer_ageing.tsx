import { useCustomerAging } from "@/hooks/useCustomerAgeing";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export default function CustomerAgingChart() {
  const { data, loading, error } = useCustomerAging();

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  // Check if data is empty or doesn't have the expected structure
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>No customer ageing data available</p>
      </div>
    );
  }

  const currency = data.currency || "SAR";

  const chartData = [
    { range: "Days 0-30", amount: data["0_30"] || 0 },
    { range: "Days 31-60", amount: data["31_60"] || 0 },
    { range: "Days 61-90", amount: data["61_90"] || 0 },
    { range: "Days 91-120", amount: data["91_120"] || 0 },
    { range: "Days 120+", amount: data["120_plus"] || 0 },
  ];

  const formatValue = (value: number | undefined | null) => {
    // Handle undefined, null, or non-numeric values
    if (value === undefined || value === null || isNaN(Number(value))) {
      return `0.00 ${currency}`;
    }
    const numValue = Number(value);
    if (numValue >= 1_000_000) return `${(numValue / 1_000_000).toFixed(1)}M ${currency}`;
    if (numValue >= 1_000) return `${(numValue / 1_000).toFixed(1)}K ${currency}`;
    return `${numValue.toFixed(2)} ${currency}`;
  };

  return (
    <div className="flex flex-col md:flex-row w-full gap-4 h-auto md:h-[600px]">
      {/* Left Card */}
      <Card className="w-full md:w-1/4 h-[250px] md:h-full">
        <CardContent className="flex flex-col justify-around h-full overflow-auto">
          {chartData.map((item) => (
            <div key={item.range} className="flex justify-between py-1">
              <span>{item.range}</span>
              <span className="font-bold">{formatValue(item.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Right Chart */}
      <Card className="w-full md:w-3/4 h-[300px] md:h-full pt-5">
        <CardContent className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis tickFormatter={(value) => formatValue(value)} />
              <Tooltip formatter={(value: number) => formatValue(value)} />
              <Bar dataKey="amount" fill="#3b82f6" barSize={25} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
