function describe(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, hour, dom, month, dow] = parts;
  if (expr === '* * * * *') return 'Every minute';
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
  if (dom === '*' && month === '*' && dow === '*') {
    if (hour === '*') return `At minute ${min} of every hour`;
    return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  return null;
}

export default function CronHelper({ expression }) {
  const text = describe(expression);
  if (!text) return null;
  return <p className="text-xs text-sky-600 mt-1">{text}</p>;
}
