export const queryDB = async (sql: string) => {
  const formData = new URLSearchParams();
  formData.append('sql', sql);

  const response = await fetch('https://app.xuanvu.click/hktt/query.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString()
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const data = await response.json();
  if (data && typeof data === 'object' && data.error) {
    throw new Error(data.error);
  }
  return data;
};

export const escapeSQL = (val: any): string => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  // Escape single quotes by doubling them, escape backslashes
  return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
};

export const subscribeDB = (sql: string, callback: (data: any[]) => void, intervalMs: number = 5000) => {
  let isMounted = true;
  const fetchData = async () => {
    try {
      const data = await queryDB(sql);
      if (isMounted) {
        // Assume data is an array
        callback(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("subscribeDB Error:", e);
    }
  };
  fetchData();
  const interval = setInterval(fetchData, intervalMs);
  return () => {
    isMounted = false;
    clearInterval(interval);
  };
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
