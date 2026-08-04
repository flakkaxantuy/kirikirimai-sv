import { createClient } from "@libsql/client";
import path from "path";
import bcrypt from "bcryptjs";

// Resolve local SQLite file path
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "spil_permits.db");

export const client = createClient({
  url: `file:${dbPath}`,
});

let isInitialized = false;

export async function initDb() {
  if (isInitialized) return;
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS permits (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL
      );
    `);

    // Insert default accounts if table is empty
    const usersCount = await client.execute("SELECT COUNT(*) as count FROM users");
    if (Number(usersCount.rows[0]?.count || 0) === 0) {
      const defaultUsers = ["admin1", "admin2", "admin3"];
      for (const u of defaultUsers) {
        const hash = bcrypt.hashSync(u, 10);
        await client.execute({
          sql: "INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)",
          args: [u, hash]
        });
      }
    } else {
      // Auto-migrate any unhashed plain-text passwords in DB to bcrypt hashes
      const allUsers = await client.execute("SELECT username, password FROM users");
      for (const row of allUsers.rows) {
        const pass = String(row.password);
        if (!pass.startsWith("$2a$") && !pass.startsWith("$2b$")) {
          const newHash = bcrypt.hashSync(pass, 10);
          await client.execute({
            sql: "UPDATE users SET password = ? WHERE username = ?",
            args: [newHash, row.username]
          });
        }
      }
    }

    isInitialized = true;
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
  }
}

export async function loginUserDB(username: string, password: string) {
  await initDb();
  const res = await client.execute({
    sql: "SELECT password FROM users WHERE username = ?",
    args: [username]
  });

  if (res.rows.length === 0) return false;

  const storedPass = String(res.rows[0].password);

  // If password is stored as bcrypt hash
  if (storedPass.startsWith("$2a$") || storedPass.startsWith("$2b$")) {
    return bcrypt.compareSync(password, storedPass);
  }

  // Fallback for plain-text password match & auto-upgrade to bcrypt
  if (password === storedPass) {
    const newHash = bcrypt.hashSync(password, 10);
    await client.execute({
      sql: "UPDATE users SET password = ? WHERE username = ?",
      args: [newHash, username]
    });
    return true;
  }

  return false;
}

export async function changePasswordDB(username: string, oldPass: string, newPass: string) {
  await initDb();
  
  // Verify old password
  const isValid = await loginUserDB(username, oldPass);
  if (!isValid) return false;
  
  // Hash & update to new password
  const newHash = bcrypt.hashSync(newPass, 10);
  await client.execute({
    sql: "UPDATE users SET password = ? WHERE username = ?",
    args: [newHash, username]
  });
  return true;
}

export async function getAllPermitsDB() {
  await initDb();
  const res = await client.execute("SELECT data FROM permits ORDER BY updated_at DESC");
  return res.rows.map(row => JSON.parse(row.data as string));
}

export async function getPermitByIdDB(id: string) {
  await initDb();
  const res = await client.execute({
    sql: "SELECT data FROM permits WHERE id = ?",
    args: [id]
  });
  if (res.rows.length === 0) return null;
  return JSON.parse(res.rows[0].data as string);
}

export async function savePermitDB(permit: any) {
  await initDb();
  const dataStr = JSON.stringify(permit);
  await client.execute({
    sql: `
      INSERT INTO permits (id, data, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET 
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [permit.id, dataStr]
  });
  return permit;
}

export async function deletePermitDB(id: string) {
  await initDb();
  await client.execute({
    sql: "DELETE FROM permits WHERE id = ?",
    args: [id]
  });
  return { success: true };
}

export async function bulkSavePermitsDB(permits: any[]) {
  await initDb();
  for (const permit of permits) {
    if (permit && permit.id) {
      await savePermitDB(permit);
    }
  }
  return { success: true, count: permits.length };
}
