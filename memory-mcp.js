import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL não está definida.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

function textResult(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function createServer() {
  const server = new McpServer({
    name: "legionnaire-memory",
    version: "1.0.0"
  });

  // 1. GUARDAR MEMÓRIA
  server.registerTool(
    "save_memory",
    {
      description:
        "Guarda uma memória persistente do utilizador. Usa apenas para informação útil, preferências, projetos, rotinas ou factos que devam ser lembrados no futuro.",
      inputSchema: z.object({
        user_id: z.string().default("ricardo"),
        category: z.string(),
        content: z.string(),
        importance: z.number().int().min(1).max(10).default(5),
        source: z.string().optional(),
        expires_at: z.string().datetime().optional()
      })
    },
    async ({
      user_id,
      category,
      content,
      importance,
      source,
      expires_at
    }) => {
      const result = await pool.query(
        `
        INSERT INTO memories
          (user_id, category, content, importance, source, expires_at)
        VALUES
          ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          user_id,
          category,
          content,
          importance,
          source,
          created_at,
          updated_at,
          expires_at
        `,
        [
          user_id,
          category,
          content,
          importance,
          source ?? null,
          expires_at ?? null
        ]
      );

      return textResult(
        JSON.stringify(
          {
            success: true,
            message: "Memória guardada com sucesso.",
            memory: result.rows[0]
          },
          null,
          2
        )
      );
    }
  );

  // 2. PESQUISAR MEMÓRIAS
  server.registerTool(
    "search_memory",
    {
      description:
        "Pesquisa memórias persistentes do utilizador por texto e opcionalmente por categoria.",
      inputSchema: z.object({
        user_id: z.string().default("ricardo"),
        query: z.string(),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10)
      })
    },
    async ({ user_id, query, category, limit }) => {
      const params = [user_id, `%${query}%`, limit];

      let sql = `
        SELECT
          id,
          user_id,
          category,
          content,
          importance,
          source,
          created_at,
          updated_at,
          expires_at
        FROM memories
        WHERE user_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())
          AND content ILIKE $2
      `;

      if (category) {
        params.splice(2, 0, category);
        sql += ` AND category = $3 `;
        sql += `
          ORDER BY importance DESC, updated_at DESC
          LIMIT $4
        `;
      } else {
        sql += `
          ORDER BY importance DESC, updated_at DESC
          LIMIT $3
        `;
      }

      const result = await pool.query(sql, params);

      return textResult(
        JSON.stringify(
          {
            success: true,
            count: result.rowCount,
            memories: result.rows
          },
          null,
          2
        )
      );
    }
  );

  // 3. LISTAR MEMÓRIAS RECENTES
  server.registerTool(
    "list_recent_memories",
    {
      description:
        "Lista as memórias mais recentes do utilizador, opcionalmente filtradas por categoria.",
      inputSchema: z.object({
        user_id: z.string().default("ricardo"),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10)
      })
    },
    async ({ user_id, category, limit }) => {
      const params = [user_id, limit];

      let sql = `
        SELECT
          id,
          user_id,
          category,
          content,
          importance,
          source,
          created_at,
          updated_at,
          expires_at
        FROM memories
        WHERE user_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      if (category) {
        params.splice(1, 0, category);
        sql += ` AND category = $2 `;
        sql += `
          ORDER BY updated_at DESC
          LIMIT $3
        `;
      } else {
        sql += `
          ORDER BY updated_at DESC
          LIMIT $2
        `;
      }

      const result = await pool.query(sql, params);

      return textResult(
        JSON.stringify(
          {
            success: true,
            count: result.rowCount,
            memories: result.rows
          },
          null,
          2
        )
      );
    }
  );

  // 4. ATUALIZAR MEMÓRIA
  server.registerTool(
    "update_memory",
    {
      description:
        "Atualiza uma memória existente pelo ID.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        user_id: z.string().default("ricardo"),
        content: z.string().optional(),
        category: z.string().optional(),
        importance: z.number().int().min(1).max(10).optional(),
        source: z.string().optional(),
        expires_at: z.string().datetime().nullable().optional()
      })
    },
    async ({
      id,
      user_id,
      content,
      category,
      importance,
      source,
      expires_at
    }) => {
      const existing = await pool.query(
        `
        SELECT *
        FROM memories
        WHERE id = $1 AND user_id = $2
        `,
        [id, user_id]
      );

      if (existing.rowCount === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Memória ${id} não encontrada.`
            }
          ]
        };
      }

      const old = existing.rows[0];

      const result = await pool.query(
        `
        UPDATE memories
        SET
          content = $1,
          category = $2,
          importance = $3,
          source = $4,
          expires_at = $5,
          updated_at = NOW()
        WHERE id = $6 AND user_id = $7
        RETURNING *
        `,
        [
          content ?? old.content,
          category ?? old.category,
          importance ?? old.importance,
          source ?? old.source,
          expires_at === undefined ? old.expires_at : expires_at,
          id,
          user_id
        ]
      );

      return textResult(
        JSON.stringify(
          {
            success: true,
            message: "Memória atualizada.",
            memory: result.rows[0]
          },
          null,
          2
        )
      );
    }
  );

  // 5. APAGAR MEMÓRIA
  server.registerTool(
    "delete_memory",
    {
      description:
        "Apaga permanentemente uma memória específica do utilizador pelo ID.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        user_id: z.string().default("ricardo")
      })
    },
    async ({ id, user_id }) => {
      const result = await pool.query(
        `
        DELETE FROM memories
        WHERE id = $1 AND user_id = $2
        RETURNING id
        `,
        [id, user_id]
      );

      if (result.rowCount === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Memória ${id} não encontrada.`
            }
          ]
        };
      }

      return textResult(
        JSON.stringify(
          {
            success: true,
            message: `Memória ${id} apagada.`
          },
          null,
          2
        )
      );
    }
  );

  return server;
}

void serveStdio(createServer);

console.error("LEGIONNAIRE Memory MCP v1.0 ativo via stdio");
