const MAX = parseInt(process.env.MAX_ENTRIES || '500');

const entries = [];

function add(entry) {
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
}

function getAll() {
  return entries;
}

function clear() {
  entries.length = 0;
}

module.exports = { add, getAll, clear };
