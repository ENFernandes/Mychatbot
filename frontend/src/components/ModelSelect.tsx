import React from 'react';

interface ModelSelectProps {
  models: string[];
  value: string;
  onChange: (model: string) => void;
}

const ModelSelect: React.FC<ModelSelectProps> = ({ models, value, onChange }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
    >
      {models.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
};

export default ModelSelect;


