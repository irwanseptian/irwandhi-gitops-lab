const palette = {
  active:   'bg-green-100 text-green-700',
  paused:   'bg-yellow-100 text-yellow-700',
  disabled: 'bg-gray-100 text-gray-500',
  success:  'bg-green-100 text-green-700',
  failure:  'bg-red-100 text-red-700',
  running:  'bg-blue-100 text-blue-700',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${palette[status] ?? palette.disabled}`}>
      {status}
    </span>
  );
}
