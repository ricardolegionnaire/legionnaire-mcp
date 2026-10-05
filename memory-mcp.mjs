import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import pg from "pg";
import crypto from "crypto";

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

function normalizeContent(content) {
  return content
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function createContentHash(content) {
  return crypto
    .createHash("sha256")
    .update(normalizeContent(content), "utf8")
    .digest("hex");
}

function cleanCategory(category) {
  return category.trim().toLowerCase();
}

function createServer() {
  const server = new McpServer({
    name: "legionnaire-memory",
    version: "2.0.0"
  });

  // ============================================================
  // 1. GUARDAR MEMÓRIA
  // ============================================================
  server.registerTool(
    "save_memory",
    {
      description:
        "Guarda memória persistente útil do Ricardo. Antes de criar uma nova memória, o sistema verifica duplicados. Usa categorias claras como perfil, preferencia, projeto, trabalho, aprendizagem, objetivo, decisao, rotina, tecnologia ou outro. Não guardar passwords, tokens, chaves API ou segredos. Informação sensível só deve ser guardada quando Ricardo pedir explicitamente.",
      inputSchema: z.object({
        user_id: z.string().default("ricardo"),
        category: z.string(),
        content: z.string().min(1),
        importance: z.number().int().min(1).max(10).default(5),
        source: z.string().optional(),
        expires_at: z.string().datetime().optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({
      user_id,
      category,
      content,
      importance,
      source,
      expires_at,
      metadata
    }) => {
      const normalized = normalizeContent(content);
      const contentHash = createContentHash(content);
      const normalizedCategory = cleanCategory(category);

      // Procurar memória igual, incluindo memórias antigas sem hash
      const duplicate = await pool.query(
        `
        SELECT *
        FROM memories
        WHERE user_id = $1
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (
            content_hash = $2
            OR LOWER(REGEXP_REPLACE(BTRIM(content), '\\s+', ' ', 'g')) = $3
          )
        ORDER BY updated_at DESC
        LIMIT 1
        `,
        [user_id, contentHash, normalized]
      );

      // Se já existir, não criar duplicado
      if (duplicate.rowCount > 0) {
        const old = duplicate.rows[0];

        const updated = await pool.query(
          `
          UPDATE memories
          SET
            importance = GREATEST(importance, $1),
            source = COALESCE($2, source),
            expires_at = COALESCE($3, expires_at),
            metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
            content_hash = $5,
            updated_at = NOW()
          WHERE id = $6
          RETURNING *
          `,
          [
            importance,
            source ?? null,
            expires_at ?? null,
            JSON.stringify(metadata ?? {}),
            contentHash,
            old.id
          ]
        );

        return textResult(
          JSON.stringify(
            {
              success: true,
              duplicate: true,
              message:
                "Esta memória já existia. Não foi criado um duplicado; a memória existente foi reforçada.",
              memory: updated.rows[0]
            },
            null,
            2
          )
        );
      }

      const result = await pool.query(
        `
        INSERT INTO memories (
          user_id,
          category,
          content,
          importance,
          source,
          expires_at,
          metadata,
          content_hash,
          access_count
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8, 0
        )
        RETURNING *
        `,
        [
          user_id,
          normalizedCategory,
          content.trim(),
          importance,
          source ?? null,
          expires_at ?? null,
          JSON.stringify(metadata ?? {}),
          contentHash
        ]
      );

      return textResult(
        JSON.stringify(
          {
            success: true,
            duplicate: false,
            message: "Memória guardada com sucesso.",
            memory: result.rows[0]
          },
          null,
          2
        )
      );
    }
  );

  // ============================================================
  // 2. PESQUISAR MEMÓRIAS
  // ============================================================
  server.registerTool(
    "search_memory",
    {
      description:
        "Pesquisa memórias persistentes do Ricardo. Deve ser usada antes de responder sobre preferências, decisões, projetos, objetivos, histórico ou outros factos pessoais que possam ter sido guardados.",
      inputSchema: z.object({
        user_id: z.string().default("ricardo"),
        query: z.string().min(1),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10)
      })
    },
    async ({ user_id, query, category, limit }) => {
      const searchTerm = `%${query.trim()}%`;

      let result;

      if (category) {
        result = await pool.query(
          `
          SELECT
            id,
            user_id,
            category,
            content,
            importance,
            source,
            created_at,
            updated_at,
            expires_at,
            last_accessed_at,
            access_count,
            metadata
          FROM memories
          WHERE user_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
            AND category = $2
            AND content ILIKE $3
          ORDER BY
            importance DESC,
            access_count DESC,
            updated_at DESC
          LIMIT $4
          `,
          [
            user_id,
            cleanCategory(category),
            searchTerm,
            limit
          ]
        );
      } else {
        result = await pool.query(
          `
          SELECT
            id,
            user_id,
            category,
            content,
            importance,
            source,
            created_at,
            updated_at,
            expires_at,
            last_accessed_at,
            access_count,
            metadata
          FROM memories
          WHERE user_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
            AND content ILIKE $2
          ORDER BY
            importance DESC,
            access_count DESC,
            updated_at DESC
          LIMIT $3
          `,
          [user_id, searchTerm, limit]
        );
      }

      // Registar utilização das memórias encontradas
      if (result.rowCount > 0) {
        const ids = result.rows.map(row => row.id);

        const usageUpdate = await pool.query(
          `
          UPDATE memories
          SET
            access_count = COALESCE(access_count, 0) + 1,
            last_accessed_at = NOW()
          WHERE id = ANY($1::bigint[])
          RETURNING id, access_count, last_accessed_at
          `,
          [ids]
        );

        const usageMap = new Map(
          usageUpdate.rows.map(row => [
            String(row.id),
            {
              access_count: row.access_count,
              last_accessed_at: row.last_accessed_at
            }
          ])
        );

        for (const row of result.rows) {
          const usage = usageMap.get(String(row.id));

          if (usage) {
            row.access_count = usage.access_count;
            row.last_accessed_at = usage.last_accessed_at;
          }
        }
      }

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

  // ============================================================
  // 3. LISTAR MEMÓRIAS RECENTES
  // ============================================================
  server.registerTool(
    "list_recent_memories",
    {
      description:
        "Lista memórias recentes e válidas do Ricardo, opcionalmente filtradas por categoria.",
      inputSchema: z.object({
        user_id: z.string().default("ricardo"),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(10)
      })
    },
    async ({ user_id, category, limit }) => {
      let result;

      if (category) {
        result = await pool.query(
          `
          SELECT
            id,
            user_id,
            category,
            content,
            importance,
            source,
            created_at,
            updated_at,
            expires_at,
            last_accessed_at,
            access_count,
            metadata
          FROM memories
          WHERE user_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
            AND category = $2
          ORDER BY
            updated_at DESC,
            importance DESC
          LIMIT $3
          `,
          [user_id, cleanCategory(category), limit]
        );
      } else {
        result = await pool.query(
          `
          SELECT
            id,
            user_id,
            category,
            content,
            importance,
            source,
            created_at,
            updated_at,
            expires_at,
            last_accessed_at,
            access_count,
            metadata
          FROM memories
          WHERE user_id = $1
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY
            updated_at DESC,
            importance DESC
          LIMIT $2
          `,
          [user_id, limit]
        );
      }

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

  // ============================================================
  // 4. ATUALIZAR MEMÓRIA
  // ============================================================
  server.registerTool(
    "update_memory",
    {
      description:
        "Atualiza uma memória existente. Deve ser usada quando Ricardo corrige ou altera informação já guardada, em vez de criar memórias contraditórias.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        user_id: z.string().default("ricardo"),
        content: z.string().min(1).optional(),
        category: z.string().optional(),
        importance: z.number().int().min(1).max(10).optional(),
        source: z.string().optional(),
        expires_at: z.string().datetime().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      })
    },
    async ({
      id,
      user_id,
      content,
      category,
      importance,
      source,
      expires_at,
      metadata
    }) => {
      const existing = await pool.query(
        `
        SELECT *
        FROM memories
        WHERE id = $1
          AND user_id = $2
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

      const finalContent =
        content === undefined ? old.content : content.trim();

      const finalCategory =
        category === undefined
          ? old.category
          : cleanCategory(category);

      const finalHash = createContentHash(finalContent);

      const result = await pool.query(
        `
        UPDATE memories
        SET
          content = $1,
          category = $2,
          importance = $3,
          source = $4,
          expires_at = $5,
          metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
          content_hash = $7,
          updated_at = NOW()
        WHERE id = $8
          AND user_id = $9
        RETURNING *
        `,
        [
          finalContent,
          finalCategory,
          importance ?? old.importance,
          source ?? old.source,
          expires_at === undefined
            ? old.expires_at
            : expires_at,
          JSON.stringify(metadata ?? {}),
          finalHash,
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

  // ============================================================
  // 5. APAGAR MEMÓRIA
  // ============================================================
  server.registerTool(
    "delete_memory",
    {
      description:
        "Apaga permanentemente uma memória específica. Deve ser usada apenas quando Ricardo pedir explicitamente para apagar ou esquecer essa informação.",
      inputSchema: z.object({
        id: z.number().int().positive(),
        user_id: z.string().default("ricardo")
      })
    },
    async ({ id, user_id }) => {
      const result = await pool.query(
        `
        DELETE FROM memories
        WHERE id = $1
          AND user_id = $2
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

console.error(
  "LEGIONNAIRE Memory MCP v2.0 ativo via stdio"
);
