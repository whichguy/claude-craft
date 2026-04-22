import { Client } from 'pg';

const client = new Client();

interface QueryParams {
  userId: number;
  sortBy: string;
  order: 'ASC' | 'DESC';
}

/**
 * Builds and executes a query to fetch user logs.
 * The sortBy field is checked against a whitelist of valid columns.
 */
async function fetchUserLogs(params: QueryParams) {
  const validColumns = ['timestamp', 'action', 'ip_address'];
  
  // Logic is correct in TS: it checks the whitelist.
  if (!validColumns.includes(params.sortBy)) {
    throw new Error("Invalid sort column");
  }

  // CROSS-DOMAIN BUG: Even if params.sortBy is in the whitelist,
  // template literals are used for the ORDER BY clause which often leads to 
  // blind SQL injection or at least bad practice if other parts are added.
  // Trap: The developer uses the 'order' param directly because it's typed as a literal union.
  // But Typescript types are erased at runtime! If 'params' comes from JSON.parse(req.body),
  // 'order' could be anything like "ASC; DROP TABLE logs; --"
  const query = `
    SELECT * FROM user_logs 
    WHERE user_id = $1 
    ORDER BY ${params.sortBy} ${params.order}
  `;
  
  return await client.query(query, [params.userId]);
}
