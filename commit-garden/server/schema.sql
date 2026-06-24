-- Commit Garden — MySQL schema (optional; the server falls back to in-memory)
CREATE DATABASE IF NOT EXISTS commit_garden;
USE commit_garden;

CREATE TABLE IF NOT EXISTS gardens (
  user       VARCHAR(100) PRIMARY KEY,
  waterings  INT NOT NULL DEFAULT 0,
  data       JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_gardens_waterings ON gardens (waterings DESC);
