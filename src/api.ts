export const queryDB = async (sql: string, retries: number = 2): Promise<any> => {
  const formData = new URLSearchParams();
  formData.append('sql', sql);

  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch('https://app.xuanvu.click/hktt/query.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      if (data && typeof data === 'object' && data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (e) {
      lastError = e;
      if (i < retries) {
        console.warn(`Query failed, retrying (${i + 1}/${retries})...`, sql.substring(0, 100));
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  }

  throw lastError;
};

// Mutation System for Optimistic Updates
type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';
type MutationEntity = 'leads' | 'departments' | 'users' | 'projects' | 'settings';

interface MutationEvent {
  type: MutationType;
  entity: MutationEntity;
  data: any;
  tempId?: string;
}

type MutationListener = (event: MutationEvent) => void;
const mutationListeners: Set<MutationListener> = new Set();

export const subscribeToMutations = (listener: MutationListener) => {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
};

export const executeMutation = async (
  entity: MutationEntity,
  type: MutationType,
  data: any,
  sql: string,
  tempId?: string
) => {
  // 1. Emit optimistic update
  mutationListeners.forEach(listener => listener({ type, entity, data, tempId }));

  try {
    // 2. Perform API call with retries
    await queryDB(sql, 2);
  } catch (error) {
    // 3. If failed after retries, alert and notify for rollback
    alert(`Thao tác ${type} trên ${entity} thất bại sau 3 lần thử. Hệ thống sẽ hoàn tác.`);
    mutationListeners.forEach(listener => listener({ type: 'DELETE', entity, data: { rollback: true, originalType: type, originalData: data, tempId } }));
    throw error;
  }
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
