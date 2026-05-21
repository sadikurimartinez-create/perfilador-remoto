import React from 'react';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import { buildTimelineData }
  from '../utils/timelineAnalysis';

interface Props {
  iaAnalysis: any[];
}

const TimelinePanel: React.FC<Props> = ({
  iaAnalysis,
}) => {

  const data =
    buildTimelineData(iaAnalysis);

  if (data.length === 0) {
    return null;
  }

  return (

    <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 mt-4">

      <h2 className="text-lg font-bold text-amber-300 mb-4">
        Timeline Criminológico
      </h2>

      <div className="h-80">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >

          <LineChart data={data}>

            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis dataKey="date" />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="total"
              stroke="#f59e0b"
              strokeWidth={3}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
};

export default TimelinePanel;