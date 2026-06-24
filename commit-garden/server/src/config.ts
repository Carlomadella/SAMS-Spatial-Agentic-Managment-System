import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8088),
  githubToken: process.env.GITHUB_TOKEN ?? "",
  db: {
    host: process.env.DB_HOST ?? "",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME ?? "commit_garden",
  },
};

/** MySQL is used only when a host is configured. */
export const useMysql = config.db.host.length > 0;
